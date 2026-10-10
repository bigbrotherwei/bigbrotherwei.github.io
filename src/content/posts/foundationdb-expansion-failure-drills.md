---
title: "FoundationDB 在线扩容与进程故障演练"
description: "基于三节点实验集群，记录在线扩容、TLog 故障切换、Storage Server 自愈和最终数据核验。"
pubDate: 2026-10-10T10:00:00+08:00
tags:
  - FoundationDB
  - 在线扩容
  - 故障恢复
  - 运维实践
topic: "foundationdb"
order: 3
draft: false
background: "post-foundationdb-expansion-failure-drills"
---

本次实验只验证进程级故障，未覆盖整机断电、磁盘损坏或跨机房容灾；结果不代表可用性 SLA。

## 在线扩容与角色分配

在持续负载运行时，A/B/C 各执行下列命令增加一个 fdbserver。fdbmonitor 自动检测配置变化；没有重启整个服务，原有进程 PID 保持不变。

```text
set -eux
sudo install -d -o foundationdb -g foundationdb -m 0700 /var/lib/foundationdb/data/4503
sudo cp /etc/foundationdb/foundationdb.conf /etc/foundationdb/foundationdb.conf.before-expansion
sudo tee -a /etc/foundationdb/foundationdb.conf <<'CONF'

[fdbserver.4503]
class = stateless
memory = 768MiB
datadir = /var/lib/foundationdb/data/4503
CONF
# fdbmonitor automatically detects the configuration update.
sleep 3
sudo ss -lntp | grep ':4503\b'
pgrep -a fdbserver
sudo cat /etc/foundationdb/foundationdb.conf
```

```text
fdbcli --timeout 30 --exec 'configure commit_proxies=3'
```

结果：进程数从 9 增至 12，配置显示 Desired Commit Proxies=3；但第一次快照中实际 CP 仅有 2 个。因此期望值不能代替角色验收。随后把新进程设为专用 CP，实际达到 3 个：

```text
fdbcli --timeout 30 --exec 'setclass 10.0.0.11:4503 commit_proxy; setclass 10.0.0.12:4503 commit_proxy; setclass 10.0.0.13:4503 commit_proxy'
```

setclass 的结果保存在数据库中，status json 的 class_source 显示 set_class，覆盖启动参数中的 stateless。它不是仅修改本地 conf 文本。本次保留这一覆盖以记录角色调整过程；完整交付包含 final-A/B/C.conf 和 runtime-classes.fdbcli，复现最终状态需同时执行运行时 class 设置。

| 阶段 | 进程数 | 期望 CP | 实际 CP | 证据 |
| --- | --- | --- | --- | --- |
| 基线 | 9 | 1 | 1 | baseline.json |
| 追加 4503 并配置数量 | 12 | 3 | 2 | expanded.json |
| 专用 CP class 生效 | 15 含备用 | 3 | 3 | pre-fault.json |

4503 增加和 CP 数量变更期间，3,072 次操作成功，最大事务延迟 154.1 ms，最长成功提交间隔 194.4 ms。单独设置 CP class 阶段最大间隔 154.2 ms。未发现已确认写入丢失，但短暂抖动存在。

## 备用进程与 TLog 故障演练

### 第一次配置为何没有达到预期

```text
set -eux
sudo install -d -o foundationdb -g foundationdb -m 0700 /data/foundationdb/4510
sudo cp /etc/foundationdb/foundationdb.conf /etc/foundationdb/foundationdb.conf.before-standby
sudo tee -a /etc/foundationdb/foundationdb.conf <<'CONF'

[fdbserver.4510]
class = transaction
memory = 1536MiB
datadir = /data/foundationdb/4510
CONF
sleep 3
sudo ss -lntp | grep ':4510\b'
sudo -u foundationdb test -w /data/foundationdb/4510
sudo findmnt -T /data/foundationdb/4510
pgrep -a fdbserver
```

三台 4510 最初使用 transaction class，数据目录已经在 /data，启动时均未承担 TLog。暂停 B 的 fdbmonitor 并杀死 B:4501 后，集群在两个 log class 进程上恢复服务，4510 没有补成第三个 TLog。业务可写不等于备用接管成功；这次配置没有满足预期，不能作为最终部署建议。

7.3.77 的角色适配代码将 log class 视为 TLog 的 BestFit，transaction 是 GoodFit。此次实测表明，当较优候选已经能满足最低复制要求时，不能假设较低优先级候选一定补足 Desired Logs。

### 改为同等 log 候选后重测

```text
fdbcli --timeout 30 --exec 'setclass 10.0.0.11:4510 log; setclass 10.0.0.12:4510 log; setclass 10.0.0.13:4510 log'
```

在三个 zone 各提供两个同等 log 候选。重测前等待 data.state.healthy=true、recovery_state=fully_recovered，并保存 standby-corrected.json。此时三个 4501 活动、三个 4510 空闲。

以下完整故障脚本在 B 执行。通过当前 status json 找出 B 上实际活动的 TLog，避免把固定端口误当成永久主角色。monitor 暂停期间，其余 fdbserver 继续运行；40 秒后恢复 monitor。退出 trap 和 120 秒 systemd 定时器共同防止留下暂停状态。

```text
set -eux
monitor_pid=$(pgrep -x fdbmonitor)
target_address=$(python3 - <<'PY_TARGET'
import json,subprocess
s=json.loads(subprocess.check_output(['fdbcli','--timeout','10','--exec','status json'],text=True))
logs=[p['address'] for p in s['cluster']['processes'].values() if p['address'].startswith('10.0.0.12:') and any(r['role']=='log' for r in p['roles'])]
assert len(logs)==1,logs
print(logs[0])
PY_TARGET
)
target_port=${target_address##*:}
target_pid=$(pgrep -f "^/usr/sbin/fdbserver .*--public-address 10\\.8\\.180\\.245:$target_port$")
test "$monitor_pid" -gt 1
test "$target_pid" -gt 1
fdbcli --timeout 15 --exec 'status details'
# A root-owned transient timer resumes the monitor even if this SSH session fails.
sudo systemd-run --unit=fdb-lab-resume-monitor --on-active=120s /bin/kill -CONT "$monitor_pid"
resume_monitor() {
 sudo kill -CONT "$monitor_pid" || true
 sudo systemctl stop fdb-lab-resume-monitor.timer || true
}
trap resume_monitor EXIT HUP INT TERM
sudo kill -STOP "$monitor_pid"
sudo kill -KILL "$target_pid"
date -u '+TLOG_KILLED %Y-%m-%dT%H:%M:%SZ'
ps -o pid,stat,args -p "$monitor_pid"
sleep 40
# The killed process must remain absent while the monitor is stopped.
if pgrep -f "^/usr/sbin/fdbserver .*--public-address 10\\.8\\.180\\.245:$target_port$"; then exit 1; fi
fdbcli --timeout 15 --exec 'status details'
fdbcli --timeout 15 --exec 'status json'
resume_monitor
trap - EXIT HUP INT TERM
sleep 15
sudo systemctl is-active foundationdb
pgrep -a fdbserver
sudo ss -lntp | grep ":$target_port\\b"
```

实测结果：B 原活动 TLog PID 2314 被杀且保持关闭；新一代日志系统使用 A/B/C 的 4510。恢复 monitor 后 B:4501 以 PID 2356 重新上线并成为空闲候选。最终各机 4501 均为空闲候选，各机 4510 均承担 TLog。集群故障恢复可能更换整代日志进程，而不是只替换出故障的那一个。

约每秒采集一次 status json；恢复过渡阶段会同时出现新旧 log 角色，不能直接把瞬时 role 条目数当成当前期望数量。待 fully_recovered 且旧角色退出后再验收，本次稳定后活动 TLog 为 3 个。

实测记录 14d-tlog-failover-B；控制机 UTC 2026-10-09T10:59:27.257246+00:00；退出码 0；用时 55.59 秒。

## SS 进程自愈与最终数据核验

TLog 演练结束并确认数据健康后，在 C 执行以下脚本。此处保持 monitor 正常运行，验证自动原地拉起；它与前一节验证的备用招募是两种不同机制。

```text
set -eux
target_pid=$(pgrep -f '^/usr/sbin/fdbserver .*--public-address 10\.8\.79\.161:4500$')
test "$target_pid" -gt 1
sudo kill -KILL "$target_pid"
date -u '+SS_KILLED %Y-%m-%dT%H:%M:%SZ'
sleep 15
new_pid=$(pgrep -f '^/usr/sbin/fdbserver .*--public-address 10\.8\.79\.161:4500$')
test "$new_pid" != "$target_pid"
echo "SS restarted old_pid=$target_pid new_pid=$new_pid"
sudo systemctl is-active foundationdb
fdbcli --timeout 15 --exec 'status details'
```

结果：SS 原 PID 2113 变为 2202，15 秒后的检查已 active 且数据 Healthy。此 15 秒是检查等待时间，不是精确重启耗时。SS 测试阶段最大事务延迟 21.1 ms，最长成功提交间隔 55.5 ms。

```text
echo final-steady > /opt/fdb-lab/results/phase
sleep 30
touch /opt/fdb-lab/results/STOP
sleep 3
cat /opt/fdb-lab/results/workload-console.txt
/opt/fdb-lab/venv/bin/python /opt/fdb-lab/workload.py audit
python3 /opt/fdb-lab/snapshot.py final
```

```text
{"event": "stopped", "run_id": "rebuild-20261009"}
{"event": "audit", "state": {"a": 999981982, "b": 1000018018, "count": 18018}, "markers": 18018, "acknowledged_unique": 18018, "missing_acknowledged": 0, "errors": [], "pass": true}
```

1020 冲突重试共 560 次，1021 提交结果不确定共 7 次；通过保留操作 ID 重试和事务内去重继续执行。最终审计确认 18,018 个确认 ID 均存在，计数恰好 18,018，A=999,981,982，B=1,000,018,018，总额 2,000,000,000。没有 fatal 事件。

| 阶段 | 成功数 | P99 ms | 最大延迟 ms | 最大提交间隔 s |
| --- | --- | --- | --- | --- |
| 基线 | 820 | 15.38 | 18.06 | 0.054 |
| 追加进程及 CP 数量变更 | 3072 | 15.76 | 154.07 | 0.194 |
| 扩容后及追加备用 | 2070 | 15.04 | 19.10 | 0.054 |
| CP class 调整 | 1729 | 16.02 | 137.90 | 0.154 |
| 低优先级备用反例 | 4406 | 15.30 | 4516.60 | 4.551 |
| 备用 class 修正 | 234 | 14.68 | 16.71 | 0.053 |
| 正确 TLog 备用接管 | 2521 | 14.77 | 4427.61 | 4.434 |
| SS 自动拉起 | 2090 | 14.45 | 21.14 | 0.055 |
| 最终稳态 | 1076 | 15.66 | 17.98 | 0.054 |

延迟从一次逻辑转账开始计到成功提交，包含冲突退避及恢复重试，不包含随后写后读和 50 ms 节流。阶段按操作开始时的 phase 分组；若操作跨阶段，原始事件另有 end_phase。统计脚本 scripts/analyze.py 与 metrics.json 可重算结果。

## 实际遇到的问题与修正

| 问题 | 证据和修正 |
| --- | --- |
| 屏蔽服务导致安装收尾失败 | 02-install-A 退出 1；改用临时 policy-rc.d，02a-repair-install-A 退出 0 |
| 普通用户查询私有目录挂载失败 | 03-configure-A/B/C 最后 findmnt 退出 1；改为 sudo findmnt，03b-verify 三台均通过 |
| 连接串不合法导致无进程监听 | 04-start 和 05-network 失败，06-initialize 报 invalid connection string / 2104；改用字母数字连接串，04b、05b、06b 均通过 |
| 配置 CP 数量与实际数量不同 | expanded.json 实际只有 2 个 CP；指定新进程 commit_proxy class 后达到 3 个 |
| MainPID 为 0 | 该包是 GuessMainPID=no 的 SysV 包装服务；14-tlog-failure 在保护断言处退出，尚未杀进程；改用 pgrep -x fdbmonitor |
| transaction 备用不补足日志数量 | 14b 与观察 JSON 表明只有 2 个活动 TLog；设为同等 log class 后 14d 验证新一代 3 个 TLog 自动接管 |

原始记录按执行时间排序，保留 stdout/stderr 和退出码。脚本退出 0 只代表该脚本中的检查通过；角色是否满足业务目标仍要看后续状态断言，例如第一次 TLog 故障脚本完成并不代表备用接管成功。

## 最终状态与日常检查

```text
Using cluster file `/etc/foundationdb/fdb.cluster'.

Configuration:
  Redundancy mode        - double
  Storage engine         - ssd-2
  Log engine             - ssd-2
  Encryption at-rest     - disabled
  Coordinators           - 3
  Desired Commit Proxies - 3
  Desired GRV Proxies    - 1
  Desired Resolvers      - 1
  Desired Logs           - 3
  Usable Regions         - 1

Cluster:
  FoundationDB processes - 15
  Zones                  - 3
  Machines               - 3
  Memory availability    - 0.8 GB per process on machine with least available
                           >>>>> (WARNING: 4.0 GB recommended) <<<<<
  Fault Tolerance        - 1 machines
  Server time            - 10/09/26 19:01:59

Data:
  Replication health     - Healthy
  Moving data            - 0.000 GB
  Sum of key-value sizes - 1 MB
  Disk space used        - 629 MB

Operating space:
  Storage server         - 18.8 GB free on most full server
  Log server             - 18.8 GB free on most full server

Workload:
  Read rate              - 169 Hz
  Write rate             - 108 Hz
  Transactions started   - 74 Hz
  Transactions committed - 28 Hz
  Conflict rate          - 1 Hz

Backup and DR:
  Running backups        - 0
  Running DRs            - 0

Process performance details:
  10.0.0.11:4500        (  2% cpu;  5% machine; 0.002 Gbps;  1% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.11:4501        (  0% cpu;  5% machine; 0.002 Gbps; 11% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.11:4502        (  1% cpu;  5% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.11:4503        (  1% cpu;  5% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.11:4510        (  3% cpu;  5% machine; 0.002 Gbps; 15% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.13:4500       (  2% cpu;  3% machine; 0.002 Gbps;  1% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.13:4501       (  0% cpu;  3% machine; 0.002 Gbps; 16% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.13:4502       (  4% cpu;  3% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.13:4503       (  1% cpu;  3% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.13:4510       (  3% cpu;  3% machine; 0.002 Gbps; 16% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.12:4500      (  1% cpu;  2% machine; 0.002 Gbps;  1% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.12:4501      (  0% cpu;  2% machine; 0.002 Gbps;  7% disk IO; 0.1 GB / 1.5 GB RAM  )
  10.0.0.12:4502      (  3% cpu;  2% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.12:4503      (  1% cpu;  2% machine; 0.002 Gbps;  0% disk IO; 0.1 GB / 0.8 GB RAM  )
  10.0.0.12:4510      (  3% cpu;  2% machine; 0.002 Gbps; 14% disk IO; 0.1 GB / 1.5 GB RAM  )

Coordination servers:
  10.0.0.11:4502  (reachable)
  10.0.0.12:4502  (reachable)
  10.0.0.13:4502  (reachable)

Client time: 10/09/26 19:01:59
```

| 地址 | 有效 class | 来源 | 实际角色 |
| --- | --- | --- | --- |
| 10.0.0.12:4500 | storage | command_line | storage |
| 10.0.0.12:4501 | log | command_line | 空闲候选 |
| 10.0.0.12:4502 | stateless | command_line | coordinator,grv_proxy |
| 10.0.0.12:4503 | commit_proxy | set_class | commit_proxy |
| 10.0.0.12:4510 | log | set_class | log |
| 10.0.0.11:4500 | storage | command_line | storage |
| 10.0.0.11:4501 | log | command_line | 空闲候选 |
| 10.0.0.11:4502 | stateless | command_line | cluster_controller,coordinator |
| 10.0.0.11:4503 | commit_proxy | set_class | commit_proxy |
| 10.0.0.11:4510 | log | set_class | log |
| 10.0.0.13:4500 | storage | command_line | storage |
| 10.0.0.13:4501 | log | command_line | 空闲候选 |
| 10.0.0.13:4502 | stateless | command_line | master,data_distributor,ratekeeper,consistency_scan,coordinator,resolver |
| 10.0.0.13:4503 | commit_proxy | set_class | commit_proxy |
| 10.0.0.13:4510 | log | set_class | log |

三台服务均已启用开机启动，monitor 为正常 Ss 状态，未留下暂停状态；每台 5 个 fdbserver。45 次内网端口验证通过；目录归属 foundationdb:foundationdb，SS/TLog 私有目录权限 0700。dpkg --audit 无未完成安装。

```text
fdbcli --timeout 20 --exec 'status details'
fdbcli --timeout 20 --exec 'status json'
sudo systemctl is-active foundationdb
pgrep -a fdbserver
sudo ss -lntp
sudo findmnt -T /data/foundationdb/4510
sudo findmnt -T /data1/foundationdb/4500
sudo journalctl -u foundationdb --since '10 minutes ago'
sudo ls -lt /var/log/foundationdb
```

诊断 trace 位于 /var/log/foundationdb，服务启动与 monitor 错误还需看 journal/syslog。SS 的持久目录为 /data1/foundationdb/4500，TLog 候选为 /data/foundationdb/4501 和 /data/foundationdb/4510。不能用 trace 日志文件名判定哪个进程是活动 TLog，应查 roles。

测试负载已停止，测试脚本和结果保留在 A 的 /opt/fdb-lab，便于重算审计。若重新执行负载，应选择新 run-id 并使用新的结果目录，避免旧 STOP 文件和旧操作 ID 影响实验。集群中仍保留本次测试前缀，未自动删除。

### backup_agent 的用途

backup_agent 执行由 fdbbackup 创建的备份及恢复任务，把数据库快照和后续变更写入备份存储，用于恢复数据及应对误删等情况。运行进程本身不等于已经有备份，还要启动任务并配置所有 agent 可访问的目标。数据库到数据库的异步灾备使用 fdbdr 和对应的 dr_agent。

备用 fdbserver 参与集群角色招募；backup_agent 不会接替 SS、TLog、CP 或 Coordinator。此次部署验证的是备用 fdbserver，没有配置备份目的地或备份任务，最终 Running backups=0、Running DRs=0。

## 配套文件与复现方法

下表是实验时的资料归档结构，这些原始记录和脚本未随文章公开，路径仅用于说明结果来源。

| 目录或文件 | 内容 |
| --- | --- |
| 完整操作记录.html | 逐次命令、UTC 时间、节点、退出码、未截断原始输出；可展开阅读 |
| evidence/*.json 和 *.txt | 每个操作的机器可读与纯文本记录，包含失败及修正 |
| configs/baseline-A/B/C.conf | 三节点完整基线配置 |
| configs/final-A/B/C.conf | 最终磁盘上的实际配置文件 |
| configs/runtime-classes.fdbcli | 最终生效的六项数据库 class 覆盖 |
| scripts/*.sh 和 *.py | 所有阶段脚本、持续业务负载、采样、审计和统计工具 |
| results/*.json 和 *.txt | 各阶段 status json/details 原始快照 |
| results/*observations.jsonl | 故障及扩容期间按时间采集的完整状态 |
| results/rebuild-20261009.jsonl | 全部业务成功及重试事件 |
| metrics.json | 从业务事件计算的统计结果 |

历史脚本不是可无条件重复执行的一键安装器。特别是 configure new、配置追加和故障脚本都有前置条件。按正文的正确步骤顺序执行，先确认空数据库和挂载，再初始化；测试已有健康集群时不要重跑初始化或追加相同配置节。原始 evidence 保存的是当时的脚本文本，即使 scripts 中后续作了纠正也可追溯。

```text
python3 scripts/run_step.py A <新记录标签> scripts/<阶段脚本>.sh --timeout 180
python3 scripts/analyze.py
```

## 参考资料

角色 class 适配逻辑以实测版本源代码为准：https://github.com/apple/foundationdb/blob/7.3.77/fdbrpc/Locality.cpp

官方配置文档：https://apple.github.io/foundationdb/configuration.html

官方备份及恢复文档：https://apple.github.io/foundationdb/backups.html

在线文档可能随主分支更新，本文命令及行为以 7.3.77 的实际执行记录为依据。

## 附录 完整业务测试脚本

```python
#!/usr/bin/env python3
"""FDB lab: idempotent transfers, read-after-write, durable ACK audit.
Only operates under /fdb-lab/<run>/; never changes application keys.
"""
import argparse, concurrent.futures, hashlib, json, os, pathlib, threading, time, uuid
import fdb
fdb.api_version(730)
p=argparse.ArgumentParser();p.add_argument('mode',choices=['selftest','run','audit']);p.add_argument('--run-id',default='rebuild-20261009');p.add_argument('--duration',type=int,default=3600);p.add_argument('--workers',type=int,default=2);p.add_argument('--interval',type=float,default=.05);p.add_argument('--directory',default='/opt/fdb-lab/results');a=p.parse_args()
db=fdb.open('/etc/foundationdb/fdb.cluster');prefix=('/fdb-lab/'+a.run_id+'/').encode();root=pathlib.Path(a.directory);root.mkdir(parents=True,exist_ok=True);lock=threading.Lock();events=root/(a.run_id+'.jsonl');INITIAL=1000000000

def emit(x):
 x['utc_epoch']=time.time()
 with lock:
  with events.open('a') as f:f.write(json.dumps(x,sort_keys=True)+'\n')

def txn(fn):
 tr=db.create_transaction();tr.options.set_timeout(10000)
 while True:
  try:
   val=fn(tr);tr.commit().wait();return val
  except fdb.FDBError as e:tr.on_error(e.code).wait()

def num(v):return int(v) if v else 0

def initialize():
 def body(tr):
  if not tr[prefix+b'initialized'].present():
   tr[prefix+b'a']=str(INITIAL).encode();tr[prefix+b'b']=str(INITIAL).encode();tr[prefix+b'count']=b'0';tr[prefix+b'initialized']=b'1'
 txn(body)

def apply(tr,opid):
 key=prefix+b'op/'+opid.encode();payload=hashlib.sha256(opid.encode()).hexdigest().encode()
 existing=tr[key].value
 if existing is not None:
  assert existing==payload,'bad idempotency marker'
  return True
 av=num(tr[prefix+b'a'].value);bv=num(tr[prefix+b'b'].value);count=num(tr[prefix+b'count'].value)
 assert av+bv==2*INITIAL,'account invariant violated'
 tr[prefix+b'a']=str(av-1).encode();tr[prefix+b'b']=str(bv+1).encode();tr[prefix+b'count']=str(count+1).encode();tr[key]=payload
 return False

def snapshot():
 def body(tr):
  av=num(tr[prefix+b'a'].value);bv=num(tr[prefix+b'b'].value);count=num(tr[prefix+b'count'].value)
  return {'a':av,'b':bv,'count':count}
 return txn(body)

def audit():
 s=snapshot(); rows=list(db.get_range_startswith(prefix+b'op/'));ids={r.key[len(prefix+b'op/'):].decode():r.value for r in rows}
 errors=[]
 for opid,value in ids.items():
  if value!=hashlib.sha256(opid.encode()).hexdigest().encode():errors.append('payload:'+opid)
 ack=[]
 if events.exists():
  ack=[json.loads(line)['opid'] for line in events.read_text().splitlines() if json.loads(line).get('event')=='success']
 missing=set(ack)-set(ids)
 if missing:errors.append('missing acknowledged operations:'+str(len(missing)))
 if not (s['a']+s['b']==2*INITIAL and s['a']==INITIAL-s['count'] and s['b']==INITIAL+s['count'] and s['count']==len(ids)):errors.append('balance/count mismatch')
 result={'event':'audit','state':s,'markers':len(ids),'acknowledged_unique':len(set(ack)),'missing_acknowledged':len(missing),'errors':errors,'pass':not errors}
 print(json.dumps(result),flush=True);return result

if a.mode=='selftest':
 initialize();opid='duplicate-test'
 assert txn(lambda tr:apply(tr,opid)) is False
 assert txn(lambda tr:apply(tr,opid)) is True
 assert snapshot()['count']==1
 assert audit()['pass']
 txn(lambda tr:tr.__setitem__(prefix+b'a',b'0'))
 assert not audit()['pass'],'auditor must detect deliberately broken balance'
 txn(lambda tr:tr.__setitem__(prefix+b'a',str(INITIAL-1).encode()))
 assert audit()['pass'];print('SELFTEST PASS: duplicate suppression and corruption detection')
elif a.mode=='audit':
 raise SystemExit(0 if audit()['pass'] else 1)
else:
 initialize();stop=root/'STOP';phasefile=root/'phase';deadline=time.monotonic()+a.duration
 def phase():
  try:return phasefile.read_text().strip()
  except FileNotFoundError:return 'baseline'
 def worker(w):
  seq=0
  while time.monotonic()<deadline and not stop.exists():
   opid=f'{w}-{seq}';started=time.monotonic();startwall=time.time();ph=phase();retries=0;codes={};tr=db.create_transaction();tr.options.set_timeout(10000)
   while True:
    try:
     duplicate=apply(tr,opid);tr.commit().wait();break
    except fdb.FDBError as e:
     if time.monotonic()-started>180:
      emit({'event':'fatal','worker':w,'opid':opid,'phase':phase(),'error':'retry budget exceeded'});raise
     retries+=1;codes[str(e.code)]=codes.get(str(e.code),0)+1
     emit({'event':'retry','worker':w,'opid':opid,'phase':phase(),'code':e.code})
     try:tr.on_error(e.code).wait()
     except fdb.FDBError as retry_error:
      emit({'event':'attempt_failed','worker':w,'opid':opid,'phase':phase(),'code':retry_error.code})
      tr=db.create_transaction();tr.options.set_timeout(10000);time.sleep(.1)
    except Exception as e:
     emit({'event':'fatal','worker':w,'opid':opid,'phase':phase(),'error':repr(e)});raise
   committed=time.time();emit({'event':'success','worker':w,'opid':opid,'phase':ph,'end_phase':phase(),'start_epoch':startwall,'commit_epoch':committed,'latency_ms':(time.monotonic()-started)*1000,'retries':retries,'codes':codes,'deduplicated':duplicate})
   def check(tr):
    assert tr[prefix+b'op/'+opid.encode()].value==hashlib.sha256(opid.encode()).hexdigest().encode(),'read after write failed'
   try:txn(check)
   except Exception as e:
    emit({'event':'fatal','worker':w,'opid':opid,'phase':phase(),'error':repr(e)});raise
   seq+=1;time.sleep(a.interval)
 try:
  with concurrent.futures.ThreadPoolExecutor(max_workers=a.workers) as pool:
   list(pool.map(worker,range(a.workers)))
 finally:
  print(json.dumps({'event':'stopped','run_id':a.run_id}),flush=True)
 raise SystemExit(0 if audit()['pass'] else 1)
```
