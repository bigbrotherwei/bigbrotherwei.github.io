---
title: "FoundationDB 三节点集群性能实测"
description: "展示特定三节点集群的 get、put、scan 和删除测试结果，并说明吞吐口径、内存瓶颈及测试边界。"
pubDate: 2026-10-10T09:00:00+08:00
tags:
  - FoundationDB
  - 性能测试
  - 集群实践
topic: "foundationdb"
order: 4
draft: false
background: "post-foundationdb-three-node-performance"
---

以下数据仅对应文中的版本、硬件、配置和测试方法，不应视为 FoundationDB 的通用性能上限。

## 集群配置

FoundationDB 7.3.77；3 台主机、15 个 fdbserver；double 副本策略，SS / TLog 均使用 ssd-2，1 个可用 Region。客户端与数据库同机运行。

| 节点 | 管理地址（已脱敏） / 内网地址 | zone / machineid |
| --- | --- | --- |
| A | SSH_HOST_A / 10.0.0.11 | node-a |
| B | SSH_HOST_B / 10.0.0.12 | node-b |
| C | SSH_HOST_C / 10.0.0.13 | node-c |

每台：4 vCPU（Xeon Cascadelake）、7,933 MiB 内存、无 swap；合计 12 vCPU、约 23.24 GiB 内存。

| 用途 | 数据目录 | 磁盘情况（每节点） |
| --- | --- | --- |
| SS | /data1/foundationdb/4500 | /dev/vdc，500 GiB；ext4 仍约 20 GiB |
| 活动 TLog | /data/foundationdb/4510 | /dev/vdb，500 GiB；ext4 仍约 20 GiB |
| 备用 TLog | /data/foundationdb/4501 | 与活动 TLog 共用 /data |

磁盘仅识别为 VirtIO，底层 SSD/NVMe 型号及云盘 IOPS 配额未确认。

| 每台端口 | 有效 class | 实际角色 | 内存上限 |
| --- | --- | --- | --- |
| 4500 | storage | 1 个 SS | 1536 MiB |
| 4501 | log | 空闲 TLog 候选 | 1536 MiB |
| 4502 | stateless | Coordinator 与控制角色 | 768 MiB |
| 4503 | commit_proxy | 1 个 CP | 768 MiB |
| 4510 | log | 1 个活动 TLog | 1536 MiB |

合计 3 SS、3 活动 TLog、3 CP、3 Coordinator、1 GRV、1 Resolver；另有 3 个空闲日志候选。每进程缓存 256 MiB，每台进程内存限额合计 6144 MiB。

4502 控制角色分布：A 为 CC；B 为 GRV Proxy；C 为 Master、DD、Ratekeeper、Consistency Scan、Resolver。三个 4502 同时担任 Coordinator。

## 测试结果

value 均为 1 KiB；get / put / scan 使用 1,048,576 条数据（value 合计 1 GiB）。表内并发为三台客户端合计，QPS 按成功请求或提交事务计数。

| 操作 | 总并发 | QPS | P99 ms | 测量范围 |
| --- | --- | --- | --- | --- |
| get 单 key | 768 | 40,136 | 43.9 | 60 秒 |
| get 单 key | 96 | 30,201 | 7.7 | 30 秒，较低延迟 |
| scan 100 条 | 96 | 2,811 | 63.7 | 60 秒；约 28.1 万条/秒 |
| put 单 key | 限速 | 2,100 | 5.8 | 180 秒，队列稳定 |
| put 单 key | 96 | 7,264 | 55.7 | 30 秒峰值，队列积压 |
| delete 单 key | 3 | 1,247 | 4.2 | 6 万条，48.10 秒 |
| delete 单 key | 24 | 6,821 | 6.5 | 60 万条，87.97 秒 |
| delete 单 key | 96 | 16,688 | 11.0 | 60 万条，35.95 秒 |
| delete 范围 100 条 | 24 | 6,174 | 7.8 | 6,000 事务，0.972 秒 |
| delete 范围 1000 条 | 24 | 2,645 | 12.2 | 600 事务，0.227 秒 |

结果口径：put 的 2,100 QPS 是已验证 3 分钟稳定点，不是精确上限；2,700 QPS 时队列持续增长。delete 为有限批次，尤其范围删除不足 1 秒，只能表示本批次提交速度，不能当作持续容量或物理磁盘删除速度。全部已完成的正式客户端结果均为 0 错误、0 显式重试；服务端重启见后文。

磁盘升级效果：相同总并发 384，get 从 6,196 提升到 37,086 QPS，约 6 倍；P99 从 187.2 ms 降至 22.0 ms。升级前后块设备容量分别为 20 / 500 GiB。

### 瓶颈判断

| 操作 | 首先暴露的限制与证据 |
| --- | --- |
| get | SS CPU 达 0.80–0.87 核，整机 CPU 约 73%–80%；增加客户端后仍仅小幅增长。CPU 与同机客户端竞争明显，尚不能唯一归因。 |
| scan | SS 数据盘约 2.67 万 IOPS、104 MiB/s，忙碌接近 100%；提高并发吞吐不再增长，SS 磁盘 I/O 平台明显。 |
| put / delete | SS 后台持久化积压与内存余量首先出现问题。短时提交速度高于消化速度；不能仅凭磁盘忙碌断言云盘配额耗尽。 |

## 测试步骤

① 记录环境：采集各节点配置、角色、磁盘与内存；保存 status details / status json。由控制机分别 SSH 到 A/B/C，无需节点之间免密。

```text
fdbcli --exec "status details"
fdbcli --exec "status json"
cat /etc/foundationdb/foundationdb.conf
lsblk -o NAME,SIZE,ROTA,MODEL,MOUNTPOINTS
df -h /data /data1; free -m
```

② 装载并核验：读写测试建立 1 GiB 数据集；删除测试每轮使用独立前缀并确认目标全部存在。装载后等待健康、队列与持久化滞后回落，避免把装载积压混入测试。

③ 三节点同步压测：原生 C++ 客户端链接 libfdb_c（API 730）。get / put 每事务处理一个 key；scan 每事务返回连续 100 条；均匀随机访问，不清冷缓存。阶梯预热 10 秒、测量 30 秒，读复测 60 秒、限速写复测 180 秒。

```text
g++ -O3 -std=c++17 -pthread bench.cpp -lfdb_c -o fdbbench
# 各节点同时执行；32 线程/节点，对应总并发 96
./fdbbench get 32 60 10 1048576 101
./fdbbench scan 32 60 10 1048576 103
```

④ 删除补测：每轮重新装载，随机且不重复地分配目标，clear / clear_range 后等待提交，再验证整个前缀为空。三客户端总事务数除以最慢客户端耗时得到批次 QPS；范围删除每事务分别处理 100 / 1000 条。

⑤ 汇总与检查：合并客户端延迟直方图（0.1 ms 精度），同时采集 CPU、磁盘、SS 队列、持久化滞后与重启日志；等待恢复后再进入下一轮。最终全量核验原 1,048,576 条数据，确认删除前缀为空。

## 问题与测试后状态

SS 内存不足：1536 MiB 限额下，初次批量装载造成三个 SS 重启；升级后高并发 put 又触发 C 重启。删除补测预装载时 A/B 各重启两次，正式删除计时窗口内未见对应重启。日志为 OutOfMemory / 退出码 20，进程由 fdbmonitor 自动拉起。

提交快于落盘：delete 总并发 96 的提交结束时，SS 最大队列约 430 MiB、滞后约 35 秒；约 147 秒后确认恢复（含采样等待）。删除前缀为空不代表数据文件立即缩小。

容量与适用范围：云盘已扩到 500 GiB，文件系统仍约 20 GiB。结果来自同机客户端、1 GiB 数据和短时单接口负载，不能直接作为更大数据集或混合业务的 SLA。后续应在可用主机内存范围内调整 SS 限额，再做更长稳态复测。

结束快照（10 月 10 日 11:50–11:51）：15 个进程在线，available / healthy 为 true；自动数据分布状态 healthy_repartitioning，仍有约 23 MB 搬迁。数据核验通过，压测与采集进程已停止。本报告为当时记录，并非当前实时状态。

测试脚本和完整日志暂不公开；上述指标应结合测试步骤与环境配置一起解读。
