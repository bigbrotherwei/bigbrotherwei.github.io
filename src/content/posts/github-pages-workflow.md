---
title: "用 PR 维护 GitHub Pages 博客"
description: "记录当前博客采用的分支、PR、构建校验和发布验证流程。"
pubDate: 2026-09-16
tags:
  - GitHub Pages
  - GitHub Actions
  - 发布流程
topic: "blog-rebuild"
order: 2
draft: false
background: "post-github-pages-workflow"
---

这个博客会继续使用 GitHub Pages 发布，但维护方式从直接改主分支改成了功能分支和 Pull Request。

每个阶段从 `master` 创建新分支，完成改动后运行 `npm run build`。构建会先执行资产、名言、背景和内容校验，再执行 Astro 类型检查和静态构建。

Pull Request 阶段只验证构建，不发布站点。合并到 `master` 后，GitHub Actions 才会执行真正的 Pages 部署。
