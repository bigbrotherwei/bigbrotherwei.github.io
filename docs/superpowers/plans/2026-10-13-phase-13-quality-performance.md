# 第十三阶段全站体验与性能整理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让背景加载、窄屏操作和发布验收都有可复测的质量门槛，并只修复实测发现的问题。

**Architecture:** 在现有 `verify-dist.mjs` 中核对构建后的背景预加载声明；浏览器 QA 负责布局、键盘和外部服务降级，结果记录在中文验收文档。构建校验与人工巡检互补，不引入新的运行时服务。

**Tech Stack:** Astro、Node.js 测试运行器、JSDOM、GitHub Actions/GitHub Pages。

**Spec:** `docs/superpowers/specs/2026-10-13-phase-13-quality-performance-design.zh.md`

## Global Constraints

- 保留每页独立的原创手绘夜景和现有栏目结构；不批量重画或降低素材辨识度。
- 保持静态构建和 GitHub Pages 部署；不新增访客追踪、运行时后端或生产依赖。
- 评论、统计外部服务失败时，文章和工具仍须可用。
- 任何性能修改须有同条件的前后记录；未发现瓶颈时不做猜测性压缩。
- PR #36 已合入；本阶段分支基于最新 `master`。

## Review Focus

- 只有桌面预加载、缺少手机版本：构建失败并指出具体路由（Task 1）。
- 同一视口声明两个背景预加载：构建失败，避免重复请求（Task 1）。
- 预加载指向不存在或站外的图片：构建失败并指出路径（Task 1）。
- 320px 下长标题、代码或表格造成页面横向滚动：浏览器 QA 记录并在独立修复 PR 中复测（Task 2）。
- Giscus 或 Vercount 未配置/不可用：发布清单确认内容仍可阅读，不能误判为构建失败（Task 3）。

---

### Task 1: 构建产物的背景预加载校验

**Files:**
- Modify: `scripts/verify-dist.mjs`
- Modify: `tests/seo/verify-dist.test.ts`

**Interfaces:**
- Consumes: `dist/**/*.html`、`dist/images/**/*.webp`。
- Produces: `npm run verify:dist` 对每个生成页面的桌面/手机背景预加载进行检查，错误包含路由。

- [ ] **Step 1: 写失败测试。** 给测试 fixture 的每页 `<head>` 添加合法的桌面/手机 `rel="preload" as="image"` 声明，并在 `dist/images/` 放对应文件；新增缺少手机声明、重复桌面声明、错误媒体条件、站外/不存在图片四类用例，断言退出码为 1 和路由级错误。
- [ ] **Step 2: 运行测试确认新增失败。** `node --experimental-strip-types --test tests/seo/verify-dist.test.ts`；新用例在实现前应失败，既有合法 fixture 应保持通过。
- [ ] **Step 3: 实现最小校验。** 在 `scripts/verify-dist.mjs` 复用现有 tag/attribute 工具，逐页检查恰好一个 `(min-width: 640.01px)` 和一个 `(max-width: 640px)` 图片预加载，均带 `fetchpriority="high"`，`href` 为不同的站内 WebP，且对应文件存在；禁止额外背景预加载。
- [ ] **Step 4: 运行目标测试和完整构建。** 目标测试全部通过；`npm run build` 产物验证通过。
- [ ] **Step 5: 提交。** 仅提交上述脚本与测试，单独 PR。

### Task 2: 背景与窄屏/键盘实测

**Files:**
- Create: `docs/qa/phase-13-quality-performance.md`
- Modify only if a reproduced defect requires it: affected page/style/component and focused test.

**Interfaces:**
- Consumes: 本地生产预览、Task 1 的构建结果。
- Produces: 含页面、视口、主题、缓存条件、图片请求/体积、可见性与交互结论的 QA 记录。

- [ ] **Step 1: 固定抽查矩阵。** 首页、文章详情、专题详情、搜索和 Markdown 工具；320px、390px、1280px；浅色/深色、普通/减少动态效果；记录哪些组合需要人工检查。
- [ ] **Step 2: 背景基线。** 对首次与缓存后访问，记录实际请求的背景变体、文件体积、是否出现长期纯色/闪烁；若浏览器无法可靠提供时间数据，明确标记“未测”，不能填写估计值。
- [ ] **Step 3: 布局与键盘。** 检查页面级横向滚动、导航/菜单、文章代码和表格、搜索与工具输入、焦点可见性；记录复现步骤和截图。发现缺陷时先补针对性失败测试，再在独立 PR 修复并回归同一组合。
- [ ] **Step 4: 完成 QA 记录。** 把无问题与发现的问题分别列出；有优化才提供同条件前后数据。提交 QA 记录及经验证的修复。

### Task 3: 发布后巡检

**Files:**
- Create: `docs/release-checklist.zh.md`
- Modify: `README.md`（维护流程处链接清单）
- Modify only if Task 2 reveals a missing deterministic build guard: `scripts/verify-dist.mjs` 及对应测试。

**Interfaces:**
- Consumes: `npm run build` 结果和已发布的 GitHub Pages 页面。
- Produces: 可逐项执行的中文合并前/合并后清单，明确区分代码、部署、外部服务三类故障。

- [ ] **Step 1: 写清单。** 合并前检查完整构建、背景变体、搜索/RSS/站内链接；合并后检查 Pages workflow 成功、代表页面、Giscus 和 Vercount 的可用及降级状态。
- [ ] **Step 2: 连接维护入口。** 从 `README.md` 的维护流程链接清单；避免重复已有评论和统计的配置教程。
- [ ] **Step 3: 验证。** 按清单走一遍本地构建和已发布页面的可执行步骤；外部服务状态必须标记为环境依赖。运行 `npm run build` 与 `git diff --check`。
- [ ] **Step 4: 提交。** 文档与确有必要的自动校验单独 PR。
