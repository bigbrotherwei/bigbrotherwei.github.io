---
title: "DeepSeek 3FS 架构与线程模型"
description: "解析 3FS 的元数据与数据平面、CRAQ 写入、RDMA 路径及 Storage 线程协程模型。"
pubDate: 2026-10-12T13:00:00+08:00
tags:
  - DeepSeek 3FS
  - 分布式文件系统
  - RDMA
topic: "distributed-filesystems"
order: 3
draft: false
background: "post-deepseek-3fs-architecture"
---

## 1. 核心定位与设计目标

3FS（Fire-Flyer File System）是 DeepSeek 开源的计算存储分离式共享文件系统，重点面向 AI 训练、推理和大规模数据处理。它并不是以“覆盖全部传统 NAS/POSIX workload”为第一目标，而是把 NVMe SSD、RDMA 网络和大规模并发客户端作为基本假设。

一句话理解：3FS = Stateless Meta + FoundationDB 事务 + Client-side 数据位置计算 + RDMA + NVMe Chunk Engine + CRAQ + 面向 AI workload 的语义取舍。

- 计算节点和存储节点解耦，数据访问不依赖本地性（locality-oblivious）。
- Meta 负责 namespace 与文件属性，正常数据 read/write 绕过 Meta。
- 副本不仅用于可靠性，还通过 CRAQ 的 read-any 贡献读带宽。
- 高性能客户端使用 USRBIO：共享 IOV、IOR ring、批处理和 RDMA。
- 后端针对 NVMe、异步 I/O、大量并发请求做线程池/协程池资源隔离。

官方公开的大规模测试中，3FS 使用 180 个 Storage 节点、每节点 16 块 NVMe 和双 200Gbps InfiniBand，并以 500+ 客户端实现约 6.6 TiB/s 聚合读吞吐。该数字用于说明系统设计目标是“聚合带宽 scale-out”，而不是单节点极限。参考 [1]。

## 2. 总体架构与组件职责

![3FS Client、Meta、mgmtd、Storage 与 FoundationDB 的组件关系](/images/posts/deepseek-3fs-architecture/figure-01.png)

*3FS 组件关系：Client、Meta、mgmtd、Storage 与 FoundationDB。*

| 组件 | 职责 | 是否进入正常数据路径 |
| --- | --- | --- |
| Client | 路径解析后的布局计算；FUSE/USRBIO；直接访问 Storage | 是 |
| Meta Service | inode/dentry/namespace 操作；FoundationDB 事务 | 否（仅 metadata） |
| FoundationDB | 持久化文件系统元数据并提供事务一致性 | 否 |
| mgmtd | 成员关系、Target 状态、Chain Table、lease、版本 | 否 |
| Storage Service | Chunk 数据、CRAQ、副本、NVMe I/O、恢复 | 是 |

架构中最关键的边界是 Metadata Plane 与 Data Plane 的分离。Client 完成 open/create/stat/rename 等操作后拿到 inode 与 layout 信息，后续 read/write 可直接访问 Storage。

![3FS 元数据平面与数据平面分离示意图](/images/posts/deepseek-3fs-architecture/figure-02.png)

*Metadata Plane 与 Data Plane 分离。*

### 2.1 mgmtd：控制面与成员资格

mgmtd 管理 Node Membership、Storage Target、Chain Table、Chain Version、Target 状态和 heartbeat/lease。多个 mgmtd 可部署，但只有 primary 修改集群拓扑。正常数据流量不经过 mgmtd，因此它不需要承载集群聚合数据带宽。参考 [2]。

```text
Client -------------------------> Storage
          正常 read/write

Meta / Storage ---- heartbeat ---> mgmtd
mgmtd -------- chain table -----> Client / Service
```

Lease 还承担 fencing 作用：如果某个 Storage 与 mgmtd 长时间失联，它不能继续长期以旧拓扑提供服务，否则可能在网络分区后形成旧成员继续接受写请求的问题。

## 3. 元数据架构：Meta + FoundationDB

3FS 的 Meta Service 设计为 stateless。真正的文件系统元数据保存在 FoundationDB 中，因此 Meta 崩溃后不需要像传统 stateful MDS 那样恢复大量内存状态、journal 和 cache ownership。客户端可以切换到其他 Meta 实例继续执行 namespace 操作。参考 [2]。

### 3.1 inode 与 dentry

```text
INOD | inode_id  ->  uid/gid/mode/time/file_length/layout...

DENT | parent_inode | filename  ->  inode_id + inode_type
```

Dentry 使用 parent inode + filename 作为 key，使同一目录的目录项自然形成连续 key range。因此 readdir 可以较自然地映射为 FoundationDB range scan。目录 inode 还保存 parent inode，可用于目录 rename 时的环检测。

### 3.2 事务化 namespace 操作

rename/create/unlink 等涉及多个 key 的操作可放进 FoundationDB transaction。FoundationDB 根据 read/write conflict set 检测并发冲突，冲突事务重试。这样 Meta 层无需自己实现一套分布式锁服务器来保证同一 namespace 的事务一致性。

```text
rename("/A/foo", "/B/foo")

BEGIN
  check source / destination
  delete DENT | inode(A) | foo
  insert DENT | inode(B) | foo
  update related inode metadata
COMMIT
```

核心收益：把 metadata 的复制、事务、冲突检测和持久化一致性大量下沉给 FoundationDB，使 Meta 更接近可横向扩展的无状态 RPC/事务执行层。

## 4. 文件数据布局与 Client-side Placement

文件被切分为固定大小 chunk。Chunk ID 可以从 inode id 与 chunk index 派生；inode 中还保存 chunk size、chain table、chain range、stripe size、shuffle seed 等布局参数。参考 [2]。

```text
File
+---------+---------+---------+---------+
| chunk 0 | chunk 1 | chunk 2 | chunk 3 |
+---------+---------+---------+---------+

read(offset)
   -> chunk_index
   -> chunk_id
   -> chain
   -> target / replica
```

因此 open 完成以后，Client 不需要对每个 I/O 再询问 Meta“这个 chunk 在哪里”。这类 client-side placement 对扩展性很重要：Meta QPS 与数据吞吐不再成正比。

### 4.1 Target 与 Chain Table

3FS 将一块 SSD 进一步抽象为多个 Storage Target，不同 Target 被组合到不同 replication chain。这样某块 SSD 或节点失效后，其原本承担的读取压力可以更均匀地扩散到更多剩余设备，而不是集中到少数固定副本。官方设计文档甚至把 placement 建模为 Balanced Incomplete Block Design。

```text
SSD A: A1 A2 A3 A4 ...
SSD B: B1 B2 B3 B4 ...
SSD C: C1 C2 C3 C4 ...

Chain 1: A1 -> B2 -> C3
Chain 2: A2 -> D1 -> F2
Chain 3: A3 -> C2 -> E4
```

## 5. CRAQ 副本协议与读写路径

3FS 使用 CRAQ（Chain Replication with Apportioned Queries）管理副本。最值得记住的是：Write All，Read Any。写沿 chain 传播并由 tail 触发 commit；读可以选择任意处于可读状态的副本，因此副本本身成为读带宽资源。参考 [2]。

<div class="article-interactive">
  <p><strong>交互架构图</strong><a href="/interactive/distributed-filesystems.html?system=3fs" target="_blank" rel="noopener noreferrer">单独打开</a></p>
  <iframe src="/interactive/distributed-filesystems.html?system=3fs&embed=1" title="DeepSeek 3FS CRAQ 与副本路径交互图" loading="lazy" sandbox="allow-scripts" data-auto-height></iframe>
</div>

![CRAQ 副本链写入与确认路径](/images/posts/deepseek-3fs-architecture/figure-03.png)

*CRAQ 写入：Head 拉取 Client MR，Tail commit，ACK 反向传播。*

### 5.1 写请求

写请求首先到 Head。Storage 收到请求后不是让 Client 直接把 payload push 过来，而是由 Storage 主动执行 RDMA Read，从 Client 已注册的 MR 中拉取数据。请求中需要携带可定位该 buffer 的地址/rkey/长度等信息。

```text
Client MR (write buffer)
       ^
       | RDMA READ
       |
Storage Head
```

Head 会检查 chain version，获取 chunk lock，并把同一 chunk 的并发写串行化。当前 committed 版本为 v10 时，新的更新形成 pending v11；pending 向 successor 传播到 Tail。Tail 完成后 commit v11，并把 ACK 反向传回。每一层收到 ACK 后把 pending 转为 committed，最终 Head unlock。

### 5.2 读请求与 Pending

当某副本只有 committed version 时可直接读；当同时存在 pending 时，3FS 没有在普通读路径中额外向 Tail 发 version query，而是可以返回 retry，让 Client 短暂重试。Relaxed read 则允许直接读取 pending version。这个选择用很少量 retry 换掉正常读路径中的一次分布式协调。

适用性：CRAQ 很适合 read-heavy、数据块分散、客户端很多的 AI workload；但“同一热点 chunk 的大量并发覆盖写”会受到 Head 串行化限制。

## 6. Storage Engine：Chunk、RocksDB、物理块与 COW

Storage 侧同时存在“本地 chunk metadata”和“真正用户数据”。本地 RocksDB 存 chunk id、版本、chain version、物理位置和分配信息；大块 user data 放在 data files，底层使用 XFS/NVMe。FoundationDB 与 Storage RocksDB 的职责完全不同：前者是全局 filesystem metadata，后者是单 Storage 的 local chunk metadata。参考 [2][5]。

| 层次 | 保存内容 | 作用域 |
| --- | --- | --- |
| FoundationDB | inode、dentry、namespace、layout | 全局文件系统 |
| Storage RocksDB | chunk metadata、version、physical mapping | 单 Storage / Target |
| Data Files | 实际用户数据 | 本地 NVMe |
| XFS / NVMe | 底层文件系统与设备 | 本地设备 |

### 6.1 Physical Block Allocator

3FS 使用多个 physical block size class（从 64 KiB 到 64 MiB，共 11 档）并维护 block pool/bitmap；不足时通过 fallocate 批量扩展。这样 logical chunk 与 physical block 并非简单一一绑定，可以减少小修改导致的极端大粒度写放大。参考 [2]。

### 6.2 覆盖写：COW

```text
Logical Chunk A -> old block P1 (committed)

update:
  read old data
  apply modification
  allocate P2
  write P2 (pending)
  metadata atomically points to new version
  reclaim P1 later
```

COW 的主要收益不是“写得少”，而是旧版本不会在更新过程中被直接破坏，便于 committed/pending 双版本、并发读、crash consistency 和副本协议实现。代价是额外空间、RMW、回收和可能的写放大。

### 6.3 Append 优化

对于真正追加到 physical block 尾部的场景，3FS 可以进行更直接的 in-place append 优化，而不是所有写都完整 COW。也就是说其后端并非纯粹“永远 append-only”或“永远 in-place overwrite”，而是根据写入类型采用混合策略。参考 [2]。

| 模型 | 最大优势 | 主要代价 | 更适合 |
| --- | --- | --- | --- |
| 原地覆盖 | 小范围 update 的 I/O/空间成本低，无需回收旧块 | torn write / crash consistency 更难；版本隔离更复杂 | 高频固定位置小更新 |
| COW / 追加式 | 版本、快照、一致性、并发读写更自然 | 空间/写放大、GC 或回收、映射复杂 | 分布式副本、checkpoint、较大块更新 |

## 7. Client：FUSE 与 USRBIO

3FS 同时提供 FUSE Client 和 Native Client/USRBIO。FUSE 迁移成本低，应用可以通过普通 POSIX 路径访问；但小随机 I/O 会受到内核/用户态切换、共享队列和锁竞争等影响。官方设计文档提到 4 KiB read 在约 400K IOPS 之后受 FUSE shared queue 锁竞争限制。参考 [2]。

### 7.1 USRBIO：IOR + IOV

USRBIO 的核心是 IOV 与 IOR。IOV 是大块共享且已注册 RDMA 的内存区域；IOR 类似 submission/completion ring，记录 fd、offset、length、iov offset、operation 等请求。Native Client 从多个 IOR 中批量抓取请求，再发给 Storage。

![USRBIO 的 IOR、IOV 与 Client Worker 批处理关系](/images/posts/deepseek-3fs-architecture/figure-04.png)

*USRBIO：多 IOR、共享 IOV、Client Worker 批处理。*

对多线程应用，多个 IOR 通常比所有线程共享一个 IOR 更容易避免同步竞争。Batch 对 AI dataloader 的大量小随机读尤其重要，可以显著摊薄 RPC 开销。

## 8. 线程、协程与异步 I/O 模型

3FS Storage 并不是“一个 reactor 线程负责网络、磁盘和业务”的模型。文档对应的 2026-08-27 配置快照把 RPC I/O、请求处理、读盘、写盘、恢复同步和不同类别的 coroutine pool 分开。下面的线程数仅代表该版本的默认配置，不是协议固定值。参考 [3]。

![3FS Storage 的线程池与协程池逻辑关系](/images/posts/deepseek-3fs-architecture/figure-05.png)

*Storage 线程与协程模型（配置快照的逻辑视图）。*

| 模块 | 默认配置 | 职责 |
| --- | --- | --- |
| RPC I/O threads | 32 | 网络/RDMA RPC I/O 推进 |
| RPC proc threads | 32 | 请求处理/业务逻辑入口 |
| RPC bg threads | 2 | RPC 后台任务 |
| Connect threads | 2 | 连接建立相关工作 |
| AIO read worker | 32 | NVMe 异步读取 |
| Write worker | 32 | 前台写盘 |
| Write bg worker | 8 | 后台写相关任务 |
| Sync worker | 16 | 恢复/同步 |
| Read coroutine pool | 8 threads / 64 coroutines | Read pipeline |
| Update coroutine pool | 8 / 64 | Write/update pipeline |
| Sync coroutine pool | 8 / 64 | Recovery pipeline |
| Default coroutine pool | 8 / 64 | 通用任务 |

### 8.1 为什么要分这么多 Pool

不同 workload 的时间尺度差异非常大：RDMA completion 可能是极短事件；NVMe 访问需要等待；RocksDB 操作可能遇到后台 compaction；Recovery 可能持续数小时。如果全部使用一个全局 worker pool，恢复任务或磁盘等待很容易挤占正常读写资源。

```text
Network Event
   -> RPC I/O Thread
   -> Processor Thread
   -> Coroutine
       -> await disk / RDMA / metadata
       -> yield
   -> Dedicated AIO / Write / Sync Worker
```

协程的关键意义是等待 I/O 时主动让出执行线程：many requests 可以复用较少 OS threads，而不是“一请求一阻塞线程”。

### 8.2 Read Path 的线程调用链

```text
Application
  -> FUSE / USRBIO
  -> Client RDMA/RPC
  -> Storage RPC I/O thread
  -> Processor thread
  -> Read coroutine
  -> AIO read worker
  -> XFS / NVMe
  -> completion
  -> coroutine resume
  -> RDMA response / Client IOV
```

### 8.3 Write Path 的线程调用链

```text
Application buffer (MR)
  -> Client RPC (addr/rkey/len)
  -> Storage RPC I/O thread
  -> Processor thread
  -> Update coroutine
  -> RDMA READ client MR
  -> chunk lock / COW or append
  -> Write worker
  -> NVMe
  -> pending version
  -> CRAQ successor
  -> Tail commit / ACK
```

### 8.4 Meta 的线程模型

Meta 的 workload 主要是 RPC + FoundationDB transaction，因此线程规模显著小于 Storage。2026-08-27 配置快照的 meta_main.toml 中，主 RPC num_io_threads=2、num_proc_threads=2，同时启用 coroutine pool，max_coroutines_num=256、max_processing_requests_num=4096。参考 [4]。

```text
Client Metadata RPC
  -> Meta RPC I/O thread
  -> Processor thread
  -> Coroutine
  -> FoundationDB transaction
  -> await / yield
  -> resume / reply
```

## 9. 故障检测、Chain Version 与 Recovery

Storage 故障后，mgmtd 根据 heartbeat/lease 将 target 标记为 offline 并调整 chain，同时递增 chain version。客户端或 Storage 如果仍拿旧 chain version 发请求，会被拒绝，随后刷新拓扑并重试。这是防止旧拓扑继续写入的重要机制。参考 [2]。

```text
old: A -> B -> C    chain_version = 10
B fails
new: A -> C -> B(offline)   chain_version = 11

request(version=10) -> reject -> refresh -> retry
```

### 9.1 Recovery 状态与增量同步

恢复目标不会立刻恢复 serving，而会经历 offline/waiting/syncing/serving 等状态。恢复时 predecessor 与 recovering target 比较 chunk existence、chain version、committed version、pending version，只同步缺失或落后的 chunk，而不是简单全盘复制。参考 [2]。

```text
Predecessor: chunk1 CV=10 V=100; chunk2 CV=10 V=101
Recovering : chunk1 CV=10 V=100; chunk2 CV=9  V=90

chunk1 -> skip
chunk2 -> full-chunk-replace
```

Recovery 任务拥有独立 sync worker/coroutine pool，因此可以与正常 foreground I/O 并行，并通过资源隔离降低恢复对前台延迟的冲击。

## 10. 一致性语义与 POSIX 取舍

### 10.1 Chunk 数据一致性

Chunk 数据由 CRAQ 的 committed/pending 状态机维护。普通读只读取可确认 committed 的版本或重试，因此数据副本层的目标是强一致语义。

### 10.2 Active File Length

文件真实数据写入 Storage 后，FoundationDB 中 inode.size 不一定立即同步更新。Client 会周期性上报 maximum write position；close/fsync 时 Meta 再查询 Storage 得到准确长度。因此 active file length 是短暂 eventual consistency，而 chunk data consistency 与之不同。参考 [2]。

### 10.3 Read-only FD

为了避免 AI 任务瞬间打开数百万文件时 Meta/FDB 为每个只读 fd 维护 session，3FS 不完整追踪 read-only fd。Write fd 仍需跟踪，以避免 unlink/并发写导致无法回收的 garbage chunks。这个选择体现了“AI workload first”：保留主要文件系统接口，但不为少见 POSIX corner case 付出过高全局状态成本。参考 [2]。

## 11. 性能设计与 NUMA

3FS 的性能设计不是单点技巧，而是把网络、CPU、内存、SSD 并行度同时展开：客户端进行布局计算并直接访问 Storage；副本参与读负载；USRBIO 批量小请求；Storage 用协程隐藏 I/O 等待；读写和恢复使用不同 pool；部署上强调 NUMA locality。

- 将 NIC、CPU thread、RDMA buffer、NVMe 尽量绑定在同一 NUMA domain，减少 UPI/QPI 跨 NUMA 流量。
- 大规模聚合吞吐依赖许多 Storage/NVMe/replica 共同服务，而非单设备极限。
- 后台 Recovery、RocksDB 活动和前台请求需要资源隔离，否则 tail latency 会显著恶化。
- 同一 chunk 写串行意味着扩展性的前提是请求能够分散到大量文件/chunk。

官方 GraySort 场景中采用每个 NUMA domain 部署一个 Storage Service 的方式，体现了系统对 NUMA locality 的重视。参考 [1]。

## 12. 与 CephFS / SPDK 模型对比

### 12.1 与 CephFS

| 维度 | 3FS | CephFS |
| --- | --- | --- |
| Metadata Backend | FoundationDB | RADOS metadata pool |
| Metadata Server | Stateless Meta | Stateful MDS |
| 数据位置 | Chain Table / client-side layout | CRUSH / PG / OSD |
| 副本协议 | CRAQ chain | RADOS replication / EC |
| 数据路径 | Client -> Storage | Client -> OSD |
| 高性能网络 | RDMA-first | 更通用 |
| 主要介质 | NVMe/all-flash 优先 | HDD/SSD/NVMe |
| 场景 | AI/HPC workload 优先 | 通用 POSIX 文件系统 |

两者共同点是 metadata server 不进入正常文件数据路径；差异主要在 metadata backend/statefulness、placement、副本协议和 workload 假设。CephFS 参考 [6]。

### 12.2 与典型 SPDK Reactor

典型 SPDK 服务常采用 thread-per-core + polling + run-to-completion reactor；3FS 当前 Storage 更接近 RPC thread pool + coroutine + Linux async I/O workers + XFS/NVMe。3FS 并非纯用户态 SPDK block stack，而是利用成熟 XFS/Linux I/O 栈，再用 RDMA、并发和异步执行获得整体吞吐。

| 维度 | 3FS Storage | 典型 SPDK Reactor |
| --- | --- | --- |
| CPU 模型 | 线程池 + 协程 + worker | thread-per-core / reactor |
| 磁盘路径 | XFS + Linux async I/O + NVMe | 用户态 NVMe driver |
| 等待策略 | 异步 I/O + coroutine yield | polling |
| 工程复杂度 | 复用 Linux/XFS/RocksDB 生态 | 需要更多 userspace device/storage 管理 |

## 13. 适用场景、局限与工程启示

### 13.1 更适合

- AI Dataset / Dataloader 大量并发随机读取
- 大规模全量扫描、数据预处理
- Checkpoint 大块并行写
- KVCache / 模型相关共享数据
- 大量客户端 + 大量 chunk 的 scale-out 工作负载

### 13.2 不以其为首要目标

- 大量客户端同时覆盖同一个热点 chunk
- 4K/8K 高频固定位置 OLTP 式覆盖写
- 极端强调完整 POSIX corner case 的通用 NAS
- 必须依赖单块设备超低时延而不是集群聚合吞吐的场景

### 13.3 最值得借鉴的设计

| 设计 | 工程启示 |
| --- | --- |
| Stateless Meta + Transactional KV | 把 namespace consistency 与 Meta HA 简化为事务 KV 问题 |
| Client-side Placement | 避免 metadata QPS 与数据 I/O 次数线性绑定 |
| CRAQ Read-any | 副本不仅是可靠性成本，也是读取资源 |
| RDMA Pull Write | Server 主动 RDMA Read Client MR，可与内部 pipeline 自然衔接 |
| Coroutine + Dedicated Workers | 隐藏磁盘/网络等待，并隔离 Read/Write/Recovery |
| COW + Append Optimization | 根据 update 类型选择一致性友好或写放大更低的路径 |
| AI-first semantics | 明确 workload 后有意识地牺牲低价值 corner case |

最终总结：3FS 的核心不是单独某个 RDMA 或 NVMe 技巧，而是把“事务化元数据、Client-side placement、CRAQ、RDMA、异步 I/O 与资源隔离”组合成一条针对 AI workload 的完整数据路径。

## 附录 A. 默认线程配置速查

以下值来自 2026-08-27 前后官方仓库默认配置文件。它们是 tuning 起点，不是架构协议固定值；生产环境应结合 CPU 核数、NUMA、NIC、NVMe 数量、I/O 大小和 recovery 目标调整。

| 服务/模块 | 参数 | 默认值 |
| --- | --- | --- |
| Storage RPC | num_io_threads | 32 |
| Storage RPC | num_proc_threads | 32 |
| Storage RPC | num_bg_threads | 2 |
| Storage RPC | num_connect_threads | 2 |
| Storage AIO Read | num_threads | 32 |
| Storage Write | num_threads | 32 |
| Storage Write | bg_num_threads | 8 |
| Storage Sync | num_threads | 16 |
| Read Coroutine Pool | threads / coroutines | 8 / 64 |
| Update Coroutine Pool | threads / coroutines | 8 / 64 |
| Sync Coroutine Pool | threads / coroutines | 8 / 64 |
| Default Coroutine Pool | threads / coroutines | 8 / 64 |
| Meta RPC | num_io_threads | 2 |
| Meta RPC | num_proc_threads | 2 |
| Meta Processor | max_coroutines_num | 256 |
| Meta Processor | max_processing_requests_num | 4096 |

## 附录 B. 官方参考资料

[1] [DeepSeek 3FS GitHub README](https://github.com/deepseek-ai/3fs)

[2] [3FS Design Notes](https://github.com/deepseek-ai/3FS/blob/main/docs/design_notes.md)

[3] [Storage Default Configuration](https://github.com/deepseek-ai/3FS/blob/main/configs/storage_main.toml)

[4] [Meta Default Configuration](https://github.com/deepseek-ai/3FS/blob/main/configs/meta_main.toml)

[5] [3FS Deployment Guide](https://github.com/deepseek-ai/3FS/blob/main/deploy/README.md)

[6] [Ceph Architecture / CephFS Documentation](https://docs.ceph.com/en/latest/architecture/)

说明：线程数量与默认参数会随项目版本变化，使用本文进行性能设计或线上部署前，应再次核对目标 commit 对应配置。
