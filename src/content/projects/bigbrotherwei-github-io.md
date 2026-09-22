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
background: "projects-index"
---

这是 `bigbrotherwei.github.io` 的个人博客源码工程，使用 Astro、TypeScript 和 Markdown 内容体系构建，通过 GitHub Actions 发布到 GitHub Pages。

项目采用功能分支和 Pull Request 工作流维护。每个阶段从 `master` 创建功能分支，在分支中完成改动并运行构建校验，经过 Review 后合并到 `master`，再由 GitHub Actions 自动发布站点。

目前已经完成前五个阶段：建立 Astro 工程骨架和 GitHub Pages 发布流程，补齐首页与主导航，统一原创手绘农场暮景视觉，接入文章和专题 Content Collections，并完成六个纯前端实用工具。第六阶段继续完善项目、归档、标签和内容发现能力。

当前内容系统支持文章、专题和项目使用 Markdown 管理，文章按发布时间浏览，专题提供连续阅读路径，标签用于细粒度主题索引。项目本身也通过 Markdown frontmatter 描述状态、日期、标签、链接和背景。

后续方向包括全站搜索、RSS、Sitemap、Canonical、结构化数据，以及在明确服务边界后再规划访问统计和在线人数。搜索和 SEO 能力属于后续阶段，当前项目保持静态生成和浏览器端工具的边界。
