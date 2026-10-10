---
title: "FoundationDB 架构与事务机制"
description: "从事务系统、TLog、Storage Server 和状态分层出发，梳理 FoundationDB 的读写路径、故障恢复及与 TiKV 的差异。"
pubDate: 2026-10-10T12:00:00+08:00
tags:
  - FoundationDB
  - 架构设计
  - 分布式事务
  - TiKV
topic: "foundationdb"
order: 1
draft: false
background: "post-foundationdb-architecture"
---

## FoundationDB 定位与核心设计目标

FoundationDB（FDB）是一个有序分布式 KV 数据库。核心 API 很小：按字典序排列的 key/value、范围读写、原子操作和事务；复杂数据模型通常通过 Layer 在其上构建。与把 SQL、索引、复杂查询下沉到内核不同，FDB 更强调：强事务语义、自动分片、故障恢复、可扩展读写路径以及极少的人工分片运维。

| 能力 | 工程含义 |
| --- | --- |
| Ordered KV | key 按字节序排序，范围扫描是一级能力；数据模型通常通过 key 编码实现。 |
| Strict Serializability | 默认事务既可串行化，又尊重现实时间中的 happens-before。 |
| MVCC + OCC | 读固定 snapshot；写在 commit 时通过 conflict ranges 做乐观冲突检测。 |
| 自动数据分布 | Shard 是 key-range 放置单位，由 Data Distributor 自动拆分、迁移与重复制。 |
| 日志与存储解耦 | Commit 先持久化到 TLogs，再由 Storage Server 异步消费并更新最终 KV。 |
| 角色解耦 | GRV、Commit Proxy、Resolver、TLog、SS、DD、Ratekeeper 可独立横向扩展。 |

对有 TiKV 背景的工程师，一个非常重要的起点是：FDB 的 shard 不是 Raft group，Storage Server replica 也没有 per-shard Leader。读一致性主要靠统一 Read Version + MVCC，写的全局排序/冲突检测由 transaction system 完成，Durability 首先落在 TLog。

## 整体架构与角色

<details class="article-interactive">
  <summary>交互架构图</summary>
  <iframe src="/interactive/foundationdb-architecture.html?embed=1" title="FoundationDB 分域交互架构图" loading="lazy" sandbox="allow-scripts"></iframe>
  <p><a href="/interactive/foundationdb-architecture.html" target="_blank" rel="noopener noreferrer">在新窗口查看完整图示</a></p>
</details>

![FoundationDB 逻辑架构总览](/images/posts/foundationdb-architecture/figure-1.png)

### Worker、Process 与 Role

启动一个 fdbserver 会得到一个 OS 进程。进程内部首先是 Worker 运行时；Worker 通过 cluster file 找到当前 Cluster Controller，注册自己的 locality/process class，并按 CC 的 recruitment 请求启动具体 Role。Role 包括 TLog、Storage Server、Commit Proxy、GRV Proxy、Resolver 等。一个 Worker 在某些配置下可以承载多个角色，尤其是 stateless roles。

> 关键区别：“Worker”是进程级集群参与者；“Role”是该进程内部被招募出来执行某项功能的 actor/服务。不要把 TLog/Resolver 理解成独立二进制。

### 角色职责

| 角色 | 是否通常单活/多实例 | 主要职责 | 持久化状态 |
| --- | --- | --- | --- |
| Coordinator | 3/5 等奇数个 | 多数派协调、选举/授权、保存极小恢复状态 | 本地 durable Generation Register / CoordinatedState |
| Cluster Controller | 单活 | Worker 注册、故障检测、角色招募、Generation recovery | 运行时状态为主，可重建 |
| Master / Sequencer | 单活 | 生成全局 Version，维护 committed frontier | 核心进度通过 recovery 体系保证，不依赖本地 last-version 文件 |
| GRV Proxy | 多实例 | 为事务发放 Read Version；承接 Ratekeeper 限流 | 无关键长期状态 |
| Commit Proxy | 多实例 | 批处理 commit、路由 Resolver/TLog、维护 txnStateStore 物化副本 | txnStateStore 内存 + TLog 关联持久化 |
| Resolver | 多实例 | 按 key range 检查 OCC 冲突，维护短期写历史 | 内存短期状态，recovery 可丢弃 |
| TLog | 多实例 | 持久化 mutation log，按 Tag 建索引，支撑恢复 | DiskQueue/日志磁盘 |
| Storage Server | 大量 | Shard/MVCC、直接服务客户端读、最终 KV 持久化 | Storage Engine |
| Data Distributor | 单活 | Shard 生命周期、数据迁移、恢复副本数 | 关键元数据写 System Keyspace |
| Ratekeeper | 单活 | 观测队列/磁盘/版本落后，动态限制事务入口 | 运行时，可重建 |

## 状态分层：CoordinatedState、DBCoreState、txnStateStore、System Keyspace

![元数据持久化与恢复自举链](/images/posts/foundationdb-architecture/figure-2.png)

### System Keyspace：数据库内部的持久元数据

用户数据与大多数系统元数据最终都作为 KV 保存在 Storage Servers。内部系统 key 主要位于 0xFF（即 \xff/）前缀；典型内容包括 keyServers、serverKeys、serverList、serverTags、数据库配置、数据移动/锁、备份/DR 等。\xff\xff/ 是 Special Key Space，更多是管理/虚拟接口，不应简单等同于直接持久化 key。

### txnStateStore：System Keyspace 的关键子集

当前设计文档明确指出：txnStateStore 只包含 System Keyspace 的关键子集，例如 shard 映射 keyServers、Storage Server tags、serverList、数据库配置、锁/metadata version、TSS/backup 等。它同时存在三种形式：Commit Proxy 内存物化副本、TLogs 中通过 txsTag 保存的 recovery 副本，以及 Storage Server 上最终 System Key 持久状态。

| 位置 | 作用 | 为什么需要 |
| --- | --- | --- |
| Commit Proxy memory | 提交热路径直接做 key→SS/tag 路由 | 不能每次 commit 再去 SS 查 System Key；否则递归且延迟高 |
| TLog txsTag | Transaction System recovery / bootstrap | 恢复时还不知道 System Key 在哪些 SS，需要先从旧日志恢复路由元数据 |
| Storage Server System Keyspace | 完整、最终数据库状态 | 普通事务语义下的长期持久化来源 |

### CoordinatedState 与 DBCoreState

DBCoreState 是“需要保存的内容”，CoordinatedState 是“以 quorum + generation fencing 方式安全保存该内容”的机制。DBCoreState 包含 current/old TLog set、replication policy、recoveryCount、版本/epoch 相关信息等。它会被序列化成 Value，写入多个 Coordinator 的 Generation Register。

每个 Coordinator 使用 OnDemandStore → KeyValueStoreMemory → DiskQueue 持久化 GenerationRegVal；其中不仅有 value，还有 readGen/writeGen。读更高 generation 时也可能发生持久化，用来记住“我已经见过更高 ballot/generation”，防止旧控制者回来覆盖新状态。

> 自举链：cluster file 告诉进程 Coordinators 在哪；Coordinators 的 DBCoreState 告诉 recovery 旧 TLogs 在哪；旧 TLogs 的 txsTag 恢复 txnStateStore；txnStateStore 再告诉新 CP Storage Server/shard 拓扑。

### ServerDBInfo / ClientDBInfo

ServerDBInfo/ClientDBInfo 是当前 generation 的运行时服务目录：包含 Master、Proxy、Resolver、LogSystemConfig 等接口信息。它们不是 System Keyspace，也不是 Coordinator 上的持久 metadata；CC 负责在运行时发布/更新，失败后可由 recovery 重建。ClientDBInfo 中包含 commitProxies、grvProxies，客户端据此做 Proxy 负载均衡。

## 读路径：Read Version、Location Cache 与多副本读取

![客户端读取路径](/images/posts/foundationdb-architecture/figure-3.png)

### Read Version

事务第一次需要读取版本时，会通过 GRV Proxy 获得 Read Version（RV）。RV 表示一个安全的 committed snapshot。一个事务一旦拿到 RV，后续读取都固定使用这个版本，不会按 TTL 自动刷新。事务太长、RV 超出 Storage Server 保留的 MVCC 历史窗口时，会得到 transaction_too_old。官方实现/文档常用约 5 秒作为典型事务窗口。

### Location Cache 与 CP

Client 维护 KeyRange → StorageServer interfaces 的 Location Cache。cache miss 或 stale 时，Client 通过任意可用 Commit Proxy 查询 GetKeyServerLocations；CP 依据自己的 keyInfo/txnStateStore 返回该范围对应的 Storage Team。Client 不按 key range 选择 CP，CP 是全局 commit frontend；真正的 key-range 路由发生在 CP 内部或 Client 的 location cache。

### 从哪个 SS 读

Shard 有多个 Storage Server replica，但没有 per-shard Leader。Client 对这一组接口做负载均衡，通常只请求一个副本；如果首请求变慢，load-balancer 可发第二个 speculative/hedged request。请求包含 RV，因此 SS 只能返回该版本 snapshot；若自己的 applied version 还没追到 RV，则不能用旧值冒充，会触发 future_version/重试。

> 读一致性的核心：不是 quorum read，也不是必须读 Leader，而是“固定 RV + 每个 replica 都按 RV 提供 MVCC snapshot”。

### Read-your-writes

事务内 set/clear 在 commit 前先缓存在客户端。Read-your-writes 的视图可理解为：数据库 RV snapshot + 客户端本地 mutation overlay。因此同一事务能读到自己的未提交写，但其它事务看不到；这不是 dirty read。Snapshot read 默认也可以看到同事务自己的写，snapshot 主要影响 conflict-range 记录。

## 写路径：Commit Proxy、Resolver、TLog 与 ACK 边界

![写提交路径](/images/posts/foundationdb-architecture/figure-4.png)

### Client 端阶段

普通 set/clear 不立即把数据发到 Storage Server；Mutation、read/write conflict ranges 都在客户端事务对象内积累。commit 时整个事务交给一个 Commit Proxy，而不是按 key range 拆给多个 CP。

### Commit Proxy batching 与 Commit Version

Commit Proxy 把多个客户端事务聚合成 batch，并向 Master 请求新的 Commit Version（CV）。同一个 CP batch 内的事务可以共享同一个 64-bit commit version；Versionstamp 还包含 batch 内 transaction order，用于区分同一 CV 内的顺序。Batching 可以摊薄 Master RPC、Resolver RPC、TLog push 与 fsync/网络开销。

### Resolver：OCC conflict detection

CP 将事务的 read/write conflict ranges 按 Resolver 负责的 key range 拆分。概念规则是：若事务 T 的 RV 之后、其 CV 之前已有成功事务写过 T 的 read conflict range，则 T 冲突并 abort。Read-read 不冲突；blind write-write 通常不会直接让当前事务失败，但会成为未来事务的写历史。Range read 形成 range conflict，可保护 phantom。

### TLog durable 之后才 ACK

Resolver 通过后，CP 为 mutations 计算 Storage Tags，并通过进程内 LogSystem 抽象按 tag + replication policy 选择物理 TLog push locations。满足日志复制策略并 durable 后，CP 才向客户端返回 commit success。Storage Server 随后异步从日志消费 mutation，因此“客户端收到成功”并不要求所有 SS 已经把最终 B-tree/LSM 更新完。

> 两个副本层次：TLog replication 保护“已经 commit、但还没有被所有目标 SS apply”的 mutation；Storage replication 是最终 KV 的副本布局。两者是正交的，不是 TLog1 永远对应 SS1。

## RV/CV 与 Strict Serializability

![Read Version、Commit Version 与 committed frontier](/images/posts/foundationdb-architecture/figure-5.png)

### 三个版本量

| 概念 | 含义 |
| --- | --- |
| Master currentVersion | Master 已经分配出去的全局版本前沿；不代表这些 batch 都已 durable。 |
| liveCommittedVersion | 系统已确认成功提交的安全前沿，GRV 以此为基础给客户端 RV。 |
| Transaction RV/CV | RV 固定读 snapshot；成功 commit 时获得 CV，且 RV < CV。 |

版本不是“每个事务 +1”的事务号。Master 生成 monotonically increasing Version，并让其大致跟 wall-clock 时间推进；Commit Proxy 按 batch 获取新 CV。版本允许出现空洞：某个 CV 被分配后 batch 失败，并不会回收重用。

### Strict 的来源

如果事务 A 已经 commit 完成，然后事务 B 才开始，FDB 保证 A.CV ≤ B.RV；而成功的 B 又满足 B.RV < B.CV。因此自然得到 A.CV < B.CV，即版本序列不会把现实时间中已经完成的 A 排到 B 后面。

> A commit success: CV=100<br /><br />B starts later:<br />  RV >= 100<br />  ...<br />  CV > RV<br /><br />Therefore: A.CV < B.CV

### 为什么还需要 OCC

事务可能在 RV=100 读取 snapshot，直到 CV=140 才尝试提交。期间 101~139 可能已经有别的事务成功。如果有人在 (RV,CV] 写过本事务读取的 key/range，则把该事务序列化到 CV=140 会与它实际看到的 snapshot 不一致，因此 Resolver 必须拒绝它。

## TLog、Tag、日志副本与当前演进

![Storage Tag 到 TLog 的 preferred placement 与日志复制](/images/posts/foundationdb-architecture/figure-6.png)

### Tag 是逻辑消费者标识

CP 根据 shard → Storage Team → serverTag 关系给 mutation 加上 tags。Tag 不是 hash(key) 直接算出的 TLog ID，也不是“一个 SS 固定对应一个 TLog”。多个 tag 可以映射到同一 preferred TLog；这是把大量逻辑消费者流分片到较少 TLogs 的正常结果。

### preferred placement + replication policy

当前普通 LogSet 中仍可以看到 bestLocationFor(tag) 一类映射；随后会去重 preferred locations，再调用 locality-aware replication policy 补足副本。例如 tags={1,4,6} 可能 preferred={TLog1,TLog4,TLog1}，去重后只有 {1,4}，若日志策略需要 3 个独立位置，则再补 TLog3。即使三个 tag 都撞到同一个 TLog，replication policy 仍会补足独立日志副本。

### 论文的 broadcast/empty message 与当前实现

论文描述：每个 commit/log message 会发给所有 LogServers；真正选中的日志保存 mutation payload，其它日志收到 empty body，同时 header 带 LSN/previous LSN，用于让每个日志节点都看见连续的版本推进。当前默认路径仍保留类似行为；但当前源码也有 Version-Vector TLog Unicast 能力，用 per-TLog progress 允许只向相关 TLogs 发消息。当前 main 中该 knob 默认仍为 false，因此不能把 unicast 当作 7.3.77 默认生产语义。

> 为什么 empty message 有价值：如果一个 TLog 看到 V100、V120，却不知道 V110 是“没有属于我的 mutation”还是“丢了/没到”，就无法仅靠本地序列判断 gap。广播空 body + prev/version 链解决了这个问题；unicast 则需要额外 version-vector 信息补偿。

### SS 如何从 TLog 读

Storage Server 通过 LogSystemConsumer/peek 以自己的 Tag 消费 mutation stream。它不是遍历每个 TLog 的全部日志，而是根据当前/旧 LogSystemConfig、tag placement、replication topology 构造正确的日志流，必要时从副本/旧 generation 合并或 failover。pop 表示某个 tag 的更旧数据已不再需要，实际物理回收仍受其它恢复/保留约束。

## Storage Server、MVCC 与数据持久化

### SS 的职责与读副本模型

Storage Server 负责一个或多个 key ranges（shards）的副本，直接服务 Client 读。Replica 没有 Leader；Client 按 RV 从某个 replica 读取。SS 接收 mutation 的方式不是 CP 直接写最终引擎，而是从 TLog tag stream 消费并 apply。

### MVCC 窗口

FDB 的在线事务历史窗口很短，官方文档通常描述为约 5 秒。SS 保留最近 mutation/history，使 RV 在窗口内可读；太旧会 transaction_too_old。与 TiKV 依赖 GC safe point、可保留更长历史不同，FDB 的短窗口是它将 Resolver 冲突历史、SS MVCC、TLog retention 和低延迟事务设计结合起来的结果。

### Storage Engine

| 引擎 | 结构 | 适用理解 |
| --- | --- | --- |
| memory | 内存 KV + durable log | 数据必须常驻内存，重启从日志恢复；开发/特定场景。 |
| ssd | 传统 SSD B-tree（历史实现基于 SQLite B-tree） | 成熟兼容的磁盘引擎；三节点部署基线使用它。 |
| ssd-redwood-v1 | FDB 自研 B-tree/Redwood | 目标是更低写放大和更高吞吐，版本/生产策略需结合实际发行说明。 |
| ssd-rocksdb-v1 | RocksDB LSM | 适合需要 LSM/压缩/调优能力的场景，需版本与生产验证。 |

## Shard、Data Distributor 与数据迁移

![Shard 迁移与元数据/数据面协同](/images/posts/foundationdb-architecture/figure-7.png)

Shard 是 key range 的放置/迁移单位，不是共识组。Data Distributor（DD）持续观察大小、负载、失败与 team 健康，决定 split/move/re-replication。关键映射主要由 keyServers/serverKeys 等 System Keys 表达。

### 一个典型 move

1. DD 获得 MoveKeys 相关锁/fencing，并通过 System Key transaction 把目标 range 写入迁移状态。

1. 这些 metadata mutations 通过正常 transaction system 被严格排序，并传播到所有 Commit Proxy 的 txnStateStore。

1. Destination SS 从 source team 拉取基线 snapshot，同时新的 mutations 通过 TLog tag 路由持续到需要的源/目的端。

1. Destination 追平后，DD 再提交 final metadata，使后续路由只指向新的 Storage Team。

这套设计避免了“先改路由还是先拷数据”的二选一问题：通过事务化 metadata + 基线复制 + 增量日志，迁移过程可以持续接受用户写入。

## 故障恢复与 Generation 切换

### 为什么 FDB 不做 per-shard Raft

FDB 将高频数据复制和全局事务排序拆开：Shard replica 不运行独立共识组；TLogs 负责已提交 mutation 的冗余 durability；Coordinators 只保存非常小的恢复/授权状态；Transaction System generation 失败时整体重建新的 Master/Proxy/Resolver/TLog generation。这样避免为海量 shard 维护海量 Raft leader/election 状态，但代价是 recovery 协议与全局 transaction-system 更复杂。

### Transaction System recovery

1. CC 通过 CoordinatedState/DBCoreState 找到旧 LogSystem topology，并对旧 generation 做 lock/fencing。

2. 从旧 TLogs 计算 known committed/recovery boundary。

3. 通过 txsTag 重建 txnStateStore。

4. 招募新的 Master、GRV Proxy、Commit Proxy、Resolver、TLogs，并初始化其 transaction state。

5. 发布新的 ServerDBInfo/ClientDBInfo，使 Worker/Client 切到新 generation；旧 generation 即使进程短暂存活，也不再具有写权威。

### 普通 SS 故障

普通 Storage Server 故障通常不要求完整 transaction-system recovery。已有副本继续服务，Data Distributor 找新的目标重建缺失副本；故障 SS 尚未消费的 mutations 会在 TLogs 上保留，直到系统确认新的副本已承担对应数据范围并可以安全回收。

## 性能与扩展性理解

| 路径/组件 | 如何扩展 | 常见瓶颈信号 |
| --- | --- | --- |
| Reads | Client 直读 sharded SS；增加 SS/机器扩展 | SS CPU/disk/cache、hot range、网络、future_version |
| GRV | 多个 GRV Proxy + batching + Ratekeeper | GRV queue / throttling、Ratekeeper 限速 |
| Commits | 多个 Commit Proxy batching | CP CPU、batch latency、Master/version RPC |
| Conflict checking | 多个 Resolver 按 key range 分片 | 热点 conflict range、resolver CPU、false conflict |
| Durability | 多个 TLogs + replication policy | TLog disk/fsync、queue、版本落后 |
| Storage apply | SS 按 tag 消费 + storage engine | TLog→SS lag、磁盘写、compaction/B-tree cache |
| Data movement | DD 自动迁移 | moving data 长期高、team health、磁盘/网络余量 |

FDB 的性能优势来自“短事务 + 异步 + batch + 读写路径解耦”。同样，这也解释了典型使用约束：事务尽量短、key/value 不宜过大、热点 key/range 需要应用层建模解决、不要把长时间扫描塞进一个事务。

## 与 TiKV 的关键差异

| 维度 | FoundationDB | TiKV（概念对比） |
| --- | --- | --- |
| 分片单位 | Shard = key-range placement unit | Region = key-range + Raft group |
| 副本 Leader | Storage replica 无 per-shard leader | Region 有 Raft Leader |
| 读一致性 | RV + MVCC，从任意合适 SS replica 读 | Leader/lease/read-index 等保证线性化读取（取决模式） |
| 提交协调 | CP batch + Master version + Resolver OCC + TLog | Raft + Percolator 风格事务/锁（TiDB/TiKV 体系） |
| 日志 | 独立 TLog 层，mutation 按 Tag 组织 | Raft log 属于各 Region group |
| 恢复 | Transaction System generation + Coordinators/TLogs | Region 局部 leader election / raft recovery |
| 历史版本 | 在线事务窗口很短（常见约 5s） | MVCC GC 可配置更长历史窗口 |
| 元数据自举 | Coordinator→old TLogs→txnStateStore→SS | PD/TiKV 元数据与 Region/Raft 拓扑体系 |

> 不要强行一一对应：FDB 的 Coordinator 不是 PD，TLog 不是 TiKV Raft log store，Shard 也不是 Region。可以用“角色职责”类比，但不要用“组件名称”做机械映射。
