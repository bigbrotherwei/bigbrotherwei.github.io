---
title: "个人博客"
description: "使用 Astro、TypeScript 和 Markdown 构建并持续维护的个人博客。"
status: "维护中"
startDate: 2026-09-16
updatedDate: 2026-09-22
tags:
  - Astro
  - TypeScript
  - GitHub Pages
  - 内容系统
featured: true
order: 1
repository: "https://github.com/bigbrotherwei/bigbrotherwei.github.io"
website: "https://bigbrotherwei.github.io"
background: "project-personal-blog"
---

这是 `bigbrotherwei.github.io` 的个人博客源码工程，使用 Astro、TypeScript 和 Markdown 内容体系构建，通过 GitHub Actions 发布到 GitHub Pages。

项目采用功能分支和 Pull Request 工作流维护。每个阶段从 `master` 创建功能分支，在分支中完成改动并运行构建校验，经过 Review 后合并到 `master`，再由 GitHub Actions 自动发布站点。

目前站点已具备原创手绘背景、文章与专题 Content Collections、归档与标签、全文搜索、RSS、明暗主题、评论接入和访问统计，并提供十个纯前端实用工具。文章支持 Markdown 与 MDX，包含阅读目录、图片查看和代码复制等功能。

文章按发布时间浏览，专题提供连续阅读路径，标签用于细粒度主题索引。项目内容仍以 Markdown 保存，但项目栏目暂不对外发布；恢复栏目时可沿用已有的 frontmatter 与背景素材。

站点继续采用静态生成与浏览器端工具的架构；新文章和工具经过构建校验、Pull Request 审核后发布。后续维护重点是内容准确性、移动端阅读和资源加载体验。
