# 第十阶段主题与阅读体验 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有手绘夜景之上交付可持久化的浅色、深色、跟随系统阅读主题，并让所有主要页面和评论区一致响应。

**Architecture:** `src/lib/theme.ts` 提供偏好解析和有效主题计算；布局头部在首帧前设置根元素主题，客户端控制器维护偏好、系统变化和导航 UI。CSS 使用语义 token 改变阅读层，背景资产和内容模型保持不变。Giscus 只在用户加载后同步主题。

**Tech Stack:** Astro、TypeScript、CSS variables、Lucide Astro、Node test runner。

**Spec:** `docs/superpowers/specs/2026-09-29-phase-10-theme-reading-design.zh.md`

## Global Constraints

- 保留现有夜景背景图片与内容结构，不新增远端服务或依赖。
- 默认跟随系统；显式选择仅保存在当前浏览器，存储失败不妨碍本页切换。
- 初始主题需在首帧前应用；无 JavaScript 时页面仍可阅读。
- Giscus 不因主题切换重载或丢失输入。
- 现有 `prefers-reduced-motion` 行为保持不变。

## Review Focus

- 无效或旧版 `localStorage` 值：回退为跟随系统，不抛异常。由 Task 1 测试。
- 浏览器禁止读写存储：控件仍可在本页切换。由 Task 1 测试。
- 系统主题变化与手动覆盖冲突：仅跟随系统选项响应系统变化。由 Task 1 测试。
- Giscus iframe 尚未创建或已加载：切换均安全，后者收到主题消息。由 Task 4 测试。
- 窄屏导航和长输入文本：控件不重叠、文本不溢出。由 Task 3 浏览器验收。

---

### Task 1: 主题状态与首帧初始化

**Files:**
- Create: `src/lib/theme.ts`
- Create: `src/scripts/theme.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Test: `tests/theme/state.test.ts`
- Test: `tests/theme/browser.test.ts`

**Interfaces:**
- Produces: `type ThemePreference = 'system' | 'light' | 'dark'`、`type EffectiveTheme = 'light' | 'dark'`、`parseThemePreference(value: unknown): ThemePreference`、`resolveTheme(preference: ThemePreference, systemDark: boolean): EffectiveTheme`。
- Produces: `mountTheme(document: Document, window: Window): void`，读取根元素初值并维护 `data-theme` 与 `data-theme-preference`；主题变化时派发 `themechange` 自定义事件，`detail.theme` 为有效主题。
- Storage key: `blog-theme-preference`；属性取值只允许上述枚举。

- [ ] 写纯函数失败测试：三种合法值、无效/空值、系统亮暗组合。
- [ ] 运行 `node --experimental-strip-types --test tests/theme/state.test.ts`，确认失败。
- [ ] 实现纯函数并运行同一命令，确认通过。
- [ ] 写浏览器失败测试：首次跟随系统、显式选择与刷新、存储异常、系统变化、主题事件；沿用 `tests/comments/browser.test.ts` 的轻量 DOM 测试风格。
- [ ] 运行 `node --experimental-strip-types --test tests/theme/browser.test.ts`，确认失败。
- [ ] 实现客户端控制器与布局内最小首帧脚本：脚本仅读取存储和媒体查询并设置根属性，不引用打包后的客户端模块；随后由 `mountTheme` 绑定事件。
- [ ] 运行本 Task 两个测试并确认通过，提交 `Add persistent theme state and prepaint initialization`。

### Task 2: 导航三态控制

**Files:**
- Modify: `src/components/SiteNav.astro`
- Modify: `src/styles/global.css`
- Modify: `src/scripts/theme.ts`
- Test: `tests/theme/navigation.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `data-theme-preference`、`mountTheme()`；控件使用 `data-theme-toggle`、`data-theme-menu` 和每个选项的 `data-theme-choice`。
- Produces: 导航内的三态主题菜单，选项以 `role="menuitemradio"` 和 `aria-checked` 表示当前偏好；按钮具备 `aria-expanded`、`aria-controls` 和可访问名称。

- [ ] 写失败测试：导航含三项且初始选中正确；点击更新主题与选中态；Escape/点外部关闭；键盘焦点可进入选项。
- [ ] 运行 `node --experimental-strip-types --test tests/theme/navigation.test.ts`，确认失败。
- [ ] 增加 Lucide 图标导航入口、菜单与对应控制逻辑；样式保持导航桌面与移动端有稳定尺寸，不遮挡搜索入口。
- [ ] 运行主题测试、`npm run astro -- check`，确认通过并提交 `Add accessible three-mode theme control`。

### Task 3: 跨页面主题样式

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/styles/tools.css`
- Modify: `src/components/ArticleComments.astro`（仅在局部颜色无法由 token 覆盖时）
- Test: `tests/theme/publishing.test.ts`

**Interfaces:**
- Consumes: 根元素 `data-theme="light|dark"`。
- Produces: 浅色与深色两套语义 token；夜景背景和景上文字保持独立；文章、目录、标签、归档、搜索、工具表单、统计与状态控件使用当前主题。

- [ ] 写发布契约失败测试：构建后 HTML 有预渲染入口与导航控制，CSS 有两套主题 token，文章与工具页均引用主题化样式。
- [ ] 运行 `node --experimental-strip-types --test tests/theme/publishing.test.ts`，确认失败。
- [ ] 从全局 token 开始逐类迁移阅读层、表单和工具 CSS；保留夜景专用色值，不为背景图片提供浅色替代。
- [ ] 运行 `npm run build`，修复主题契约或现有测试回归；在浏览器检查首页、文章、专题、搜索与六个工具的宽屏和 390px 视口，浅/深各一次。
- [ ] 检查正文和关键控件对比度、焦点、长输入和 `prefers-reduced-motion`；提交 `Theme reading surfaces across blog pages`。

### Task 4: 评论联动、说明与最终验收

**Files:**
- Modify: `src/scripts/article-comments.ts`
- Modify: `README.md`
- Test: `tests/comments/browser.test.ts`
- Test: `tests/theme/integration.test.ts`

**Interfaces:**
- Consumes: Task 1 的根元素 `data-theme` 和 `themechange` 事件。
- Produces: Giscus 加载脚本的 `data-theme` 与当前有效主题一致；已存在的 Giscus iframe 接收 `postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app')`。

- [ ] 写失败测试：初次加载使用当前主题；加载前切换不会请求 Giscus；加载后切换向正确 iframe 发送消息且不重建 iframe。
- [ ] 运行 `node --experimental-strip-types --test tests/comments/browser.test.ts tests/theme/integration.test.ts`，确认失败。
- [ ] 接入评论主题同步并更新 README 的三态主题说明。
- [ ] 运行主题测试、`npm run build`、`npm run verify:worker`、`npx tsc -p worker/tsconfig.json`、`git diff --check`；桌面/手机检查评论可用与未配置两种状态。
- [ ] 做全分支审查并修复发现的问题；提交 `Sync Giscus theme and document theme controls`，推送独立 PR。
