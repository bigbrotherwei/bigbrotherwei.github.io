---
title: "CephFS 架构与 MDS 故障恢复"
description: "拆解 CephFS 的元数据与数据路径、MDS Journal、Multi-MDS 和故障接管过程。"
pubDate: 2026-10-12T11:00:00+08:00
tags:
  - CephFS
  - 分布式文件系统
  - 故障恢复
topic: "distributed-filesystems"
order: 1
draft: false
background: "post-cephfs-architecture"
---

## 阅读摘要

一句话理解：CephFS 把需要全局协调的命名空间和一致性放在 MDS，把高带宽文件数据传输下沉给客户端与 OSD；其性能与复杂性都源于这种“元数据控制、数据直达”的分层。

| 问题 | 结论 |
| --- | --- |
| 文件数据是否经过 MDS？ | 通常不经过；客户端根据 layout 与 Cluster Map 直接访问 OSD。 |
| Multi-MDS 是否一主一备配对？ | 普通 standby 是共享备用池；standby-replay 才跟随具体 rank。 |
| 故障后怎么知道重放多少？ | 从最早保留的合法 major segment 顺序读取到持久化 Journal 尾部。 |
| 增加 MDS 是否一定提速？ | 只对多客户端、跨目录、可分区的元数据并发更有效。 |
| 最关键的低延迟资源是什么？ | Metadata Pool、MDS CPU/内存，以及稳定的客户端 cap 回收。 |

## 1. CephFS 的定位与设计目标

CephFS 是构建在 RADOS 之上的分布式 POSIX 文件系统。它向应用暴露目录、inode、权限、rename、硬链接、快照等文件系统语义，同时利用 Ceph 的 OSD 集群提供容量、复制、纠删码、恢复与均衡。

- POSIX 风格：普通应用可通过内核挂载或 FUSE 使用。
- 横向扩展：数据带宽主要随 OSD 与网络扩展；元数据并发可通过 Multi-MDS 扩展。
- 故障容忍：MON 维护集群权威状态，OSD 保障对象持久性，MDS Journal 支撑元数据恢复。
- 有状态一致性：MDS、客户端 caps、locks、sessions 共同维持强一致缓存。

## 2. 总体架构与三个平面

```text
应用 / VFS
   │
   ├── 元数据请求 ──► MDS 集群 ──► Metadata Pool（Journal、inode、dentry、dirfrag）
   │                         ▲
   │                         └── MON/MGR：Map、rank、健康、配置
   │
   └── 文件数据 I/O ─► OSD 集群 ──► Data Pool（replicated / EC objects）
```

| 平面 | 组件 | 职责 |
| --- | --- | --- |
| 控制平面 | MON、MGR | 维护 Cluster Map、选举与仲裁、MDS rank 分配、配置和健康状态。 |
| 元数据平面 | Client ↔ MDS ↔ Metadata Pool | 路径解析、inode/dentry、权限、锁、Caps、Journal、Session、快照。 |
| 数据平面 | Client ↔ OSD | 文件对象读写、PG/CRUSH 放置、复制或 EC、恢复和均衡。 |

## 3. 核心组件

### 3.1 MON 与 MGR

MON 保存权威的集群状态与各类 map，并决定哪个 ceph-mds daemon 承担哪个逻辑 rank。MGR 承担监控、模块与管理面能力。客户端和 MDS 都依赖 map epoch 识别当前 OSD、MDS 与拓扑。

### 3.2 MDS

MDS 管理文件系统命名空间与一致性，不承载普通文件数据流。它维护大规模内存元数据缓存（MDCache），处理 inode/dentry 锁、客户端 capabilities、session、多 MDS 子树归属和 Journal。

### 3.3 OSD 与 RADOS

OSD 将对象映射至 PG 并依据 CRUSH 放置。Metadata Pool 与 Data Pool 本质上都是 RADOS pool，但工作负载差异很大：前者偏小对象与低延迟同步提交，后者偏吞吐与容量。

### 3.4 客户端

| 客户端 | 特点 | 适用 |
| --- | --- | --- |
| Kernel Client | 集成 VFS/page cache，性能和透明性较好；能力受内核版本影响。 | 生产挂载、通用应用。 |
| ceph-fuse | 用户态实现，部署调试方便；通常有更多上下文切换。 | 快速迭代、功能验证、特定环境。 |
| libcephfs | 应用直接调用 CephFS API。 | 数据库、网关或自研服务集成。 |

## 4. 文件数据布局与对象映射

文件被切分为条带单元并映射到 RADOS objects。关键 layout 参数包括 stripe_unit、stripe_count 与 object_size。对象再通过 pool、PG 与 CRUSH 映射到具体 OSD。

```text
file offset
   ↓ layout(stripe_unit, stripe_count, object_size)
RADOS object name
   ↓ hash → PG
CRUSH placement
   ↓
Primary OSD + replicas / EC shards
```

工程判断：条带并非越多越好。过度条带化会增加小 I/O 分散、对象数量、PG/OSD 操作数，以及恢复与 scrub 成本。大文件并行吞吐与小文件/随机写延迟需要分别设计。

## 5. Metadata Pool 保存什么

- inode、dentry、directory fragment（dirfrag）与 xattr
- MDS Journal 与日志段元数据
- Client Session、Open File Table 及请求恢复状态
- InoTable、SnapTable、MDS subtree map
- Purge Queue 与其他可恢复控制状态

### 5.1 大目录与 dirfrag

大型目录可拆成多个 dirfrag，每个 dirfrag 通常落在独立的 RADOS 元数据对象中，目录项可由 OMAP 保存。dirfrag 能降低单对象压力并支持不同 MDS 管理目录片段，但目录 inode 锁、热点 dentry 或单线程调用仍可能形成瓶颈。

```text
directory inode
 ├── dirfrag 0 → metadata object / OMAP
 ├── dirfrag 1 → metadata object / OMAP
 └── dirfrag N → metadata object / OMAP
```

### 5.2 默认 Data Pool 的特殊性

默认 data pool 还承载 inode backtrace 等恢复信息。即便大文件数据放入其他 pool 或 EC pool，默认 data pool 仍应保留，通常建议使用 replicated pool。

## 6. MDS 内存缓存与线程/执行模型

MDS 的热点路径通常先命中 MDCache，而非每次访问 RADOS。缓存对象包括 CInode、CDentry、CDir/dirfrag、locks、client caps 和 subtree ownership。对热点元数据，处理路径可简化为 Client → MDS memory → Client。

| 执行域 | 主要工作 | 常见等待点 |
| --- | --- | --- |
| Messenger/网络事件 | 接收客户端、MDS、MON、OSD 消息并分派。 | 网络、消息队列、调度拥塞。 |
| MDS 主状态机 | 路径遍历、锁、caps、session、subtree 状态变更。 | 锁冲突、跨 MDS 协调、cap recall。 |
| Journal 提交 | 编码事件并等待 metadata pool 持久化。 | OSD 尾延迟、PG 状态、复制提交。 |
| 后台维护 | 元数据刷回、trim、cache 回收、purge。 | 脏对象、客户端不归还 caps、删除积压。 |

线程模型说明：Ceph 版本与实现细节会演进，不能把 MDS 简化成“一个请求对应一个线程”。更准确的性能模型是：消息驱动的状态机串联缓存、锁、Journal 与异步 RADOS 完成事件；关键延迟往往来自串行一致性点，而不是线程数量本身。

## 7. Capability：客户端缓存一致性的核心

MDS 将 inode 的特定缓存与访问权授予客户端，允许客户端缓存属性、文件内容、缓冲写、延迟更新 size/mtime。这样 read/write/stat 不必每次都访问 MDS。

```text
Client A 持有写/缓冲 Cap
Client B 请求冲突读 Cap
        ↓
MDS recall/revoke A 的冲突 Cap
        ↓
A flush dirty data + cap flush/ack
        ↓
MDS 降级 A，并授予 B 读 Cap
```

若客户端网络分区或长期不响应，MDS/MON 可将其加入 OSD blocklist，完成 fencing：先隔离旧客户端，再向其他客户端授予冲突权限。

## 8. 关键操作路径

### 8.1 读文件

1. 客户端解析路径；缓存不命中时向权威 MDS 请求 inode、layout 与读 cap。
1. 客户端根据 layout 和 OSD Map 计算目标对象及 Primary OSD。
1. 数据从 OSD 直接返回客户端并进入 page cache；MDS 不转发普通数据。

### 8.2 写文件

1. 客户端向 MDS 获取写相关 cap；MDS 必要时先 recall 其他客户端的冲突 cap。
1. 应用 write() 通常先写 page cache。
1. 回写线程通过 librados/messenger 将对象操作发往 Primary OSD。
1. 复制池等待相应副本持久化；EC pool 完成编码分片写入。
1. size、mtime 等可能先由客户端维护，之后通过 cap flush 在 close、fsync 或 recall 时收敛。

### 8.3 创建文件

```text
Client → MDS: create /dir/a
MDS: 权限检查 + dentry/inode 锁 + 分配 inode
MDS → Metadata Pool: Journal event durable
MDS → Client: inode + layout + Caps
Client → Data Pool: file objects
MDS → Metadata Pool: 后台刷回 inode/dentry backing objects
```

### 8.4 rename

同一 authority 内的 rename 由单个 MDS 协调相关 inode/dentry 锁并写 Journal。跨 authority rename 需要两个 MDS 的分布式锁和可恢复协调状态，明显更昂贵；balancer 会尽量避免把强关联热点随意拆开。

### 8.5 unlink 与 Purge Queue

逻辑 unlink 先从命名空间移除 dentry，再把数据对象删除工作加入 Purge Queue 后返回。大文件可能对应成千上万个对象，因此空间释放晚于文件不可见是正常现象；删除速率长期高于 purge 处理速率会形成 backlog。

## 9. MDS Journal：WAL 式元数据持久化

很多元数据操作会同时影响 inode、dentry、dirfrag、link count、时间戳与 subtree 状态，无法依赖一个 RADOS object 原子写完成。MDS 先把可重放事件追加到 Journal，等待其持久化后确认请求，再异步将最终状态刷回 backing objects。

| 持久层 | 含义 | 恢复作用 |
| --- | --- | --- |
| Journal | 操作已经确认并可重建。 | 宕机后按顺序重放，恢复尚未刷回状态。 |
| Metadata backing store | inode、dentry、dirfrag 等最终对象状态。 | 已经安全刷回的日志段可过期并 trim。 |

## 10. Journal 分段、过期与 trim

Journal 逻辑上按 LogSegment 划分。一个 segment 只有在它引用的所有恢复依赖都已经安全收敛后才可 expired，例如 inode/dentry 已刷回、跨 MDS 事务已完成、session/table 状态可遗忘。Journal 通常按前缀回收，因此一个老 segment 的阻塞依赖会挡住后续 trim。

```text
[ 已删除 ][ 最早保留 major segment ][ 未刷回/恢复所需事件 ][ 持久化尾部 ]
           ↑ replay_start                              ↑ replay_end/write_pos
           └── 首事件通常提供 ESubtreeMap 等基础恢复状态
```

## 11. 故障后如何确定重放多少

核心结论：MDS 不按宕机时间或请求数量猜测。它读取 Journal header/位置元数据，从最早保留的合法 major segment 顺序扫描到故障前已经持久化的有效尾记录。

1. Standby 接管故障 rank，读取该 rank 的 Journal header 与位置。
1. 定位第一个保留的合法 major segment；第一段通常包含 ESubtreeMap，以恢复 subtree authority 基础状态。
1. 按事件顺序解码并重建 inode、dentry、session、open file、table transaction 与跨 MDS 状态。
1. 读取到持久化 Journal 尾部；不完整或无效尾记录不作为已提交事件执行。
1. 随后进入 resolve、reconnect、rejoin、clientreplay 等阶段，最终转为 active。

| 边界 | 由什么决定 | 注意点 |
| --- | --- | --- |
| replay_start | Journal 保留/expire 位置与合法 major segment。 | 扫描量可能大于真正未刷回的操作量。 |
| replay_end | 故障前已持久化的有效 Journal 尾部。 | 预分配空间或半条尾记录不会被当作完整事件。 |
| 实际重放量 | replay_end − replay_start。 | 受 metadata 延迟、脏缓存、trim 阻塞和 major segment 间隔影响。 |

## 12. MDS 故障恢复状态机

```text
Active MDS 故障
   ↓ MON 检测 beacon 超时并分配 rank
Standby 接管
   ↓ replay：重放本 rank Journal
resolve：与其他 MDS 解决未完成分布式操作
   ↓ reconnect：客户端报告 session/caps
rejoin：恢复分布式 metadata cache
   ↓ clientreplay：处理未确认客户端请求
active：恢复正常服务
```

客户端重连不可省略，因为部分最新状态可能只存在于客户端：持有的 capabilities、打开文件、脏元数据以及已发送但未明确收到确认的请求。CephFS 的恢复因此不仅是服务端日志重放，也是分布式有状态缓存的重新收敛。

## 13. Multi-MDS 架构

max_mds 决定 active rank 数量。多个 active MDS 对目录命名空间做动态子树分区：某个 MDS 对子树 authoritative，其他 MDS 可缓存 replica；系统可根据热度执行 subtree export/import、dirfrag split/merge 与 authority migration。

```text
/  (MDS.0)
├── home      (MDS.0)
├── project   (MDS.1)
│   ├── a     (MDS.1)
│   └── b     (MDS.3)
└── data      (MDS.2)
```

| 更适合 | 不一定有效 |
| --- | --- |
| 大量客户端并发访问不同目录 | 单客户端串行元数据操作 |
| 多租户、批量创建/扫描/删除 | 请求集中在同一个热点目录 |
| 业务目录天然可分区 | 瓶颈在 Metadata Pool 或 OSD |
| 独立子树上的高并发 | 大文件吞吐瓶颈 |

## 14. Standby 与 standby-replay

rank 是逻辑服务槽位，daemon 是具体 ceph-mds 进程。普通 standby 不固定绑定某个 rank，而是共享备用池；故障后由空闲 daemon 接管具体 rank。

| 模式 | 绑定关系 | 恢复方式 | 代价 |
| --- | --- | --- | --- |
| 普通 standby | 可接管任意 rank | 接管后开始读取该 rank Journal。 | 资源较省，RTO 相对长。 |
| standby-replay | 持续跟随一个具体 active rank | 不断重放 Journal，保持接近尾部与较热缓存。 | 更多内存与 metadata pool 读带宽。 |

| 配置示例 | 故障容忍能力 |
| --- | --- |
| 3 active + 0 standby | 无 MDS 进程级接管能力。 |
| 3 active + 1 standby | 可立即接管一次 active 故障；接管后备用池为空。 |
| 3 active + 2 standby | 可承受两个进程先后故障。 |
| 3 active + 3 standby-replay | 更接近每个 rank 有一个热跟随者，但成本更高。 |

## 15. standby-replay 的追日志逻辑

standby-replay 持续读取特定 rank 的 Journal，并维护自己的 replay position。若 active write position 为 10 GB，而 follower 已处理至 9.98 GB，故障后只需追赶约 20 MB，再完成 resolve/reconnect 等接管阶段。它不是简单复制日志文件，而是持续应用事件并维护可接管的内存状态。

限制：standby-replay 加快 replay，但不能消除客户端 reconnect、跨 MDS resolve、map 更新或 fencing 等恢复阶段；实际 RTO 仍取决于客户端规模、未完成操作和 metadata pool 尾延迟。

## 16. 一致性语义与多客户端共享写

CephFS 通过 MDS locks、caps、dentry leases、Journal、distributed locks、sessions、OSD 一致性与 blocklist 组合提供强 POSIX 风格语义。多客户端交替写同一文件会触发 cap ping-pong：recall → flush → grant 不断往返，通常无法靠增加 MDS 或 OSD 线性解决。

## 17. 快照与镜像

CephFS 支持目录级快照，MDS 维护命名空间版本边界，底层利用对象 copy-on-write/clone 相关能力保留旧数据。cephfs-mirror 可将目录快照异步复制到另一 CephFS，属于异步灾备，而非同步双活。

## 18. 数据池设计：复制与纠删码

| 场景 | 推荐池 | 原因 |
| --- | --- | --- |
| Metadata Pool | NVMe/SSD replicated | 低尾延迟、同步 Journal、频繁小更新。 |
| 默认 Data Pool | SSD replicated | backtrace、小文件、恢复信息与覆盖写更友好。 |
| 大文件/归档 | HDD 或 SSD EC | 容量效率高，适合顺序与较大 I/O。 |
| 小文件/随机覆盖写 | SSD replicated | 避免 EC 读改写和小 I/O 放大。 |

## 19. 性能瓶颈与诊断

| 现象 | 常见根因 | 优先检查 |
| --- | --- | --- |
| create/rename/unlink 尾延迟高 | Metadata Pool Journal durable 慢。 | OSD commit/apply latency、PG 状态、设备类、网络。 |
| MDS 内存持续超目标 | caps 无法回收、热点/扫描工作集过大。 | client recall health、cap 数、cache trim。 |
| 增加 MDS 无收益 | 热点集中或客户端串行。 | 子树分布、dirfrag、客户端并发与目录结构。 |
| 故障切换慢 | Journal 大、trim 落后、客户端 reconnect 慢。 | log segments、replay 状态、session 数、standby-replay。 |
| 删除后空间迟迟不释放 | Purge Queue backlog。 | purge 队列、对象删除吞吐、OSD 压力。 |
| 共享文件吞吐抖动 | 多客户端 cap ping-pong。 | cap recall/flush、应用写入模型。 |

## 20. 容量与扩展维度

| 瓶颈 | 扩展或优化方向 |
| --- | --- |
| 容量不足 | 增加 OSD，检查 CRUSH 与 PG 分布。 |
| 大文件吞吐不足 | 增加 OSD/网络并发，校准条带与对象大小。 |
| 元数据 IOPS 不足 | 增加 active MDS，并让目录负载可自然分区。 |
| 元数据延迟高 | Metadata Pool 使用低延迟 replicated 设备。 |
| MDS cache 不足 | 增加内存，减少全量扫描和无界 client caps。 |
| 单热点目录 | 业务目录分片、dirfrag、减少共享命名空间热点。 |
| 切换 RTO 过长 | standby-replay、及时 trim、低延迟 Metadata Pool。 |

## 21. 运维配置与观察要点

```bash
# active rank 数
ceph fs set <fs_name> max_mds 3

# 期望维持的普通 standby 数
ceph fs set <fs_name> standby_count_wanted 1

# 查看文件系统与 MDS 状态
ceph fs status
ceph mds stat
ceph health detail
```

- 生产环境把 active 数和 HA 余量分开计算；max_mds=3 并不自动意味着还有备用进程。
- Metadata Pool 与普通数据池分设备类/容量规划，优先保障尾延迟。
- 关注 MDS_TRIM、CLIENT_RECALL、damage、laggy、replay/reconnect 长时间停留等健康信号。
- 变更 max_mds、目录 pinning 或 standby-replay 前先确认客户端、MDS 内存和 metadata pool 带宽余量。

## 22. CephFS 与 NFS、HDFS、本地文件系统

| 维度 | CephFS | NFS | HDFS |
| --- | --- | --- | --- |
| 数据路径 | 客户端直达多个 OSD。 | 通常经过 NFS Server。 | 客户端访问 DataNode。 |
| 元数据 | 有状态 MDS，可 Multi-MDS。 | Server 统一处理。 | NameNode 为核心。 |
| 语义 | POSIX 风格、随机写、rename。 | POSIX 风格但缓存一致性依实现/挂载。 | 偏大文件与流式/追加。 |
| 扩展特点 | 数据面和元数据面分别扩展。 | 受 server/HA pair 架构约束。 | 吞吐扩展强，小文件成本高。 |

## 23. 典型设计建议

1. Metadata Pool 使用低延迟 replicated pool，并避免与大吞吐恢复流量争抢设备。
1. 默认 Data Pool 保持 replicated；大文件目录通过 layout 指向独立 EC pool。
1. Multi-MDS 前先把业务目录设计成可分区结构，避免所有请求挤在单目录。
1. 以故障容忍次数配置普通 standby；只有明确需要更短 RTO 时再引入 standby-replay。
1. 同时监控 Journal segment/trim、MDS cache/caps、purge backlog 与 OSD 尾延迟。
1. 对共享写热点优先改应用写入模型，不把加 MDS 当作通用解法。

## 24. 核心结论

设计本质：CephFS 通过 MDS 管理全局命名空间与缓存一致性，通过客户端直连 OSD 获得数据面扩展性。

- 普通 standby 是多个 active rank 的共享备用池，不是固定一主一备。
- standby-replay 跟随特定 rank，并通过持续应用 Journal 缩短 replay 追赶时间。
- 恢复起点来自最早保留的合法 major segment，终点来自故障前已持久化的有效 Journal 尾部。
- Journal replay 结束后仍需 resolve、reconnect、rejoin 与 clientreplay，才能安全 active。
- CephFS 的扩展上限常由一致性热点决定：热点目录、cap ping-pong、metadata pool 尾延迟比“节点数”更关键。

## 附录 A：术语速查

| 术语 | 含义 |
| --- | --- |
| rank | CephFS 中的逻辑 MDS 服务槽位。 |
| daemon | 实际运行的 ceph-mds 进程，可接管 rank。 |
| authority | 对某个 inode/dirfrag/subtree 拥有修改权的 MDS。 |
| capability / cap | MDS 授予客户端的缓存与访问权限集合。 |
| dirfrag | 目录元数据分片。 |
| major segment | 包含足够基础恢复状态（如 subtree map）的 Journal 段。 |
| expire/trim | 确认 backing state 安全后推进日志回收边界。 |
| fencing/blocklist | 隔离旧客户端，避免其继续访问 OSD 破坏一致性。 |

## 附录 B：参考资料

- [CephFS Architecture](https://docs.ceph.com/en/latest/cephfs/)
- [Distributed Metadata Cache](https://docs.ceph.com/en/latest/cephfs/mdcache/)
- [MDS Journaling](https://docs.ceph.com/en/latest/cephfs/mds-journaling/)
- [Multiple Active MDS](https://docs.ceph.com/en/latest/cephfs/multimds/)
- [MDS Standby](https://docs.ceph.com/en/latest/cephfs/standby/)
- [CephFS Health Messages](https://docs.ceph.com/en/latest/cephfs/health-messages/)
- [Purge Queue](https://docs.ceph.com/en/latest/cephfs/purge-queue/)
- [Cache Configuration](https://docs.ceph.com/en/latest/cephfs/cache-configuration/)
