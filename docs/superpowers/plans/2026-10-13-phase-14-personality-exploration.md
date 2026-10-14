# 第十四阶段性格偏好探索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在按分类分组的工具首页增加一个原创、非官方的 32 题性格偏好探索工具，答题与计分仅在浏览器本地进行。

**Architecture:** 题库和纯计分逻辑放在独立模块，页面逐题呈现并在答完后展示四维结果。新工具沿用 `ToolLayout`、工具注册和独立背景；在目录的同一页新增`趣味探索`分类，不产生分类详情路由。本计划依赖`2026-10-13-phase-14-tools-directory-and-utilities.md`中的目录分组 PR 已合入。

**Tech Stack:** Astro、TypeScript、Node test、JSDOM、现有工具注册/背景/构建校验。

**Spec:** `docs/superpowers/specs/2026-10-13-phase-14-tools-and-personality-design.zh.md`

## Global Constraints

- 32 道原创中文情境题，四个维度各 8 道，五档答案 -2 至 +2；各维最终范围 -16 至 +16。
- 非官方自我探索，不复制官方 MBTI 题目、说明、标志或其它站点内容；不称为诊断或招聘筛选依据。
- 答案仅在当前页面内存，刷新重新开始；不上传、不写入 URL、`localStorage` 或分析事件。
- 目录分类只在同一页显示；保留现有工具、URL、搜索/筛选、明暗主题与 Astro 静态部署。
- 新工具拥有一对独立原创手绘夜景 WebP，遵守现有体积和预加载校验。

## Review Focus

- 漏答一题时不能进入结果，返回修改答案后进度和结果应同步（Task 2 测试）。
- 全部选中间选项时四维均为未定，不能随机给出确定四字母组合（Task 1 测试）。
- 某维零分或绝对值不超过 2 时，类型/强度分别显示未定或弱倾向，不把小差异说成确定结论（Task 1 测试）。
- 题库维度分配、ID 唯一性和方向交错失效时，测试应失败（Task 1 测试）。
- 浏览器刷新、重新开始和分析事件均不能泄露答题内容；页面只展示普通访问量，不记录逐题行为（Task 2 测试与浏览器检查）。

---

### Task 1: 原创题库和计分

**Files:** Create `src/data/personality-questions.ts`, `src/lib/tools/personality.ts`, `tests/tools/personality.test.ts`.

**Interfaces:** `PersonalityAxis = 'EI' | 'SN' | 'TF' | 'JP'`; `PersonalityAnswer = -2 | -1 | 0 | 1 | 2`; `scorePersonality(answers: Readonly<Record<string, PersonalityAnswer>>): ToolResult<PersonalityResult>`。题目含稳定 ID、维度、原创情境与两端回答文本、方向系数 `1 | -1`。`PersonalityResult` 含四维分数、弱倾向标记及 `typeCode: string | null`；零分维度时 `typeCode` 为 `null`。

- [ ] **Step 1: 写失败测试。** 断言恰好 32 题、每维 8 题、ID 唯一且方向交错；覆盖全中立、单维零分、绝对值 1/2/3 边界、正分 E/S/T/J 与负分 I/N/F/P 映射、返回修改后的重新计分和漏答错误。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/personality.test.ts` 确认新增用例失败。**
- [ ] **Step 3: 编写题库和纯计分逻辑。** 五档分值乘题目方向系数，按维度求和；正分依次取 E/S/T/J，负分取 I/N/F/P；绝对值不超过 2 为弱倾向，零分不拼出唯一组合。题目和解读文案人工核对原创性与中性表达。
- [ ] **Step 4: 运行目标测试，确认 32 题覆盖与全部边界用例通过。**
- [ ] **Step 5: 提交题库、逻辑与测试。**

### Task 2: 答题页面、分类集成与视觉验收

**Files:** Create `src/pages/tools/personality.astro`, `tests/tools/personality-page.test.ts`, `public/images/backgrounds/tool-personality.webp`, `public/images/backgrounds/tool-personality-mobile.webp`; modify `src/data/tools.ts`, `src/data/backgrounds.ts`, `src/pages/tools/index.astro`, `scripts/verify-tools.mjs`, `scripts/verify-dist.mjs`, `scripts/verify-visual-background.mjs`, `tests/tools/registry.test.ts`, `tests/seo/verify-dist.test.ts`.

**Interfaces:** Page imports `personalityQuestions` and `scorePersonality()` from Task 1; directory category value `exploration` label`趣味探索`; tool slug `personality` route `/tools/personality/` and background key `tool-personality`.

- [ ] **Step 1: 写失败测试。** 用 JSDOM 或现有页面测试模式覆盖逐题选择、上一题返回、32/32 进度、漏答阻止查看结果、结果四维文字/组合、重新开始清空答案；注册表/产物测试覆盖新分类、路由、背景和搜索索引。
- [ ] **Step 2: 运行 `node --experimental-strip-types --test tests/tools/personality-page.test.ts tests/tools/registry.test.ts` 确认新增用例失败。**
- [ ] **Step 3: 实现页面与集成。** 采用原生单选按钮、明确题号/进度与键盘焦点；用 DOM 文本节点输出结果；`ToolLayout` 明示非官方和当前页面内存处理。新增分类只在工具首页分组，筛选/搜索继续隐藏空组；加入独立原创背景及验证脚本。
- [ ] **Step 4: 运行目标测试、`npm run verify:tools`、完整 `npm run build`、`git diff --check`。** 在 320/390/1280px 和明暗主题抽查答题、边界结果、返回/重置、键盘焦点、减少动态效果与目录分组；确认页面不发出含答案的网络请求。
- [ ] **Step 5: 提交并开独立 PR。** PR 明确非官方定位，附 32 题/四维验收及隐私边界，不把它描述为官方心理测量结果。
