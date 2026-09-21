---
title: "开发者工具箱搭建"
description: "围绕博客内置工具页，整理纯前端工具的设计、实现和体验打磨。"
status: "更新中"
order: 2
background: "topic-developer-toolbox"
---

这个专题记录博客内置工具页的设计、实现和体验打磨。

首批已完成六个纯前端工具：JSON 格式化、Base64 编码解码、URL 组件编码解码、时间戳转换、UUID v4 生成和字数统计。它们分别位于 `/tools/json/`、`/tools/base64/`、`/tools/url/`、`/tools/timestamp/`、`/tools/uuid/` 与 `/tools/text-counter/`。

这些工具的输入、输出和复制操作只在当前浏览器中处理：不上传内容、不发起网络请求、不写入持久化存储，也不记录输入内容。本专题会随着已经确认并发布的工具改动持续更新，不把尚未完成的工具当作既有功能描述。
