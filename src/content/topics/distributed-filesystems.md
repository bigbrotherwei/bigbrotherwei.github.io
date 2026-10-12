---
title: "分布式文件系统架构"
description: "从 CephFS、JuiceFS 到 DeepSeek 3FS，对照理解元数据、数据路径、一致性与故障恢复。"
status: "更新中"
order: 5
background: "topic-distributed-filesystems"
---

三种文件系统选择了不同的分层方式。先从 CephFS 的 MDS 与 OSD 理解命名空间和数据路径，再看 JuiceFS 如何组合元数据引擎与对象存储，最后进入 3FS 面向高性能计算的 RDMA、CRAQ 和线程模型。

阅读各篇中的配置和性能结论时，请结合对应版本与运行环境判断。
