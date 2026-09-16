# 第三阶段：夜晚手绘背景实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 为博客的每个页面增加统一的夜晚手绘风格背景，并保持当前手绘卡片、首屏插画和导航页面结构。

**架构：** 背景作为共享 Astro 组件挂载在 `BaseLayout` 中，所有使用统一布局的页面自动继承。背景视觉使用 CSS 绘制星空、月亮、云层和城市剪影，不新增写实素材。

**技术栈：** Astro 7、CSS variables、CSS gradients、Node verification scripts、GitHub Pages 静态构建。

**Spec:** `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`

## 全局约束

- 整体风格继续保持手绘 / 插画化，不使用写实照片。
- 背景必须出现在首页、文章、专题、实用工具、项目和关于页面。
- 背景应在布局层实现，避免每个页面复制同一段视觉代码。
- 页面文字、导航和卡片在夜晚背景上必须保持可读。
- 构建必须通过 `npm run build`。
- PR 阶段只构建校验，不发布；合并到 `master` 后由 GitHub Actions 发布。

---

### Task 1: 背景校验脚本

**Files:**
- Create: `scripts/verify-night-background.mjs`
- Modify: `package.json`

**接口：**
- `npm run verify:night-background` 校验背景组件、布局挂载和关键 CSS token。
- `npm run verify` 包含夜晚背景校验。

- [x] **Step 1: 新增失败校验**

校验必须要求：

```js
src/components/NightSketchBackdrop.astro
BaseLayout must import NightSketchBackdrop
BaseLayout must render <NightSketchBackdrop />
Global styles must include .night-sketch-backdrop
```

- [x] **Step 2: 验证 red**

Run: `npm run verify:night-background`

Expected: FAIL，提示缺少组件、布局挂载和样式 token。

### Task 2: 共享夜晚手绘背景组件

**Files:**
- Create: `src/components/NightSketchBackdrop.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**接口：**
- `NightSketchBackdrop` 无 props，渲染固定背景层。
- `BaseLayout` 在 `<body>` 内渲染 `<NightSketchBackdrop />`。

- [x] **Step 1: 创建背景组件**

组件包含月亮、星空、云层和城市剪影所需的结构，不包含可见文字。

- [x] **Step 2: 布局层挂载**

在 `BaseLayout` 中导入并渲染背景组件，使主导航页面天然继承背景。

- [x] **Step 3: 全局样式**

新增夜晚色彩变量、纸张卡片、固定背景层、手绘网格纹理、月亮、星空、云层和城市剪影样式。

- [x] **Step 4: 验证 green**

Run: `npm run verify:night-background`

Expected: PASS。

### Task 3: 文档和构建验证

**Files:**
- Modify: `README.md`
- Build output: `dist/`

- [x] **Step 1: README 记录第三阶段范围**

说明全站夜晚手绘背景、布局层继承和新增校验脚本。

- [x] **Step 2: 完整构建验证**

Run: `npm run build`

Expected: PASS，生成 6 个静态页面。

- [ ] **Step 3: 推送并创建 PR**

推送分支并创建第三阶段 PR，等待远端 Actions 校验。
