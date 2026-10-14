# 博客换机交接与当前进度

更新日期：2026-10-14。此文档用于在新电脑或新对话中恢复项目上下文；实际代码和部署状态始终以 GitHub 的 `master` 分支、Pull Request 和 Actions 为准，不以旧电脑的工作目录或聊天记录为准。

## 项目与当前状态

- 仓库：[bigbrotherwei/bigbrotherwei.github.io](https://github.com/bigbrotherwei/bigbrotherwei.github.io)，默认分支是 `master`，公开站点由 GitHub Actions 构建并发布到 GitHub Pages。
- 技术栈是 Astro、TypeScript、Markdown/MDX、Pagefind。`npm run build` 包含内容/素材/工具等校验、Astro 检查与构建、搜索索引和产物校验。
- 当前有 9 篇公开文章、5 个专题和 14 个浏览器端工具。文章、专题、归档、标签、搜索、明暗主题、阅读交互均已接入；“项目”栏目暂不发布，但内容草稿和背景保留。
- 文章评论使用 Giscus，打开文章后默认加载，可手动隐藏；页面访问统计使用 Vercount。它们依赖外部服务，配置或服务不可用时不应阻止静态页面阅读。工具页显示的是页面访问量，不是按钮实际使用次数。
- 已合入的 [PR #38](https://github.com/bigbrotherwei/bigbrotherwei.github.io/pull/38) 完成第十四阶段第一批：工具目录按分类分组，新增进制转换、SHA 摘要、随机密码、二维码生成，并修正工具卡片宽度和工具页访问量框被拉高的问题。合并提交为 `851dd8139896dd0e6cb7a0c78e7863ad2abb6d08`。

五个专题的 slug 是 `blog-rebuild`、`developer-toolbox`、`distributed-filesystems`、`foundationdb` 和 `papers`。已发布的论文内容是两篇有来源的中文导读，不是 PDF 全文或逐段译文；未来添加论文时仍须核对来源、引用与转载授权。

## 下一步

第十四阶段剩余的明确计划是原创的“16 型性格偏好探索”工具：32 道中文题、四维计分、非官方定位、答案仅留在当前浏览器内存。设计见[第十四阶段设计](superpowers/specs/2026-10-13-phase-14-tools-and-personality-design.zh.md)，实施步骤见[性格工具计划](superpowers/plans/2026-10-13-phase-14-personality-exploration.md)。这项工具**尚未实现**，应从最新 `master` 另开 PR，不要误认为第一批 PR 已包含它。

第一批工具的 PR 验收中，自动化测试覆盖了二维码 PNG 生成和 SHA 文件边界，但真实浏览器的“下载 PNG”保存及选择小文件计算摘要仍建议人工再试一次。合并后的线上状态也应按[发布巡检清单](release-checklist.zh.md)核对 Actions 的 `deploy` 任务；PR 的 `build` 成功不等于线上已发布。

## 换机后开始

1. 在新电脑安装 Git 和 Node.js 22.12 或与仓库 CI 兼容的版本，登录自己的 GitHub 账号。不要把令牌、密码或私钥写进仓库。
2. 克隆仓库并确认处于最新的 `master`：

   ```bash
   git clone https://github.com/bigbrotherwei/bigbrotherwei.github.io.git
   cd bigbrotherwei.github.io
   git switch master
   git pull --ff-only origin master
   npm ci
   npm run build
   npm run dev
   ```

3. 浏览器打开开发服务器输出的本地地址。修改前运行 `git status`，从最新 `master` 建功能分支；完成后运行 `npm run build`、推送分支并创建 PR。合并后由 Actions 自动发布，不要直接依赖本地构建产物上线。
4. 在新对话中提供仓库地址，并让助手先读本文件、`README.md`、本次任务相关的设计/写作指南，以及当前 PR 和 Actions 状态。旧聊天的隐含上下文不会随 Git 克隆自动迁移。

`node_modules/`、`.astro/`、`dist/`、本地预览进程和旧电脑上的多个工作树都不需要复制。GitHub 上已合入的代码和文档才是恢复基础；若某个旧 PR 仍未合入，应单独核对该 PR 的状态和差异，不要盲目把旧工作树覆盖到 `master`。

## 内容与视觉约定

- 首页以 `bigbrotherwei` 为标题，中文名言按日轮换。整体是细节丰富的手绘乡野夜景，带少量像素质感；首页农舍、月亮、人物与彩色小精灵等动态元素已有实现。鼠标轨迹偏颗粒状，点击会出现随机水果效果；新增动效需兼顾减少动态效果设置。
- 内容框保持半透明、边界轻，能看见场景；不要用突兀的黑色大块覆盖背景。工具目录按分类展示，卡片左对齐、宽度最多约 260px，单张卡片不能撑满整行，手机上也一样；工具详情页的访问量框应保持内容高度。
- 首页显示全站访问数字，文章和工具详情显示各自页面访问量；不恢复每页底部的统计框。页脚目前只放 GitHub 主页等已有链接；“项目”导航继续隐藏，直到用户提供明确内容。
- 文章放在 `src/content/posts/`，普通文章优先 `.md`，需要站内组件时用 `.mdx`；专题放在 `src/content/topics/`。文章必须指向现有专题，并用 `order` 排定专题内顺序。标签由文章 frontmatter 生成；草稿使用 `draft: true`。细节和模板见[文章写作指南](writing-posts.zh.md)。
- 每篇文章、每个专题详情页都需要独立的桌面/手机背景，在 `src/data/backgrounds.ts` 注册；正文图片放在 `public/images/posts/<slug>/`。画面采用细节丰富、略带像素质感的原创手绘乡野夜景，不复制《星露谷物语》或参考图的具体素材。新增背景运行 `npm run verify:visual-background`，并检查窄屏构图、可读性和加载体积。
- 用户后续通常直接提供主题、Markdown 或 Word 内容，由助手整理标题、摘要、标签、专题、顺序、图片和背景，做脱敏与版权检查，再以 PR 供审核；不要求用户自己手工创建文件。若公开状态、专题归属或来源授权不明确，应先确认，不擅自发布。旧电脑上的 `publish-personal-blog-post` 个人 Codex skill 不在仓库内；其关键流程已记录在这里和[文章写作指南](writing-posts.zh.md)，需要时可在新电脑重新创建。
- 接收新文章时可让用户提供标题、公开/草稿状态、专题、标签、摘要、发布日期、背景想法以及素材来源；缺项可以建议，但不要编造事实或引用。修改已发布文章时保留原 slug 和 `pubDate`，按需更新 `updatedDate`。Word 的嵌入图片须提取并核对；正文图片使用本地路径和有意义的替代文字，不提交无使用许可的第三方素材。
- 不在公开文章中加入“本文整理原文第几章”“不是原文翻译”等编辑旁白。复杂架构可用原创、清晰且响应式的交互图；代码、表格和嵌入内容须在手机上保持可读且不横向撑破页面。
- 本机的简历、Word/PDF 原件和其他私有素材没有同步到仓库，也不应为交接而直接公开上传；新任务需要时由用户在新电脑重新提供。任何密码、密钥、外网地址等敏感内容应在提交前处理。

## 配置与排障入口

- 部署：`.github/workflows/deploy.yml`；Pages 发布源为 **GitHub Actions**，`master` 推送触发部署，PR 只构建不部署。检查步骤见[发布巡检清单](release-checklist.zh.md)。
- 评论：[Giscus 配置指南](comments-setup.zh.md)。四项 `PUBLIC_GISCUS_*` Repository Variables 在 GitHub 设置里维护，不存入 Git；换电脑通常无需重设仓库变量，但应检查 GitHub Discussions、Giscus App 和构建结果。
- 统计：[Vercount 配置与验收](analytics-setup.zh.md)。无需自建 Cloudflare 统计后端；浏览器拦截或服务不可用时数字可能暂不可用。
- 工具清单与开发约定：`src/data/tools.ts`、`src/components/tools/ToolLayout.astro`、`src/lib/tools/`、`tests/tools/` 和 README 的“新增工具”部分。
- 既往阶段的设计、实施和验收记录保存在 `docs/superpowers/` 与 `docs/qa/`；这些计划中的旧复选框可能未回填，判断是否完成应先看 `master`、对应 PR 和实际页面。
