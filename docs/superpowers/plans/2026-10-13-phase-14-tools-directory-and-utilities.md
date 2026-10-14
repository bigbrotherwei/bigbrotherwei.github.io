# 第十四阶段工具目录与四个常用工具 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 工具首页默认按分类分组，并加入进制转换、SHA 摘要、随机密码和二维码生成四个本地工具。

**Architecture:** 目录继续由 `src/data/tools.ts` 驱动，已有搜索和分类按钮控制组与卡片的显隐。每个新工具沿用 `ToolLayout`、独立逻辑模块与背景注册表，并将新路由加入现有源码/产物校验。二维码采用成熟浏览器库，其他三项使用标准浏览器 API 或 `BigInt`。

**Tech Stack:** Astro、TypeScript、Node test、JSDOM、Web Crypto、浏览器 Canvas、`qrcode`。

**Spec:** `docs/superpowers/specs/2026-10-13-phase-14-tools-and-personality-design.zh.md`

## Global Constraints

- 保持 Astro 静态构建与 GitHub Pages 发布；工具输入不上传，不新增运行时后端、账号或外部统计。
- 保留现有工具 URL、搜索、分类筛选、明暗主题；分类只在同一目录页分组，不建立分类详情页。
- 每个新增工具有独立原创手绘夜景的桌面/手机 WebP，遵守现有体积和预加载校验，不复制外站或游戏素材。
- 进制转换只支持 2–36 进制、最多 256 位的整数；SHA 文件最多 32 MiB；密码长度 8–64；二维码文本最多 1000 UTF-8 字节。
- 不把摘要称为加密，不把 Base64 当进制，不保存密码历史或工具输入。

## Review Focus

- 目录搜索仅匹配部分卡片时，空分类标题必须隐藏，计数仍等于可见卡片数（Task 1 测试）。
- 进制输入包含超出源进制的字符或大于 `Number.MAX_SAFE_INTEGER` 时，分别报错或精确保留整数（Task 2 测试）。
- SHA 文件超过 32 MiB 或 Web Crypto 不可用时，不读取/提交内容并给出明确反馈（Task 3 测试）。
- 密码选择多个字符组时，结果必须包含每个组选出的字符且随机取样不产生取模偏差（Task 4 测试）。
- 二维码输入超过 1000 UTF-8 字节或超过纠错容量时，不留下旧预览或下载旧码（Task 5 测试）。

---

### Task 1: 工具目录同页分组

**Files:** Modify `src/pages/tools/index.astro`, `tests/tools/registry.test.ts`, `scripts/verify-dist.mjs`, `tests/seo/verify-dist.test.ts`.

**Interfaces:** Consumes `toolCategories` and `tools` from `src/data/tools.ts`. Produces section elements with `data-tool-group` and `data-category` plus existing `data-tool-card`, `data-category-filter`, `data-result-count` contracts; later tools only register category/card data.

- [ ] **Step 1: 写失败测试。** 在 `tests/tools/registry.test.ts` 构造两类卡片，断言初始两组可见、搜索后空组隐藏、筛选与搜索叠加、清空恢复当前类、计数正确；在产物 fixture 断言每张工具卡位于匹配分类组中。
- [ ] **Step 2: 运行测试确认失败。** `node --experimental-strip-types --test tests/tools/registry.test.ts tests/seo/verify-dist.test.ts`；新增用例应先失败。
- [ ] **Step 3: 实现分组。** 模板按 `toolCategories`（排除 `all`）渲染分类标题及本类卡片；客户端 `updateResults()` 同时处理卡片、空组和计数。保持无脚本时全部组可见，CSS 为窄屏提供稳定网格。
- [ ] **Step 4: 运行目标测试和构建。** 上述测试与 `npm run build` 均通过，目录初始工具数不变。
- [ ] **Step 5: 提交。** 仅提交目录、对应测试及产物校验改动。

### Task 2: 进制转换

**Files:** Create `src/lib/tools/radix.ts`, `src/pages/tools/radix.astro`, `tests/tools/radix.test.ts`, `public/images/backgrounds/tool-radix.webp`, `public/images/backgrounds/tool-radix-mobile.webp`; modify `src/data/tools.ts`, `src/data/backgrounds.ts`, `scripts/verify-tools.mjs`, `scripts/verify-dist.mjs`, `scripts/verify-visual-background.mjs`, `tests/tools/registry.test.ts`, `tests/seo/verify-dist.test.ts`.

**Interfaces:** `convertRadix(input: string, fromBase: number, toBase: number): ToolResult<string>` (use existing `ToolResult` pattern); errors for invalid base, empty/invalid digits, decimals, exponent form, >256 digits. Page supports swap/copy via existing browser helper.

- [ ] **Step 1: 写失败测试。** 测试 `2/8/10/16/36`、负数、超过安全整数的精确往返，以及非法数字和第 257 位拒绝。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/radix.test.ts` 确认失败。**
- [ ] **Step 3: 实现逻辑、页面、注册与独立背景。** 用 `BigInt` 逐位解析而非先转 `Number`；以既有工具页面为 UI/状态模式，接入三处验证脚本和路由 fixture。背景仅服务该页。
- [ ] **Step 4: 运行目标测试、`npm run verify:tools`、`npm run build`，并在桌面/320px 预览输入、交换与复制。**
- [ ] **Step 5: 提交本工具及必要的集成文件。**

### Task 3: SHA 摘要

**Files:** Create `src/lib/tools/sha.ts`, `src/pages/tools/sha.astro`, `tests/tools/sha.test.ts`, `public/images/backgrounds/tool-sha.webp`, `public/images/backgrounds/tool-sha-mobile.webp`; modify Task 2 的工具注册、背景和验证文件及对应测试。

**Interfaces:** `digestBytes(bytes: ArrayBuffer, algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512', subtle: SubtleCrypto): Promise<string>` 输出小写十六进制；`validateHashFile(file: Pick<File, 'size'>): ToolResult<void>` 上限 `32 * 1024 * 1024` 字节。文本先用 `TextEncoder`；文件通过 `arrayBuffer()` 读取后摘要。

- [ ] **Step 1: 写失败测试。** 用已知文本向量核对三种 SHA 长度/结果，断言 32 MiB 边界、超限不触发文件读取、API 缺失给出错误。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/sha.test.ts` 确认失败。**
- [ ] **Step 3: 实现本地摘要页面、纯逻辑、独立背景和工具/产物注册。** 文本与文件为分段模式，复制失败有反馈，不把文件内容发送出去。
- [ ] **Step 4: 运行目标测试、`npm run verify:tools`、`npm run build`，在浏览器核对文本/文件/超限路径。**
- [ ] **Step 5: 提交本工具及必要的集成文件。**

### Task 4: 随机密码

**Files:** Create `src/lib/tools/password.ts`, `src/pages/tools/password.astro`, `tests/tools/password.test.ts`, `public/images/backgrounds/tool-password.webp`, `public/images/backgrounds/tool-password-mobile.webp`; modify工具注册、背景和验证文件及对应测试。

**Interfaces:** `generatePassword(options: { length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean }, randomBytes: (count: number) => Uint8Array): ToolResult<string>`；生产调用包装 `crypto.getRandomValues`。通过拒绝采样从字符集取样，再安全洗牌；确保每个启用组至少出现一次。

- [ ] **Step 1: 写失败测试。** 覆盖长度 8/64 和越界、没有字符组、每组选入、注入的随机字节边界/拒绝采样、重置不保留前一密码。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/password.test.ts` 确认失败。**
- [ ] **Step 3: 实现逻辑、页面、独立背景与注册。** 使用复选框/长度输入/复制按钮；不写历史、存储或 URL；不展示无依据的强度评级。
- [ ] **Step 4: 运行目标测试、`npm run verify:tools`、`npm run build`，在浏览器核对键盘操作和复制。**
- [ ] **Step 5: 提交本工具及必要的集成文件。**

### Task 5: 二维码生成与四工具验收

**Files:** Create `src/lib/tools/qr.ts`, `src/pages/tools/qr.astro`, `tests/tools/qr.test.ts`, `public/images/backgrounds/tool-qr.webp`, `public/images/backgrounds/tool-qr-mobile.webp`; modify `package.json`, `package-lock.json`、工具注册、背景和验证文件及对应测试。

**Interfaces:** `validateQrText(text: string): ToolResult<string>` 计算 `TextEncoder` 字节长度且上限 1000；页面使用 `qrcode` 的 Canvas/PNG API，支持尺寸、纠错级别、预览和下载。容量或绘制错误时清空旧预览及下载链接。

- [ ] **Step 1: 写失败测试。** 覆盖空文本、1000/1001 UTF-8 字节、中文多字节边界、重新生成失败后旧预览/下载不可用。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/qr.test.ts` 确认失败。**
- [ ] **Step 3: 安装 `qrcode` 及需要的类型，完成逻辑、页面、独立背景、注册与验证脚本。** 库只在二维码页加载，输入只作为二维码数据传入，不作为 HTML 插入。
- [ ] **Step 4: 运行目标测试与完整 `npm run build`；在 320px/桌面、明暗主题检查目录分组和四个新页的焦点、错误、背景及二维码 PNG 下载。** `git diff --check` 通过。
- [ ] **Step 5: 提交并开本批工具 PR。** PR 说明后续人格工具将沿用同一目录分组，不宣称它已完成。
