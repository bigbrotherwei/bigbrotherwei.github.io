---
title: "FoundationDB 三节点集群从零部署"
description: "记录 FoundationDB 7.3.77 三节点实验集群的环境规划、安装、数据盘配置、初始化和持续业务测试。"
pubDate: 2026-10-10T11:00:00+08:00
tags:
  - FoundationDB
  - 集群部署
  - 运维实践
topic: "foundationdb"
order: 2
draft: false
background: "post-foundationdb-three-node-deployment"
---

这是特定版本和实验环境的实测记录。命令使用示例地址与示例集群标识，执行前必须按自己的环境核对。

## 实测结果与使用边界

| 项目 | 结果 |
| --- | --- |
| 初始部署 | 3 台机器，每台 SS 4500、TLog 4501、无状态 4502，共 9 个进程 |
| 在线扩容 | 每台增加 4503，共 12 个进程；随后设置专用 CP class，实现 3 个实际 CP |
| 备用池 | 每台增加 4510，共 15 个进程；最终 6 个 log class 候选，3 活动加 3 候选 |
| TLog 接管 | 关闭 B 的活动 TLog 40 秒并暂停其 monitor；修正 class 后新一代 TLog 自动招募到各机 4510 |
| SS 自愈 | C 的 SS 被 SIGKILL 后自动拉起，PID 2113 → 2202 |
| 数据核验 | 18,018 个确认操作均存在；去重标记、转账计数和账户总额全部一致 |
| 业务影响 | 扩容最大成功提交间隔 0.194 秒；正确备用接管 4.434 秒；SS 重启 0.055 秒 |

这些是约 8.5 分钟、两个并发工作线程、每轮休眠 50 ms 的轻量功能测试结果，不是容量压测或可用性 SLA。成功提交间隔包含客户端调度与测试间隔，不能直接等同于精确服务器恢复时间。本次验证进程级故障，未执行整机断电、磁盘损坏或跨机房容灾。

三台主机各约 8 GB 内存。为容纳每机 5 个进程，SS/TLog 限额 1536 MiB，无状态和 CP 限额 768 MiB，每机合计 6 GiB。status details 保留低于建议 4 GB/进程的提示；这是学习环境的资源配置，不能据此承诺生产负载能力。

## 主机与最终角色规划

| 节点 | 控制机 SSH 地址 | FDB 内网地址 | machineid 和 zoneid |
| --- | --- | --- | --- |
| A | SSH_HOST_A | 10.0.0.11 | node-a |
| B | SSH_HOST_B | 10.0.0.12 | node-b |
| C | SSH_HOST_C | 10.0.0.13 | node-c |

控制机以 opsuser 用户分别 SSH 到三个公网地址，再使用 sudo 操作。所有 FDB 协议通信使用内网地址；整个流程不需要三个 Node 之间互相免密 SSH，也不需要从 A scp 到 B/C。

```text
ssh -o BatchMode=yes opsuser@SSH_HOST_A
ssh -o BatchMode=yes opsuser@SSH_HOST_B
ssh -o BatchMode=yes opsuser@SSH_HOST_C
```

| 端口 | 最终有效 class | 数据目录 | 最终承担角色 |
| --- | --- | --- | --- |
| 4500 | storage | /data1/foundationdb/4500 | 每机 1 个 SS |
| 4501 | log | /data/foundationdb/4501 | 故障恢复后的空闲 TLog 候选 |
| 4502 | stateless | /var/lib/foundationdb/data/4502 | Coordinator 与其他无状态角色 |
| 4503 | commit_proxy | /var/lib/foundationdb/data/4503 | 每机 1 个 CP |
| 4510 | log | /data/foundationdb/4510 | 演练后每机 1 个活动 TLog |

double 表示副本策略，不能把 Desired Logs=3 理解为三副本。此处 SS 与日志配置均为 ssd-2，double 使用两个不同 zone 的副本。3 个 zone 各对应一台真实机器；同一台机器上的所有进程使用相同 zone，不能人为伪造多个独立故障域。

没有名为 standby 的专用 class。备用 fdbserver 是已启动、已加入集群、具备合适 class 且暂未承担目标角色的候选。它可能在后续恢复中变成活动进程；旧活动进程恢复后也可能继续空闲。角色分配以 status json 为准。

## 下载与安装

三台机器分别执行下列下载命令。安装包版本锁定 7.3.77-1 amd64，避免跨版本引入差异。执行器通过控制机 SSH 的标准输入传递脚本，完整传输命令记在每个 evidence 文件中。

```text
set -eux
mkdir -p /tmp/fdb-deploy-packages
cd /tmp/fdb-deploy-packages
for pkg in clients server; do
  curl --fail --location --retry 3 --connect-timeout 20 -o "foundationdb-${pkg}_7.3.77-1_amd64.deb" "https://github.com/apple/foundationdb/releases/download/7.3.77/foundationdb-${pkg}_7.3.77-1_amd64.deb"
  dpkg-deb -f "foundationdb-${pkg}_7.3.77-1_amd64.deb" Package Version Architecture
done
sha256sum *.deb
```

| 包 | 三台机器一致的 SHA256 |
| --- | --- |
| clients | b6c263723009bddbc30b6ae8cf9854340bd35cef14152abb0da8fb5af2b91254 |
| server | 789f1ed4cbacc0fd7043da2217c9e57516e4ec94fa7140853ec22a7e715785cc |

安装前预置同一 cluster file，并临时使用 policy-rc.d 禁止安装脚本自动启动服务。否则安装包可能创建默认单机库，之后仅替换 cluster file 会遇到已有数据属于其他集群的问题。以下是纠正后的复现命令；实际执行中的旧连接串及修正过程见第 11 节和原始流水。

```text
set -eux
test ! -e /usr/sbin/policy-rc.d
printf '#!/bin/sh\nexit 101\n' | sudo tee /usr/sbin/policy-rc.d >/dev/null
sudo chmod 0755 /usr/sbin/policy-rc.d
trap 'sudo rm -f /usr/sbin/policy-rc.d' EXIT
sudo install -d -m 0755 /etc/foundationdb
# Installer must not create and initialize a separate default cluster.
printf '%s\n' 'fdbdemo:replacewithuniqueid@10.0.0.11:4502,10.0.0.12:4502,10.0.0.13:4502' | sudo tee /etc/foundationdb/fdb.cluster
cd /tmp/fdb-deploy-packages
sudo dpkg -i foundationdb-clients_7.3.77-1_amd64.deb foundationdb-server_7.3.77-1_amd64.deb
dpkg-query -W foundationdb-clients foundationdb-server
fdbcli --version
if pgrep -x fdbserver; then echo 'ERROR installer unexpectedly started fdbserver'; exit 1; fi
sudo ls -lah /var/lib/foundationdb/data
```

安装验证：三个节点 clients/server 均为 7.3.77-1，fdbcli --version 为 7.3.77，安装完成时没有自动启动 fdbserver。A 首次使用 systemctl mask 阻止自启动导致安装收尾失败，随后 unmask 并使用临时 policy-rc.d 执行 dpkg --configure 完成修正。

实测记录 02a-repair-install-A；控制机 UTC 2026-10-09T10:47:01.302390+00:00；退出码 0；用时 0.80 秒。

实测记录 02-install-B；控制机 UTC 2026-10-09T10:47:04.923585+00:00；退出码 0；用时 2.92 秒。

实测记录 02-install-C；控制机 UTC 2026-10-09T10:47:08.849739+00:00；退出码 0；用时 2.88 秒。

## 数据盘与完整基线配置

已挂载的 /data 是 /dev/vdb，/data1 是 /dev/vdc，均为独立 ext4 盘。TLog 的持久数据、queue 等都由其 datadir 控制，放到 /data；SS 的引擎文件放到 /data1。logdir 是诊断 trace 日志目录，不是 TLog 的持久数据目录。

```text
mountpoint -q /data
mountpoint -q /data1
sudo install -d -o foundationdb -g foundationdb -m 0750 /data/foundationdb /data1/foundationdb /var/log/foundationdb
sudo install -d -o foundationdb -g foundationdb -m 0700 /data/foundationdb/4501 /data1/foundationdb/4500 /var/lib/foundationdb/data/4502
```

三个节点 /etc/foundationdb/fdb.cluster 内容必须完全一致：

```text
fdbdemo:replacewithuniqueid@10.0.0.11:4502,10.0.0.12:4502,10.0.0.13:4502
```

三个节点各自 /etc/foundationdb/foundationdb.conf 的完整基线内容如下。$ID 由 fdbmonitor 替换为配置节中的进程编号；写入时使用单引号 heredoc，避免控制机 shell 提前展开。

### Node A 的基线配置

```text
[fdbmonitor]
user = foundationdb
group = foundationdb

[general]
cluster-file = /etc/foundationdb/fdb.cluster
restart-delay = 10
initial-restart-delay = 1

[fdbserver]
command = /usr/sbin/fdbserver
public-address = 10.0.0.11:$ID
listen-address = public
locality-machineid = node-a
locality-zoneid = node-a
logdir = /var/log/foundationdb
logsize = 10MiB
maxlogssize = 200MiB
memory = 1536MiB
cache-memory = 256MiB

[fdbserver.4500]
class = storage
datadir = /data1/foundationdb/4500

[fdbserver.4501]
class = log
datadir = /data/foundationdb/4501

[fdbserver.4502]
class = stateless
memory = 768MiB
datadir = /var/lib/foundationdb/data/4502
```

### Node B 的基线配置

```text
[fdbmonitor]
user = foundationdb
group = foundationdb

[general]
cluster-file = /etc/foundationdb/fdb.cluster
restart-delay = 10
initial-restart-delay = 1

[fdbserver]
command = /usr/sbin/fdbserver
public-address = 10.0.0.12:$ID
listen-address = public
locality-machineid = node-b
locality-zoneid = node-b
logdir = /var/log/foundationdb
logsize = 10MiB
maxlogssize = 200MiB
memory = 1536MiB
cache-memory = 256MiB

[fdbserver.4500]
class = storage
datadir = /data1/foundationdb/4500

[fdbserver.4501]
class = log
datadir = /data/foundationdb/4501

[fdbserver.4502]
class = stateless
memory = 768MiB
datadir = /var/lib/foundationdb/data/4502
```

### Node C 的基线配置

```text
[fdbmonitor]
user = foundationdb
group = foundationdb

[general]
cluster-file = /etc/foundationdb/fdb.cluster
restart-delay = 10
initial-restart-delay = 1

[fdbserver]
command = /usr/sbin/fdbserver
public-address = 10.0.0.13:$ID
listen-address = public
locality-machineid = node-c
locality-zoneid = node-c
logdir = /var/log/foundationdb
logsize = 10MiB
maxlogssize = 200MiB
memory = 1536MiB
cache-memory = 256MiB

[fdbserver.4500]
class = storage
datadir = /data1/foundationdb/4500

[fdbserver.4501]
class = log
datadir = /data/foundationdb/4501

[fdbserver.4502]
class = stateless
memory = 768MiB
datadir = /var/lib/foundationdb/data/4502
```

### 目录权限与挂载保护

```text
sudo chown foundationdb:foundationdb /etc/foundationdb /etc/foundationdb/fdb.cluster
sudo chmod 0775 /etc/foundationdb
sudo chmod 0664 /etc/foundationdb/fdb.cluster
sudo install -d -m 0755 /etc/systemd/system/foundationdb.service.d
sudo tee /etc/systemd/system/foundationdb.service.d/mounts.conf <<'UNIT'
[Unit]
RequiresMountsFor=/data /data1
[Service]
ExecStartPre=/usr/bin/mountpoint -q /data
ExecStartPre=/usr/bin/mountpoint -q /data1
UNIT
sudo systemctl daemon-reload
```

```text
set -eux
# The directories are private to foundationdb; mount lookup needs sudo.
sudo findmnt -T /data/foundationdb/4501
sudo findmnt -T /data1/foundationdb/4500
sudo -u foundationdb test -w /etc/foundationdb/fdb.cluster
sudo -u foundationdb test -w /etc/foundationdb
sudo -u foundationdb test -w /data/foundationdb/4501
sudo -u foundationdb test -w /data1/foundationdb/4500
```

验证结果：三台目录可写；TLog 目录映射到 /dev/vdb，SS 映射到 /dev/vdc。cluster file 及其父目录可写，便于 FDB 更新 Coordinator 连接信息。目录权限测试以 foundationdb 身份执行。

## 启动及网络验证

```text
set -eux
# Cluster description and identifier use supported alphanumeric characters.
printf '%s\n' 'fdbdemo:replacewithuniqueid@10.0.0.11:4502,10.0.0.12:4502,10.0.0.13:4502' | sudo tee /etc/foundationdb/fdb.cluster
sudo chown foundationdb:foundationdb /etc/foundationdb/fdb.cluster
sudo chmod 0664 /etc/foundationdb/fdb.cluster
sudo systemctl restart foundationdb
sleep 3
sudo systemctl is-active foundationdb
sudo ss -lntp | grep -E ':(4500|4501|4502)\b'
pgrep -a fdbserver
```

结果：三台服务均 active，每台 4500、4501、4502 均监听在相应内网 IP，共 9 个进程。不能仅看 systemctl active：本安装包使用 SysV 包装服务，服务显示 active 也可能没有任何成功启动的 fdbserver。必须同时看进程和端口。

```text
set -eux
python3 - <<'PYNET'
import socket
for ip in ['10.0.0.11','10.0.0.12','10.0.0.13']:
 for port in [4500,4501,4502]:
  with socket.create_connection((ip,port),timeout=3):print(ip,port,'TCP OK')
PYNET
```

上述脚本在 A/B/C 各执行一次，共 27 次 TCP 连接均成功，包含 B/C 到 A 的所有 FDB 端口。最终又将 4503 与 4510 加入验证，共 45 次连接全部成功。无需 Node 之间 SSH。主机 iptables 未发现阻断；云安全组的具体规则未通过云控制台读取，以实际端到端连接通过为依据。

## 初始化及基线状态

```text
set -eux
fdbcli --timeout 30 --exec 'configure new double ssd logs=3 commit_proxies=1 grv_proxies=1 resolvers=1'
fdbcli --timeout 30 --exec 'status details'
fdbcli --timeout 30 --exec 'status json'
```

configure new 仅在空数据库首次初始化时运行一次。此命令在 Node A 执行即可，B/C 不要各自创建数据库。初始化成功后，自动数据分布短暂处于 initializing，等待实际数据复制健康后才开始测试。

实测记录 09-baseline-A；控制机 UTC 2026-10-09T10:53:21.253511+00:00；退出码 0；用时 5.28 秒。

```text
Using cluster file `/etc/foundationdb/fdb.cluster'.

Configuration:
  Redundancy mode        - double
  Storage engine         - ssd-2
  Log engine             - ssd-2
  Encryption at-rest     - disabled
  Coordinators           - 3
  Desired Commit Proxies - 1
  Desired GRV Proxies    - 1
  Desired Resolvers      - 1
  Desired Logs           - 3
  Usable Regions         - 1

Cluster:
  FoundationDB processes - 9
  Zones                  - 3
  Machines               - 3
  Memory availability    - 0.8 GB per process on machine with least available
                           >>>>> (WARNING: 4.0 GB recommended) <<<<<
  Fault Tolerance        - 1 machines
  Server time            - 10/09/26 18:53:21

Data:
  Replication health     - Healthy
  Moving data            - 0.000 GB
  Sum of key-value sizes - 0 MB
  Disk space used        - 629 MB

Operating space:
  Storage server         - 18.8 GB free on most full server
  Log server             - 18.8 GB free on most full server

Workload:
  Read rate              - 10 Hz
  Write rate             - 0 Hz
  Transactions started   - 5 Hz
  Transactions committed - 0 Hz
  Conflict rate          - 0 Hz

Backup and DR:
  Running backups        - 0
  Running DRs            - 0

Process performance details:
  10.0.0.11:4500        (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.11:4501        (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.11:4502        (  2% cpu;  1% machine; 0.000 Gbps;  2% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.13:4500       (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.13:4501       (  1% cpu;  1% machine; 0.000 Gbps;  1% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.13:4502       (  2% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.12:4500      (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.12:4501      (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.12:4502      (  1% cpu;  1% machine; 0.000 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )

Coordination servers:
  10.0.0.11:4502  (reachable)
  10.0.0.12:4502  (reachable)
  10.0.0.13:4502  (reachable)

Client time: 10/09/26 18:53:21
```

基线实际角色数：SS 3、TLog 3、CP 1、GRV Proxy 1、Resolver 1、Coordinator 3；9 个进程跨 3 个 zone，Fault Tolerance 为 1。

## 持续业务测试设计与自检

测试脚本位于 Node A 的 `/opt/fdb-lab/workload.py`；仅使用 `/fdb-lab/<run-id>/` 前缀。每次转账在同一事务内将账户 A 减 1、账户 B 加 1、计数加 1，并写入唯一操作 ID 的 SHA256 标记。重试保持同一 ID，以处理提交结果不确定；提交后另开事务验证标记。

两个工作线程故意共享账户，可产生正常事务冲突。每次成功、重试及错误写入 JSONL，记录 phase、提交时间与延迟。停止后扫描所有操作标记，与本地 ACK 列表逐项比对，并检查总额、计数及标记哈希。测试检查失败会记录 fatal 或返回非零退出码。

```text
set -eux
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
sudo install -d -o opsuser -g opsuser /opt/fdb-lab /opt/fdb-lab/results
python3 -m venv /opt/fdb-lab/venv
/opt/fdb-lab/venv/bin/pip install foundationdb==7.3.77
/opt/fdb-lab/venv/bin/pip show foundationdb
```

```text
/opt/fdb-lab/venv/bin/python /opt/fdb-lab/workload.py selftest --run-id selftest-20261009
echo baseline > /opt/fdb-lab/results/phase
nohup /opt/fdb-lab/venv/bin/python -u /opt/fdb-lab/workload.py run --duration 7200 > /opt/fdb-lab/results/workload-console.txt 2>&1 < /dev/null &
echo $! > /opt/fdb-lab/results/workload.pid
```

自检结果：重复执行同一 ID 时计数只增加一次；人为将账户余额改成错误值后审计返回 pass=false；恢复正确余额后返回 pass=true。原始 08-selftest-A 记录里的那次 pass=false 是预期的检测能力测试，不是实际负载的数据损坏。完整脚本见附录及配套 scripts/workload.py。
