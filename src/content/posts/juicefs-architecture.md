---
title: "JuiceFS 架构与实现原理"
description: "梳理 JuiceFS 的元数据与对象存储分层、Chunk/Slice/Block、读写路径和高可用边界。"
pubDate: 2026-10-12T12:00:00+08:00
tags:
  - JuiceFS
  - 分布式文件系统
  - 对象存储
topic: "distributed-filesystems"
order: 2
draft: false
background: "post-juicefs-architecture"
---

## 1. 核心架构：JuiceFS 到底是什么

JuiceFS 的核心思路可以概括为：使用独立的元数据系统保存文件系统语义与数据映射，使用对象存储保存文件内容，由客户端同时访问两者，并在本地实现 POSIX 语义、缓存、预读、写缓冲以及后台维护。

```text
Application
                        │
                 POSIX / FUSE
                        │
                JuiceFS Client
                 /                             /                      Metadata Plane         Data Plane
       inode / dentry         immutable blocks
       chunk -> slices        object storage
              │                   │
     Redis/TiKV/SQL          S3/OSS/MinIO/Ceph
```

架构抓手
理解 JuiceFS 时始终把系统拆成两个平面：Metadata Plane 决定“文件现在是什么”，Data Plane 只负责保存“不可变的数据载荷”。

### 1.1 为什么要把 Metadata 与 Data 分开

- 容量扩展交给对象存储，不需要 JuiceFS 自己实现磁盘副本、EC、rebalance、scrub 等完整块存储能力。
- 元数据系统专注于 namespace、事务、锁、session、chunk/slice mapping 等强一致语义。
- 客户端可以直接与对象存储交互，数据吞吐随客户端数量扩展，不经过单一中心 Data Server。
- 对象数据尽量 immutable，使本地缓存和并发读取更容易实现。

### 1.2 JuiceFS 不是“把文件映射成一个 Object”

一个文件真正由 Namespace Metadata、Chunk Mapping、Slice Version Mapping 和 Immutable Blocks 共同构成。路径只负责找到 inode；inode 的逻辑地址空间再通过 Chunk/Slice 映射到最终 Object。

```text
path
  ↓
inode
  ↓
chunk(index)
  ↓
[slice1, slice2, slice3 ...]
  ↓
effective ranges
  ↓
block objects
  ↓
object storage
```

## 2. 元数据架构：Community 与 Enterprise 的根本差异

### 2.1 Community Edition：没有独立的 JuiceFS MDS 进程

Community Edition 的客户端直接访问 Metadata Engine。文件系统的大量 metadata logic 位于客户端的 meta/VFS 实现中，底层 Redis、TiKV、MySQL、PostgreSQL 等负责持久化、事务和并发原语。

```text
Application
    │
   FUSE
    │
JuiceFS Client
    ├── VFS / POSIX logic
    ├── Meta implementation ─────> Redis / TiKV / MySQL / PostgreSQL
    └── Object client ───────────> Object Storage
```

容易误解
Community 没有独立 MDS，不等于“没有 Metadata Service 能力”。更准确地说：文件系统语义由 rich client 实现，serialization/persistence 能力由事务型 Metadata Engine 提供。

### 2.2 Enterprise / Cloud：独立 Metadata Service + Raft

Enterprise / Cloud 使用自研 Metadata Service，并以 Raft 复制元数据。典型 metadata zone 由多个节点组成，只有拥有 quorum 的 Leader 才能提交新的 metadata mutation。

```text
JuiceFS Client
                        │
                        ▼
               Metadata Service
                  Raft Group
           ┌────────┬────────┬────────┐
           │ Leader │Follower│Follower│
           └────────┴────────┴────────┘
                        │
               committed history

                  Object Storage
```

| 维度 | Community Edition | Enterprise / Cloud |
| --- | --- | --- |
| 独立 JuiceFS Metadata Server | 没有 | 有 |
| Metadata backend | Redis / TiKV / SQL 等 | 自研 Metadata Service |
| 一致性基础 | 底层数据库事务/共识能力 | Raft |
| 客户端是否直接访问 DB | 是 | 否 |
| HA 责任 | 由所选 Metadata Engine 承担 | 由 Metadata Service/Raft 承担 |
| 扩展方式 | 取决于数据库 | metadata zone / Raft group |

## 3. 文件系统元数据模型：inode、dentry、session 与事务

### 3.1 Namespace 仍然是 inode + dentry 模型

```text
/                       inode 1
└── foo                 inode 100
    └── bar.txt         inode 200

(parent=1,   name="foo")     -> inode 100
(parent=100, name="bar.txt") -> inode 200
```

目录项（dentry）负责“名字到 inode”的映射，inode 负责文件本体属性。Rename 的本质通常不是移动数据，而是修改 dentry 与 parent 关系。

### 3.2 Chunk Mapping 也属于元数据

```text
inode 200
├── chunk 0 -> [Slice A]
├── chunk 1 -> [Slice B, Slice C]
└── chunk 2 -> [Slice D]
```

真正的数据对象不由路径直接引用，而由 inode + chunkIndex 定位到 Slice 列表，再由 Slice 找到 Block/Object。

### 3.3 Session：客户端在 Metadata Plane 的身份

可写客户端会持有 metadata session。Session 关联 heartbeat、open-unlinked inode、部分锁状态和后台清理语义。客户端异常退出后，其他节点可以在 session 过期后回收对应状态。

为什么热升级要继承 SID
如果新客户端热升级后创建全新的 metadata session，旧 session 上的 sustained inode、锁或其他状态可能被当作“旧客户端已死亡”处理。因此热升级需要保持 session 身份连续性。

### 3.4 Transaction 与 Consensus 是两层不同的问题

| 问题 | 需要的机制 | 解决什么 |
| --- | --- | --- |
| 两个客户端同时修改同一份 metadata | 事务 / CAS / WATCH / lock | 保证一次操作内部原子并检测并发冲突 |
| 多份 Metadata Replica 在网络分区后谁是真相 | Raft / Paxos / quorum | 保证只有一条 committed history |
| 旧客户端在 failover 后继续持有旧 lease | Session / epoch / fencing | 阻止 stale client 继续提交 |

关键公式
Transaction ≠ Consensus。事务解决“对同一份状态怎么原子修改”；共识解决“多份状态副本中哪一份有资格成为真相”。

## 4. 数据组织：为什么同时需要 Chunk、Slice 和 Block

Chunk、Slice、Block 并不是简单的“大块、中块、小块”，而是三个不同维度的抽象。

| 层级 | 典型大小 | 本质 | 主要职责 |
| --- | --- | --- | --- |
| Chunk | 64 MiB | 固定逻辑地址窗口 | 按 offset 快速定位，限制 metadata/compaction 范围 |
| Slice | 变长，≤ Chunk | 一次写入形成的逻辑版本片段 | 表达随机覆盖写与先后覆盖关系 |
| Block | ≤ 4 MiB | 真正数据 I/O / Object 单元 | 并发上传、读取、缓存、失败重试 |

```text
File logical address space
        │
        ▼
Chunk = Addressing
“这个 offset 属于哪一段？”
        │
        ▼
Slice = Versioning / Overwrite
“这一段最终应该看哪个版本？”
        │
        ▼
Block = Physical I/O
“这些字节具体怎么存、怎么传、怎么缓存？”
```

### 4.1 Chunk：固定分桶，控制大文件元数据复杂度

读取 offset=100 MiB 时，可直接通过 offset / 64 MiB 得到 chunkIndex=1。没有 Chunk 时，一个超大文件的所有 Slice 可能堆在一个巨大列表中，定位和 compaction 范围都会失控。

0              64MiB            128MiB           160MiB
|----------------|-----------------|----------------|
    Chunk 0           Chunk 1          Chunk 2

### 4.2 Slice：用 immutable patch 避免对象存储 RMW

对象存储不擅长对既有 Object 做 4 KiB 原地覆盖。JuiceFS 的做法是保留旧 Slice，新增一个覆盖对应逻辑范围的新 Slice；读取时后写 Slice 覆盖先写 Slice。

Old Slice A:  AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
New Slice B:          BBBB
                       ↑
                    4 KiB update

Final view:   AAAAAAAAABBBBAAAAAAAAAAAAAAAAA

设计取舍
JuiceFS 把前台 read-modify-write 放大，转换成“增加 Slice + 后台 Compaction”的成本。这和 LSM 把随机更新转化为 append + compaction 的思想相似。

### 4.3 Block：对象存储 I/O 与缓存粒度

一个 64 MiB Slice 可以拆成最多 16 个 4 MiB Block 并发上传。Block 同时也是本地磁盘缓存、对象读取和失败重试的基本粒度。

```text
64 MiB Slice
  ├── Block 0   4 MiB ─┐
  ├── Block 1   4 MiB ─┼─ parallel PUT / GET
  ├── ...               │
  └── Block 15  4 MiB ─┘
```

### 4.4 如果删掉其中一层会怎样

| 删掉的层 | 直接后果 |
| --- | --- |
| Chunk | 大文件的 Slice 集合难以定位、分片和限制 compaction 范围 |
| Slice | 小随机覆盖容易退化成 GET old block + modify + PUT new block 的 RMW |
| Block | 大 Slice 直接变成大 Object，上传并发度、缓存粒度和重试粒度都变差 |

## 5. 读写路径、缓存与随机覆盖写

### 5.1 顺序写路径

```text
Application write()
       │
       ▼
Client memory buffer
       │
   build Slice
       │
 flush / close / fsync
       │
 split into Blocks
       │
Object Storage PUT
       │ success
       ▼
Metadata transaction: chunk -> slice mapping
```

默认思路是先让数据对象可用，再发布对应 metadata mapping。这样失败时更倾向于产生“孤儿对象”，而不是产生“metadata 已经可见但数据不存在”的更危险状态。

### 5.2 write() 快并不代表已经持久化

普通 write() 可以主要落在客户端 buffer，因此 syscall latency 很低；真正的数据上传和 metadata commit 常在 flush、close 或 fsync 阶段发生。做性能测试时，必须同时观察 write、fsync、close 与对象存储吞吐。

### 5.3 读路径与多层缓存

```text
Application
   │
Kernel Page Cache
   │ miss
JuiceFS Client Buffer
   │ miss
Local Block Cache (SSD/NVMe)
   │ miss
Object Storage
```

由于 Block immutable，缓存可以直接以 Block ID 为 key；不需要像可变块存储那样持续询问“这个 Block 是否被别人原地改过”。

### 5.4 Slice 碎片与 Compaction

高频随机 pwrite 会在同一 Chunk 内产生越来越多 Slice。读取时需要合并多个覆盖关系，元数据和对象访问会被放大。JuiceFS 因此会在后台做 compaction，将多个碎片 Slice 合并成新的、更连续的 Slice，并在引用归零后清理旧数据。

## 6. Rename：没有独立 MDS 时如何保证原子性

以 Community + Redis 为例，rename 是理解 rich client + transactional metadata engine 最好的案例。

### 6.1 Rename 的本质：改 dentry，不搬数据

Before:
  d$100: "foo" -> inode 300
  d$200: ...
  i$300.Parent = 100

rename /dirA/foo -> /dirB/bar

After:
  d$100: delete "foo"
  d$200: "bar" -> inode 300
  i$300.Parent = 200

Chunk/Slice/Object: unchanged

因此 rename 1 KiB 文件与 rename 10 TiB 文件，在数据面都不需要搬移对象；核心工作量来自元数据事务。

### 6.2 调用链

```text
rename(2)
  ↓
Linux VFS
  ↓
FUSE Rename
  ↓
VFS.Rename
  ↓
Meta.Rename
  ↓
backend doRename
  ↓
transaction commit
```

### 6.3 Redis 后端：WATCH + MULTI/EXEC

客户端先读取 source/destination dentry，检查权限、类型、sticky bit、immutable、目标目录是否为空等 POSIX 约束；随后对相关 parent、source inode、destination inode 等 key 建立 WATCH，在 MULTI/EXEC 中一次性修改 dentry、inode parent、nlink 等状态。

```text
WATCH relevant metadata keys
  ↓
read & validate
  ↓
MULTI
  HDEL old_parent old_name
  HSET new_parent new_name inode
  SET  inode attr / parent
  update nlink / overwritten target state
EXEC
```

如果另一个客户端在此期间修改了 WATCH 的 key，EXEC 失败，JuiceFS 重新读取并重试。这样多个客户端可以共享同一 Metadata Engine，而不需要一个中心 MDS 逐请求串行执行。

### 6.4 覆盖一个仍然 open 的目标文件

如果 rename 覆盖了一个正在被其他进程打开的目标 inode，POSIX 仍要求已有 fd 可继续访问旧 inode。JuiceFS 会利用 session/sustained 语义保留该 inode，直到最后一个引用释放后再回收。

## 7. Rename 成环与分布式 namespace 的边界

### 7.1 单客户端明显成环：Linux VFS 会先拦截

```text
A
└── B
    └── C

rename A -> A/B/C/A

would become:
A -> B -> C -> A
```

正常 Linux FUSE 路径下，VFS 会对“把目录移到自己的后代目录”做 ancestry check，因此明显的单客户端成环通常在进入 JuiceFS metadata backend 前就被拒绝。

### 7.2 多客户端并发 rename 更难

两个不同 Linux kernel 的 VFS rename mutex 彼此独立。两个单独看都合法的 rename，在不同客户端同时执行后可能组合成环，因此全局 namespace invariant 不能只依赖单机 VFS。

```text
Initial:
/
├── A
└── X
    └── Y

Client 1: X -> A/X
Client 2: A -> X/Y/A

If both are allowed based on stale topology:
A -> X -> Y -> A   (cycle)
```

当前 Community 多个 metadata backend 源码中对“destination parent 是否位于 source 的后代链”仍存在显式 TODO/有限检查。因此严格意义上的分布式目录拓扑安全，需要更强的全局拓扑锁、祖先链锁或版本化/CAS 机制，而不仅是事务原子性。

为什么这个问题重要
事务能保证“这次 rename 的多项元数据修改一起成功”，但它不会自动知道最终目录图是否违反“必须无环”这一全局不变量。

## 8. 客户端热升级：FUSE FD handoff 与句柄恢复

JuiceFS 的平滑升级不是“快速 umount + remount”，而是尽量保留原有 kernel FUSE connection，仅把 userspace daemon 替换为新进程。

### 8.1 三类必须迁移的状态

| 状态 | 为什么必须保留 | 实现方式 |
| --- | --- | --- |
| /dev/fuse FD | 保住同一个 kernel FUSE connection | Unix Domain Socket + SCM_RIGHTS 传递 fd |
| VFS handle table | kernel 后续还会带旧 fh 发 READ/WRITE/RELEASE | dumpAllHandles / loadAllHandles |
| Metadata Session ID | 保住 sustained inode、session/lock 身份连续性 | 新进程继承旧 SID |

### 8.2 典型热升级流程

```text
New JuiceFS starts
   │
   ├─ read old .config (Pid / CommPath / StatePath / SID / FuseOpts)
   ├─ check compatible FUSE options
   ├─ get old /dev/fuse FD via SCM_RIGHTS
   ├─ send SIGHUP to old process
   │
Old process
   ├─ FlushAll()
   ├─ quiesce FUSE
   ├─ dump handle state
   ├─ FlushSession / shutdown object client
   └─ exit
   │
New process
   ├─ inherit Metadata SID
   ├─ load handle state
   └─ serve the same FUSE connection
```

因为 kernel 侧的 mount 与 FUSE connection 没换，应用已有的 fd 不需要重新 open。切换窗口内请求可能短暂排队或出现 latency 抖动，但目标是避免 EIO、ESTALE 或挂载点消失。

### 8.3 为什么不能随意修改 FUSE 参数

很多 FUSE capability 和连接级参数在 FUSE_INIT 阶段协商。热升级保留的是旧 connection，没有重新进行完整 mount/FUSE_INIT，因此新旧 FuseOpts 必须兼容；不兼容时需要走重新挂载而不是透明接管。

## 9. 网络分区：Raft、Quorum 与 Split Brain

### 9.1 问题模型

如果两个网络分区都允许对同一 inode/dentry 继续提交 metadata write，就会形成两个互相冲突、各自“成功”的历史。文件系统中的 rename、unlink、truncate、link 等操作很难在事后自动 merge，因此正确策略是网络分区期间只允许一个分区拥有写权限。

```text
Partition A                  Partition B
Client A                     Client B
   │                            │
   ▼                            ▼
metadata replica(s)          metadata replica(s)

A: rename /a -> /b
B: rename /a -> /c

If both commit => split brain
```

### 9.2 Raft 的原则：只有多数派历史可以 Commit

3 节点 Raft Group 的 quorum=2。Leader 可以本地 append log，但必须获得多数派复制确认后才能推进 commit index 并向客户端返回成功。

```text
M1 Leader  +  M2 Follower  +  M3 Follower
      │            │              │
      └──── log replication ──────┘

2/3 acknowledged => commit => client success
1/3 only          => uncommitted => must not report success
```

### 9.3 网络分区后的可用性

| Raft 规模 | 分区形态 | 结果 |
| --- | --- | --- |
| 3 | 2 : 1 | 2 节点侧可写，1 节点侧拒绝写 |
| 3 | 1 : 1 : 1 | 任何一侧都没有 quorum，全部停止推进 |
| 5 | 3 : 2 | 3 节点侧可写，2 节点侧拒绝写 |
| 5 | 2 : 2 : 1 | 任何一侧都没有 quorum，全部停止推进 |
| 4 | 2 : 2 | quorum=3，两边都不可写；这也是 voting member 通常取奇数的原因 |

CAP 选择
Metadata Service 通常选择 CP：网络分区时宁可让一部分或全部客户端暂时不可写，也不能让两个分区都形成 committed metadata history。

### 9.4 旧 Leader 被隔离为什么也不能继续写

旧 Leader 即使仍认为自己是 Leader，也只能产生 uncommitted log；因为无法获得 quorum，它不能向客户端返回成功。多数派一侧会选出新 Leader。网络恢复后，旧 Leader step down，其未提交分支被新的 committed log 覆盖。

### 9.5 灰色故障：Safety 通常还在，Liveness 可能很差

现实中的网络故障经常是单向丢包、高延迟、周期性抖动，而非整齐的 2:1 切割。Raft 在这种情况下通常仍能保持 safety，但可能频繁 election、Leader 反复切换，导致 metadata latency 激增和大量 retry/timeout。

## 10. “后端还有元数据”为什么不代表它还能写

网络分区后，少数派节点往往仍持有完整或接近完整的 metadata replica。关键不是“谁手里有数据”，而是“谁拥有 authority”。

| 分区 | 有 metadata 副本 | 能否读到旧数据 | 能否提交新写 |
| --- | --- | --- | --- |
| Majority | 是 | 是 | 是 |
| Minority | 通常也是 | 可能可以，但可能 stale | 否 |

Data possession  ≠  Write authority

Minority node:
  metadata replica      ✓
  old committed log     ✓
  possibly complete data✓
  quorum                ✗
  commit new mutation   ✗

网络分区后存在多个不同版本的 replica 本身并不等于 split brain。只要只有多数派能够继续产生 committed write，少数派只是 stale；网络恢复后通过日志复制追平即可。真正的 split brain 是两个分支都向客户端返回了“已提交成功”。

## 11. Community 元数据后端的 HA 差异

Community Edition 的一致性上限不会高于所选 Metadata Engine。JuiceFS 上层的 rename/create/unlink 事务再正确，如果底层数据库允许两个独立 writable primary 同时接受事务，仍然会发生真正的 metadata split brain。

### 11.1 TiKV：共识下沉到 Metadata Engine

TiKV 的数据 Region 通过 Raft 复制。少数派副本即使本地还有 KV，也不能继续提交 mutation，因此行为与独立 Metadata Service 的 quorum 思路相似。

### 11.2 Redis / MySQL：必须特别关注 failover 与 fencing

如果旧 Primary 被网络隔离，而另一侧又把 Replica promote 成新 Primary，必须确保旧 Primary 被彻底 fencing。否则两个 JuiceFS Client 可能分别连接两个 writable primary，各自在自己的数据库上完成原子事务，最终形成两条不可自动合并的 metadata history。

```text
Partition A                         Partition B
Client A                            Client B
   │                                   │
Old Primary (still writable)       New Primary (promoted)
   │                                   │
transaction A success              transaction B success

=> each transaction is atomic, but global history has forked
```

### 11.3 Metadata 与 Object Storage 的网络分区

| 网络状态 | 典型后果 |
| --- | --- |
| Object Storage 可达，Metadata quorum 不可达 | Block PUT 可能成功，但 mapping commit 失败；形成 orphan object，后续可 GC |
| Metadata 可达，Object Storage 不可达 | 纯 metadata 操作可能成功；data read cache miss、write、fsync 可能失败 |
| 两者都不可达 | 客户端整体不可用 |

失败偏好
“多出一个没人引用的 object”通常比“metadata 已发布但 object 不存在”更可接受。前者是容量泄漏，后者是文件系统正确性问题。

## 12. 与 CephFS / 3FS 的设计对照

| 维度 | JuiceFS | CephFS | 3FS（概念对照） |
| --- | --- | --- | --- |
| Metadata | Community: 外部 DB；Enterprise: Raft Metadata Service | MDS + RADOS metadata pool | 专用 metadata/data service |
| Data | 对象存储 immutable block | RADOS / OSD | 自建 NVMe 数据面 |
| 数据网络 | 对象存储协议 | RADOS/OSD 网络 | 强调 RDMA / 高吞吐 |
| 随机覆盖 | 新 Slice + mapping | 底层对象可变写 | 更偏 immutable / append 思路 |
| 本地缓存 | 非常关键 | 机制不同 | 更强调高速数据面本身 |
| 主要优化目标 | 云对象存储 + POSIX + 成本/容量 | 完整自建分布式存储栈 | AI/HPC throughput |

可以把三者粗略理解为：CephFS 自己实现完整分布式存储栈；JuiceFS 把事务型元数据系统和对象存储组合成文件系统；3FS 更偏围绕 NVMe/RDMA 为 AI workload 优化的数据面。

## 13. 工程实践与排障检查清单

### 13.1 性能问题先判断瓶颈在哪个平面

- Metadata latency 高：重点看 Redis/TiKV/SQL/Raft Leader、事务冲突、open/getattr/lookup QPS。
- Data throughput 低：重点看对象存储 GET/PUT、网络、Block 并发、客户端 buffer、cache hit rate。
- 随机写长期变慢：检查 Slice fragmentation、compaction、对象数量与 metadata amplification。
- write syscall 快但业务 fsync 慢：区分 buffer 接收速度与真正持久化速度。

### 13.2 一致性/HA 问题

- 确认 Metadata Engine 是否只有唯一 writable authority；不要把“有副本”当作“能写”。
- 确认 quorum、Leader、term/epoch、session/fencing 状态，而不只是检查 TCP 是否能连。
- Redis/MySQL failover 必须确保旧 Primary 被 fencing，避免双主。
- 多 zone / 多 Raft group 场景要判断故障是否只影响部分 namespace。
- 对象存储和 Metadata Plane 要分别检查网络可达性；两者故障表现不同。

### 13.3 Rename/Namespace 问题

- Rename 不搬数据，首先检查 dentry/inode transaction，而不是对象存储 COPY。
- 并发 rename 的目录拓扑安全不能只靠事务原子性；关注 ancestor check 与跨客户端 serialization。
- 覆盖 open 文件时检查 sustained/session 状态，避免误判为“inode 已删除就应该读不到”。

### 13.4 热升级问题

- 确认新旧 FUSE options 兼容，否则不能透明复用旧 FUSE connection。
- 确认旧进程能够 FlushAll 并 quiesce；业务太忙时热升级可能主动放弃。
- 确认 /dev/fuse FD、handle state、Metadata SID 三类状态都成功交接。

最终心智模型
JuiceFS 的多数复杂问题都可以先定位到四个对象：① namespace/inode/dentry；② chunk/slice mapping；③ immutable block/object；④ client session/authority。明确“哪一层是事实来源、哪一层只是缓存或副本”，排障会简单很多。

## 附录：参考资料与源码入口

以下资料用于核对本文中的架构与实现细节。源码行为会随版本演进，涉及生产行为时应以实际部署版本对应的 tag/commit 为准。

1. [JuiceFS Community Architecture](https://juicefs.com/docs/community/architecture/)

2. [JuiceFS Community Internals](https://juicefs.com/docs/community/internals/)

3. [JuiceFS Cache Guide](https://juicefs.com/docs/community/guide/cache/)

4. [JuiceFS Cloud / Enterprise Architecture](https://juicefs.com/docs/cloud/introduction/architecture/)

5. [JuiceFS Upgrade / Smooth Restart](https://juicefs.com/docs/community/administration/upgrade/)

6. [GitHub: cmd/mount_unix.go](https://github.com/juicedata/juicefs/blob/main/cmd/mount_unix.go)

7. [GitHub: cmd/passfd.go](https://github.com/juicedata/juicefs/blob/main/cmd/passfd.go)

8. [GitHub: pkg/vfs/handle.go](https://github.com/juicedata/juicefs/blob/main/pkg/vfs/handle.go)

9. [GitHub: pkg/meta/redis.go](https://github.com/juicedata/juicefs/blob/main/pkg/meta/redis.go)

10. [Raft paper](https://raft.github.io/raft.pdf)
