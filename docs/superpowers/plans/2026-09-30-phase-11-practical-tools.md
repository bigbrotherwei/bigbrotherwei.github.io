# 第十一阶段实用工具与深色配色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有博客工具箱交付图片合并 PDF、Markdown 预览、文本差异对比、正则测试四个工具，并把深色阅读区改为炭灰/暖灰色调。

**Architecture:** 保留 Astro 静态页面、`ToolLayout`、`src/data/tools.ts` 注册表、共享工具样式和浏览器端执行模式。每个新工具是独立路由、专注的逻辑模块与测试；复杂正则隔离在 Web Worker，用户输入不进入后端。四页各有原创手绘桌面/移动背景；深色配色只调整语义 token 和必要的局部对比。

**Tech Stack:** Astro 7、TypeScript、Node test runner、pdf-lib、marked、DOMPurify、jsdom（测试环境）、diff、Web Worker、CSS。

**Spec:** `docs/superpowers/specs/2026-09-30-phase-11-practical-tools-design.zh.md`

## Global Constraints

- 纯静态 GitHub Pages；不新增后端或上传通道，用户输入不自动持久化。
- PDF 仅接收 JPEG/PNG/WebP；最多 20 张、单张 20 MiB、总计 100 MiB、单张 30 MP；A4、自动横竖版、24 pt 边距、等比不裁切，输出不超过约 200 DPI。
- Markdown 输入上限 1 MiB，更新防抖约 200 ms；输出 HTML 必须清理危险标签、属性与 URL。
- Diff 每份输入最多 100,000 字符，运算超时 1 秒；原文只以文本节点显示。
- 正则表达式最多 500 字符，测试文本最多 100,000 字符，匹配上限 1000，Worker 超时 1 秒并终止重建。
- 深色阅读背景/面板不使用淡绿色；普通文本对比至少 4.5:1，焦点至少 3:1；保留浅色主题与现有手绘夜景。
- 每个新工具必须有独立桌面/移动背景、工具目录入口、静态路由契约、键盘/手机端可用的完整状态。

## Review Focus

1. 伪造 MIME 或损坏图片不能导致空白 PDF：图片任务测试解码失败后保留队列并给出文件名。
2. 多次上传、删除、重新生成不能沿用旧缩略图或对象 URL：图片任务测试资源释放与页序。
3. Markdown 的 `javascript:` 链接、事件属性和 HTML 脚本不得进入预览：Markdown 任务测试实际净化结果。
4. 长文本差异或零宽正则不能冻结主线程：diff 任务测试超时反馈，正则任务测试零宽推进和 Worker 超时重建。
5. 工具目录筛选、主题切换与新背景在窄屏仍可操作：最终任务用浏览器检查并把对应回归写入测试。

---

### Task 1: 深色阅读配色

**Files:**
- Modify: `src/styles/global.css`
- Modify if required by token audit: `src/styles/tools.css`, `src/pages/tools/index.astro`
- Test: `tests/theme/publishing.test.ts`

**Interfaces:**
- Consumes: 现有 `:root[data-theme="dark"]` token 与三态主题逻辑；不改变主题 API。
- Produces: 后续四个工具可直接使用的深色语义色、对比度测试。

- [ ] **Step 1: 写失败测试。** 在 `tests/theme/publishing.test.ts` 断言深色 `--color-reading-surface`、`--color-panel`、`--color-panel-soft`、`--color-input` 为中性炭灰/暖灰而非绿色倾向；检查正文、次级文字、链接、按钮、菜单焦点对比；浅色 token 保持原值。
- [ ] **Step 2: 验证 RED。** 运行 `node --experimental-strip-types --test tests/theme/publishing.test.ts`，确认新增断言因当前绿色 token 失败。
- [ ] **Step 3: 实现最小色彩调整。** 深色底色从 `#1b1d22`、面板 `#2b292c`、软面板 `#353236` 起调，采用暖白文字、珊瑚色强调、金色焦点；按测试计算结果微调。审查正文、工具、评论、统计、代码区的硬编码颜色，只修复实际冲突，不改夜景与浅色模式。
- [ ] **Step 4: 验证 GREEN。** 运行上述定向测试及 `node --experimental-strip-types --test tests/theme/*.test.ts`，均通过；提交配色与测试。

### Task 2: 图片合并 PDF

**Files:**
- Create: `src/lib/tools/images-pdf.ts`（文件校验、A4 排版、PDF 生成）
- Create: `src/pages/tools/images-pdf.astro`（队列、缩略图、排序、删除、下载）
- Create: `tests/tools/images-pdf.test.ts`
- Modify: `src/data/tools.ts`, `src/data/backgrounds.ts`, `src/styles/tools.css`, `src/pages/tools/index.astro`, `scripts/verify-tools.mjs`, `tests/tools/registry.test.ts`
- Add: `public/images/backgrounds/tool-images-pdf.webp`, `public/images/backgrounds/tool-images-pdf-mobile.webp`
- Modify: `package.json`, `package-lock.json`（安装 `pdf-lib`）

**Interfaces:**
- Consumes: `ToolLayout`、`tools` 注册表、`BackgroundKey`、共享 `tool-status`。
- Produces: `validateImageFiles(files: readonly File[]): ToolResult<File[]>`、`placeImage(width: number, height: number, pageWidth: number, pageHeight: number, margin: number): { x: number; y: number; width: number; height: number }`、`buildImagesPdf(images: readonly NormalizedImage[]): Promise<Uint8Array>`；`ToolResult` 沿用 `src/lib/tools/result.ts`，`NormalizedImage` 是解码/旋转/缩放后的 JPEG 字节、宽高和名称。页面负责浏览器解码、顺序、对象 URL 生命周期与下载。

- [ ] **Step 1: 写失败测试。** 覆盖空队列、20/21 张、单张/总大小、错误 MIME 与损坏文件、横竖 A4 页、24 pt 留白、等比放置、20 张队列排序后的 PDF 页数/顺序；用 pdf-lib 重新加载产物验证页数与尺寸。目录注册测试从六个改为十个的阶段目标时，先按当前新增页数递增，避免半成品入口。
- [ ] **Step 2: 验证 RED。** 运行 `node --experimental-strip-types --test tests/tools/images-pdf.test.ts tests/tools/registry.test.ts`，确认新增测试失败。
- [ ] **Step 3: 实现。** 安装 `pdf-lib`；将 JPEG/PNG/WebP 通过浏览器解码与 Canvas 归一为白底 JPEG，限制 30 MP 和约 200 DPI，逐张生成 PDF；队列提供选择/拖入、上移/下移/删除、文件名、进度、下载与错误恢复。通过 `URL.revokeObjectURL` 清理缩略图，重复执行时防重入。注册文件类和新路由、唯一背景，并在 `scripts/verify-tools.mjs` 增加对应逻辑调用契约。使用 imagegen 制作不含文字的原创手绘夜间装帧工作台桌面/移动背景。
- [ ] **Step 4: 验证 GREEN。** 运行定向测试、`npm run verify:tools`、`npm run verify:visual-background`，全部通过；检查 PDF 下载文件名、页数、顺序、透明图片白底和坏文件错误状态后提交。

### Task 3: Markdown 预览

**Files:**
- Create: `src/lib/tools/markdown.ts`, `src/pages/tools/markdown.astro`, `tests/tools/markdown.test.ts`
- Modify: `src/components/tools/ToolLayout.astro`（可覆盖隐私提示）、`src/data/tools.ts`, `src/data/backgrounds.ts`, `src/styles/tools.css`, `scripts/verify-tools.mjs`, `tests/tools/registry.test.ts`
- Add: `public/images/backgrounds/tool-markdown.webp`, `public/images/backgrounds/tool-markdown-mobile.webp`
- Modify: `package.json`, `package-lock.json`（安装 `marked`、`dompurify`，测试用 `jsdom`）

**Interfaces:**
- Consumes: Task 2 后的工具注册表与 `ToolLayout`。
- Produces: `renderMarkdown(markdown: string, window: Window): ToolResult<string>`（解析、净化后的 HTML）；`ToolLayout` 可选 `privacyNote?: string`，Markdown 页提示远程图片地址会由浏览器请求。

- [ ] **Step 1: 写失败测试。** 输入上限 1 MiB；标题、表格、代码、链接、图片正常预览；`<script>`、`onerror`、`javascript:` 不进入净化结果；远程图片提示可见；本地 `.md` 文件过大/读取失败保留输入。
- [ ] **Step 2: 验证 RED。** 运行 `node --experimental-strip-types --test tests/tools/markdown.test.ts`，确认缺少实现失败。
- [ ] **Step 3: 实现。** `marked` 解析后用 DOMPurify 净化，安全设置外链 `rel`/`target`；页面仅将净化结果写入预览，约 200 ms 防抖，支持 `.md` 文件和手机单列。注册路由与背景，加入工具校验契约；创作独立夜间手绘抄写台背景。
- [ ] **Step 4: 验证 GREEN。** 定向测试、`npm run verify:tools`、`npm run verify:visual-background` 通过；浏览器检查恶意链接不执行且普通 Markdown 可读后提交。

### Task 4: 文本差异对比

**Files:**
- Create: `src/lib/tools/text-diff.ts`, `src/pages/tools/text-diff.astro`, `tests/tools/text-diff.test.ts`
- Modify: `src/data/tools.ts`, `src/data/backgrounds.ts`, `src/styles/tools.css`, `scripts/verify-tools.mjs`, `tests/tools/registry.test.ts`
- Add: `public/images/backgrounds/tool-text-diff.webp`, `public/images/backgrounds/tool-text-diff-mobile.webp`
- Modify: `package.json`, `package-lock.json`（安装 `diff`）

**Interfaces:**
- Consumes: `ToolLayout`、共享剪贴板辅助函数 `copyText`。
- Produces: `compareText(oldText: string, newText: string, mode: 'line' | 'word'): ToolResult<DiffChunk[]>`，`DiffChunk` 为 `{ value: string; kind: 'same' | 'add' | 'remove' }`；页面用文本节点呈现。

- [ ] **Step 1: 写失败测试。** 行/词切换、中文和换行、相同/空文本、每侧超过 100,000 字符、库超时、`<img onerror>` 原文仅作文本、交换顺序和复制摘要。
- [ ] **Step 2: 验证 RED。** 运行 `node --experimental-strip-types --test tests/tools/text-diff.test.ts`，确认失败。
- [ ] **Step 3: 实现。** 使用 `diff` 的行/词算法和 1 秒超时；两列输入、分段结果与文字标识、交换/清空/复制。注册路由、契约和独立夜间手绘校对桌背景；结果只通过 `textContent`/`createTextNode` 呈现。
- [ ] **Step 4: 验证 GREEN。** 定向测试及工具/背景校验通过；桌面/手机端检查长行换行与结果可读后提交。

### Task 5: 正则测试

**Files:**
- Create: `src/lib/tools/regex.ts`, `src/scripts/regex-worker.ts`, `src/lib/tools/regex-worker-client.ts`, `src/pages/tools/regex.astro`, `tests/tools/regex.test.ts`, `tests/tools/regex-worker-client.test.ts`
- Modify: `src/data/tools.ts`, `src/data/backgrounds.ts`, `src/styles/tools.css`, `scripts/verify-tools.mjs`, `tests/tools/registry.test.ts`
- Add: `public/images/backgrounds/tool-regex.webp`, `public/images/backgrounds/tool-regex-mobile.webp`

**Interfaces:**
- Consumes: `ToolLayout`、共享状态区；无新增依赖。
- Produces: `runRegex(pattern: string, flags: string, input: string): ToolResult<{ matches: RegexMatch[]; truncated: boolean }>` 只在 Worker 调用，`RegexMatch` 包含起止位置、匹配片段、捕获组；`createRegexRunner(workerFactory: () => Worker, timeoutMs = 1000): { run(pattern: string, flags: string, input: string): Promise<ToolResult<{ matches: RegexMatch[]; truncated: boolean }>>; dispose(): void }` 在主线程提交请求、超时终止 Worker 并重建。

- [ ] **Step 1: 写失败测试。** 错误语法/标志、500/501 字符、100,000/100,001 字符、全局零宽匹配推进、1000 条截断、捕获组、Worker 超时终止后再次执行成功；结果不得把文本当 HTML。
- [ ] **Step 2: 验证 RED。** 运行 `node --experimental-strip-types --test tests/tools/regex*.test.ts`，确认失败。
- [ ] **Step 3: 实现。** Worker 内编译与匹配，主线程仅渲染数据；用 `new Worker(new URL('../../scripts/regex-worker.ts', import.meta.url), { type: 'module' })` 由 Vite 打包；超时 terminate 并重建，清理 pending 请求。页面提供四个旗标选项、匹配/捕获结果、清空/复制。注册路由、契约和独立夜间手绘符号工作台背景。
- [ ] **Step 4: 验证 GREEN。** 定向测试及工具/背景校验通过；浏览器以回溯表达式验证页面可响应并能再次测试后提交。

### Task 6: 全站回归与交付

**Files:**
- Modify: `README.md`, `scripts/verify-dist.mjs`, `tests/tools/registry.test.ts`, `tests/tools/visual-background-rules.test.ts`（仅需的最终清单/数量）
- Verify: `src/pages/tools/index.astro`, `src/data/tools.ts`, `src/data/backgrounds.ts`

**Interfaces:**
- Consumes: Tasks 1-5 的完整页面和主题。
- Produces: 十个工具的发布说明、生产路由/搜索索引/背景契约与验收证据。

- [ ] **Step 1: 写失败的生产产物/目录测试。** 断言十个工具路由与搜索可见，分类筛选和计数动态准确，四对背景存在且互异，Markdown 远程图片提示与 PDF 本地处理提示可见。
- [ ] **Step 2: 验证 RED 后补齐文档和校验。** 更新 README 工具清单、格式/大小限制、隐私说明；仅修复测试揭示的入口或校验遗漏。
- [ ] **Step 3: 完整验证。** 运行 `npm run build`、`npm run verify:worker`、`npx tsc -p worker/tsconfig.json --noEmit`、`git diff --check`；保存结果。浏览器桌面和 390px 手机视口检查首页/工具目录/四个工具的浅色与深色、键盘焦点、PDF 下载、Markdown 安全显示、diff 长行、正则超时；不能有空白背景或控件重叠。
- [ ] **Step 4: 提交并复核。** 提交文档/契约补齐；整分支独立代码复核，修复可重现问题并再验证，然后推送功能分支、创建并附加 PR。PR 不自动合并，等待用户验收与 GitHub Actions 通过。
