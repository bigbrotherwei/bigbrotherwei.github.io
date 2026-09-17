# 中途视觉调整：原创像素农场夜景背景

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 把博客当前的城市夜景 / 手绘背景调整为原创像素农场夜景，让全站更像温暖的像素 RPG 手账空间，同时不复制第三方游戏素材、源码或资源。

**架构：** 使用共享 Astro 背景组件挂载在 `BaseLayout`，所有页面自动继承。背景图形全部由 CSS 绘制，不依赖外部图片。

**约束：**

- 保留 Fluid 式沉浸首屏和透明导航气质。
- 不直接复制第三方游戏素材、角色、贴图、Logo、地图或 UI。
- 不使用写实照片。
- 页面文本在桌面和移动端都必须保持可读。
- `npm run build` 必须通过。

---

### Task 1: 视觉背景校验

**Files:**
- Create: `scripts/verify-visual-background.mjs`
- Modify: `package.json`

**Interfaces:**
- `npm run verify:visual-background` 校验背景组件、布局挂载、首页 token 和关键 CSS token。
- `npm run verify` 必须包含该脚本。

- [x] **Step 1: 写入失败优先的校验脚本**

检查：

```text
src/components/PixelFarmBackdrop.astro exists
src/components/NightSketchBackdrop.astro does not exist
BaseLayout imports and renders PixelFarmBackdrop
global.css contains pixel farm tokens
homepage no longer references old city hero tokens
all primary pages use BaseLayout
```

- [x] **Step 2: 跑红校验**

Run: `npm run verify:visual-background`

Expected: FAIL before implementation because old background tokens are still present.

### Task 2: 共享像素农场背景

**Files:**
- Create: `src/components/PixelFarmBackdrop.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/global.css`

**Design:**

- 星空和月光建立夜晚氛围。
- 远山、草地、田垄、围栏和木屋建立像素农场主题。
- 使用硬边色块、重复线条和小尺寸格纹模拟像素感。

- [x] **Step 1: 创建组件结构**
- [x] **Step 2: 在 BaseLayout 挂载背景**
- [x] **Step 3: 替换全局背景样式**

### Task 3: 首页首屏同步

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `scripts/verify-assets.mjs`

**Design:**

- 首页首屏不再引用旧城市封面图。
- 首屏加入木屋和田垄装饰层，与全站背景一致。
- 每日中文名言和主标题继续保持中心焦点。

- [x] **Step 1: 移除旧 hero 图片系统**
- [x] **Step 2: 添加首页像素农场首屏 token**
- [x] **Step 3: 更新资产校验脚本**

### Task 4: 文档和内容同步

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`
- Modify: `docs/superpowers/specs/2026-09-16-blog-rebuild-design.md`
- Modify: `src/content/posts/*.md`

- [x] **Step 1: README 记录当前视觉方向**
- [x] **Step 2: 设计文档同步为像素农场夜景**
- [x] **Step 3: 专题文章记录当前实现**

### Task 5: 验证

Run:

```bash
npm run verify:visual-background
npm run build
```

Expected: PASS.
