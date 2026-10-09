# 第十二阶段文章创作与阅读体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持现有 Markdown 博客兼容的前提下，支持可选 MDX、可复用文章组件、阅读交互、发布前检查，并改善 Markdown 预览工具的双栏体验。

**Architecture:** `posts` 集合同时加载 `.md` 与 `.mdx`，现有页面继续通过 `render(post)` 渲染。展示组件放在文章组件目录，少量文章交互放在独立浏览器脚本。内容检查以纯函数检查器为核心，由现有 `verify:content` 接入。Markdown 预览仍沿用现有安全渲染控制器，只调整布局并增加独立同步滚动控制器。

**Tech Stack:** Astro 7、`@astrojs/mdx`、TypeScript、Node test、现有 CSS 与静态 GitHub Pages 构建。

**Spec:** `docs/superpowers/specs/2026-10-09-phase-12-writing-experience-design.zh.md`

## Global Constraints

- 现有 `.md` 文章 URL、frontmatter、专题/标签/搜索/RSS/SEO 行为不得改变。
- `.mdx` 仅为可选格式；保留相同的 `posts` schema 与草稿行为。
- 无账号、CMS、上传服务或运行时后端；不自动生成作者经历。
- Markdown 工具继续保持 1 MiB 限制和现有 HTML 清理边界。
- 只扩大 Markdown 工具工作区；移动端不强制两栏联动。
- 图片放大和代码复制遵守键盘、焦点及减少动态效果偏好。

## Review Focus

- 同名 `.md`/`.mdx` 导致同一 slug：Task 1 的冲突测试必须给出两份文件名。
- MDX 内容被草稿过滤遗漏或进入错误索引：Task 1 用公开与草稿示例检查生产路由、搜索和 RSS。
- 本地图片带查询串、锚点或 URL 编码：Task 4 的路径测试必须解析后再检查文件存在。
- 阅读交互无 JavaScript 或图片加载失败：Task 3 测试原图链接回退与关闭后的焦点恢复。
- 两栏其中一侧没有可滚动距离或重新排版：Task 5 测试零分母、双向拖动与更新后的滚动位置。

---

### Task 1: 可选 MDX 与原有文章兼容

**Files:** Modify `package.json`, `package-lock.json`, `astro.config.mjs`, `src/content.config.ts`, `scripts/verify-content.mjs`; create `tests/content/mdx.test.ts` and一篇中性的示例 `.mdx` 文章，按现有背景注册要求提供独立资源。

**Interfaces:** `posts` 集合依旧输出与现有文章页兼容的 entry；新增内容文件只改变 loader 的后缀覆盖范围，不新增文章字段。

- [ ] **Step 1: 写失败测试。** 断言 `.md`/`.mdx` 都进入文章集合；同 slug 报含文件名的错误；草稿 `.mdx` 不产生详情页、搜索项或 RSS 条目。
- [ ] **Step 2: 运行 `npm run verify:discovery` 与目标测试，确认因缺少 MDX 支持失败。**
- [ ] **Step 3: 安装匹配当前 Astro 的官方 MDX 集成，注册到 `astro.config.mjs`，调整 `posts` loader 与内容校验器。** 不改变 topics/projects loader。
- [ ] **Step 4: 运行目标测试、`npm run verify:content`、`npm run build`，确认现有文章 URL 与内容发现不回退。**
- [ ] **Step 5: 提交本任务。**

### Task 2: 文章展示组件

**Files:** Create `src/components/article/Callout.astro`, `Gallery.astro`, `Disclosure.astro` and focused tests in `tests/reading/`; modify `src/styles/global.css` and示例 `.mdx`。

**Interfaces:** `Callout` consumes `type: 'info' | 'tip' | 'warning'` and default slot; `Gallery` consumes image items with `src`, non-empty `alt`, optional `caption`; `Disclosure` consumes summary plus default slot. MDX 文章显式导入组件。

- [ ] **Step 1: 写失败测试。** 检查类型语义、空 alt 拒绝、画廊图片与标题结构、原生 `details/summary` 以及移动端/明暗主题类的页面契约。
- [ ] **Step 2: 运行 `npm run verify:reading`，确认测试失败。**
- [ ] **Step 3: 实现三个组件及必要样式，在示例 `.mdx` 中展示三种用法。** 不为纯 Markdown 文章注入多余脚本。
- [ ] **Step 4: 运行阅读测试、Astro 类型检查与构建；检查窄屏无横向溢出。**
- [ ] **Step 5: 提交本任务。**

### Task 3: 图片查看与代码复制

**Files:** Create `src/scripts/article-media.ts` and `tests/reading/media.test.ts`; modify `src/pages/posts/[slug].astro` and `src/styles/global.css`。

**Interfaces:** 文章正文内本地图片保持可直接访问的链接或可退化结构；脚本只绑定文章正文内图片与代码块，复用单个查看层和状态反馈节点。

- [ ] **Step 1: 写失败测试。** 检查复制成功/失败反馈、无 Clipboard API 回退、查看原图、Escape/关闭按钮、焦点返回、图片加载失败和无 JavaScript 的可访问链接。
- [ ] **Step 2: 运行 `npm run verify:reading`，确认失败。**
- [ ] **Step 3: 实现按需文章交互与明暗主题样式；遵守 `prefers-reduced-motion`。**
- [ ] **Step 4: 运行阅读测试和构建，用键盘在桌面及手机端手动验收。**
- [ ] **Step 5: 提交本任务。**

### Task 4: 发布前检查与中文指南

**Files:** Create `scripts/lib/post-publishing-checks.mjs`, `tests/content/publishing.test.ts`; modify `scripts/verify-content.mjs`, `docs/writing-posts.zh.md`, `README.md` and `package.json` if a dedicated test command is needed.

**Interfaces:** `checkPostPublishing({ posts, topics, publicRoot })` returns a deterministic list of diagnostics `{ file, message }`; current content verification prints diagnostics and exits non-zero on errors.

- [ ] **Step 1: 写失败测试。** 覆盖未知专题、同专题相同 order、重复 slug、图片缺 alt、缺失本地图片/视频、站内绝对路径、URL 编码/查询串/锚点、远程链接不抓取。
- [ ] **Step 2: 运行目标测试，确认失败。**
- [ ] **Step 3: 使用直接声明的 YAML frontmatter 解析器和 Markdown/MDX AST 解析器实现检查，接入现有校验入口。** 每条错误包含文章路径和位置或字段；新增解析依赖记录在 `package.json`，不对文件内容作脆弱的全局替换。
- [ ] **Step 4: 更新写作指南与 README；运行 `npm run verify:content`、内容测试及完整构建。**
- [ ] **Step 5: 提交本任务。**

### Task 5: Markdown 预览双栏与同步滚动

**Files:** Create `src/lib/tools/sync-scroll.ts`, `tests/tools/sync-scroll.test.ts`; modify `src/pages/tools/markdown.astro`, `src/styles/tools.css`, `src/lib/tools/markdown.ts` and `tests/tools/markdown.test.ts` only where preview 更新需要保留位置。

**Interfaces:** `createSyncScroll({ source, preview, enabled })` provides `onSourceScroll`, `onPreviewScroll`, `refresh`, `dispose`; `enabled` follows desktop media query, and updates after resize.

- [ ] **Step 1: 写失败测试。** 覆盖上下端点、双向比例同步、无滚动距离、事件回环、预览重排、窄屏停用和清理监听器。
- [ ] **Step 2: 运行 `npm run verify:tools`，确认目标测试失败。**
- [ ] **Step 3: 仅扩展 Markdown 工具宽度，统一输入/预览高度和顶部基线，接入同步滚动控制器；不修改安全清理规则。**
- [ ] **Step 4: 运行工具测试和构建；在桌面/手机端用长短不同的 Markdown 内容实际拖动两侧滚动条，并复核 1 MiB 与导入错误。**
- [ ] **Step 5: 提交本任务。**

### Task 6: 整体验收与 PR

**Files:** Create `docs/qa/phase-12-writing-experience.md`; only adjust tests or implementation for verified regressions.

- [ ] **Step 1: 运行 `npm run build`，再运行 Worker 相关验证，确认静态产物、搜索索引、RSS、SEO 与旧工具均通过。**
- [ ] **Step 2: 对文章与 Markdown 工具执行桌面/手机端、浅色/深色、键盘与减少动态效果的浏览器验收，并记录结果。**
- [ ] **Step 3: 复查变更和 `git diff --check`，提交 QA 记录，推送分支并创建 PR。**
