# bigbrotherwei.github.io

`bigbrotherwei` 的个人博客源码工程。

## 技术栈

- Astro
- TypeScript
- Markdown 内容体系
- GitHub Actions
- GitHub Pages

## 本地开发

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

构建静态站点：

```bash
npm run build
```

预览生产构建：

```bash
npm run preview
```

`npm run build` 会依次执行静态校验、Astro 类型检查与页面生成、Pagefind 索引生成，以及最终产物校验。不要只运行 `astro build` 作为发布前检查，否则搜索索引和 RSS、Sitemap、Canonical 等发布契约不会被完整验证。

## 发布

站点设计为通过 GitHub Actions 发布到 GitHub Pages。

部署 workflow 位于：

```text
.github/workflows/deploy.yml
```

当代码合并到远端默认分支 `master` 后，workflow 会安装依赖、构建 Astro 站点，并发布到 GitHub Pages。Pull Request 阶段会运行同样的构建校验，但不会发布站点。

GitHub 仓库设置中，Pages 发布源应选择 **GitHub Actions**。

## 维护流程

后续维护采用功能分支和 PR 流程：

1. 从 `master` 创建功能分支。
2. 在功能分支中完成文章、页面、工具或样式改动。
3. 运行 `npm run build` 验证构建。
4. 推送分支并创建 Pull Request。
5. Review 后合并到 `master`。
6. GitHub Actions 自动发布。

文章和专题内容系统已经接入 Astro Content Collections。新增文章和专题时，应先修改 Markdown 内容，再运行 `npm run build` 验证。

## 实用工具

工具箱位于 `/tools/`，本阶段已实现六个纯前端工具：

- `/tools/json/`：JSON 格式化、压缩与校验。
- `/tools/base64/`：UTF-8 文本与 Base64 编码解码。
- `/tools/url/`：URL 查询参数值或路径片段编码解码。
- `/tools/timestamp/`：Unix 秒、毫秒时间戳与可读日期转换。
- `/tools/uuid/`：使用浏览器安全随机能力生成 UUID v4。
- `/tools/text-counter/`：统计字符、汉字、英文词、行数和 UTF-8 字节数。

所有工具输入、转换结果和复制操作都只在当前浏览器中处理：工具页不发送网络请求、不上传内容、不写入本地持久化存储，也不记录输入内容。不要把需要后端、第三方接口或上传文件的功能伪装成现有工具的扩展；此类需求应单独设计隐私提示和服务边界。

工具改动的基础验证命令：

```bash
npm run verify:tools
npm run verify:visual-background
npm run astro -- check
npm run build
```

### 新增工具

新增一个浏览器内工具时，需要同时完成以下步骤：

1. 在 `src/data/tools.ts` 增加唯一的 `slug`、路由、分类、搜索词和背景 key；工具首页会据此自动生成入口和筛选项。
2. 在 `src/lib/tools/` 编写不依赖 DOM 的纯 TypeScript 逻辑，并在 `tests/tools/` 覆盖正常、错误和边界输入。
3. 在 `src/pages/tools/<slug>.astro` 创建独立页面，使用 `ToolLayout`、关联标签和 `aria-live` 状态；不得使用 `innerHTML` 渲染用户输入，也不得引入 `fetch`、存储或分析输入内容的代码。
4. 为桌面和移动端分别准备原创 WebP 背景，在 `src/data/backgrounds.ts` 登记唯一 key，并运行 `npm run verify:visual-background`。
5. 扩展 `scripts/verify-tools.mjs` 对该页面的静态契约校验；最后运行上面的四条验证命令和桌面、移动端浏览器验收。

## 文章和专题

完整的文章目录、归类、模板、图片和扩展效果说明见[博客文章写作指南](docs/writing-posts.zh.md)。

文章是单篇内容，按发布时间展示，适合记录一次问题、一段经验或一篇阶段总结。文件放在：

```text
src/content/posts/
```

专题是一组文章的阅读路径，不等同于分类。专题更像一份持续更新的小册子，用来把多篇文章按顺序串起来。文件放在：

```text
src/content/topics/
```

发布顺序建议如下：

1. 如果文章属于一个新系列，先创建新专题。
2. 创建新文章，并在文章 frontmatter 的 `topic` 字段填写专题 slug。
3. 按需要调整文章的 `order`，决定它在专题里的阅读顺序。
4. 运行 `npm run build`。
5. 推送分支并创建 Pull Request。

创建新专题时，在 `src/content/topics/` 下新增一个 `.md` 文件。文件名就是专题 slug，例如 `developer-toolbox.md` 对应 `/topics/developer-toolbox/`。

```markdown
---
title: "开发者工具箱搭建"
description: "围绕博客内置工具页，整理纯前端工具的设计、实现和体验打磨。"
status: "计划中"
order: 2
background: "topic-developer-toolbox"
---

这里写专题介绍。
```

创建新文章时，在 `src/content/posts/` 下新增一个 `.md` 文件。文件名就是文章 slug，例如 `json-tool-design.md` 对应 `/posts/json-tool-design/`。

```markdown
---
title: "JSON 工具设计记录"
description: "记录博客内置 JSON 工具的交互设计和实现取舍。"
pubDate: 2026-09-16
tags:
  - 工具
  - JSON
topic: "developer-toolbox"
order: 1
draft: false
background: "post-json-tool-design"
---

这里写文章正文。
```

如果一篇文章暂时不想发布，把 `draft` 设为 `true`。构建时仍会校验 frontmatter，但列表页和详情页不会生成草稿文章。

每篇文章和每个专题详情都必须拥有独立背景。新增内容时需要同时完成：

1. 准备一张至少 `1600 x 900` 的桌面 WebP 和一张至少 `720 x 1280` 的移动 WebP，放入 `public/images/backgrounds/`。
2. 在 `src/data/backgrounds.ts` 中登记一个唯一背景 key，并配置桌面、移动资源路径和定位。
3. 在 Markdown frontmatter 的 `background` 字段填写该 key。
4. 运行 `npm run verify:visual-background`；脚本会校验 key、资源格式、尺寸、体积和页面映射。

栏目页也使用同一背景注册表，但由对应 Astro 页面直接传入 key。所有场景保持原创手绘农场暮景的统一美术方向，各自采用不同地点和构图。

## 项目内容

项目使用 Markdown 管理，文件统一放在：

```text
src/content/projects/
```

### 创建新项目

项目文件名就是公开地址中的 slug。例如 `my-project.md` 会生成 `/projects/my-project/`。可以从下面的完整 frontmatter 开始：

```markdown
---
title: "项目名称"
description: "用于项目列表和页面元信息的一句话介绍。"
status: "维护中"
startDate: 2026-09-22
updatedDate: 2026-09-22
tags:
  - Astro
  - TypeScript
featured: false
order: 2
repository: "https://github.com/bigbrotherwei/example"
website: "https://example.com"
background: "project-example"
---

这里写项目背景、实现过程、当前状态和后续计划。
```

`status` 只允许 `维护中`、`实验中`、`已完成` 或 `已归档`。`repository` 和 `website` 可以省略；填写时必须是 HTTP(S) URL。每个手工维护的项目详情都要在 `src/data/backgrounds.ts` 登记唯一背景 key，并准备符合尺寸和体积要求的桌面、移动 WebP。

新增项目后运行：

```bash
npm run verify:content
npm run verify:visual-background
npm run build
```

## 自动内容发现

### 文章归档

`/archive/` 会从所有已发布文章自动生成按年份和月份分组的文章归档。不要手工维护归档清单；修改文章的 `pubDate` 或 `draft` 后，下一次构建会自动更新。

### 标签页面

`/tags/` 和 `/tags/<标签-slug>/` 会从文章 frontmatter 的 `tags` 自动生成。文章详情中的标签也会链接到对应页面。标签名称应保持稳定，避免只修改大小写或空格；生成规则和冲突处理见 `docs/writing-posts.zh.md`。

## 搜索与订阅

- `/search/`：使用 Pagefind 在浏览器内搜索已发布的文章、专题、工具和项目详情；查询词不会发送到外部服务。
- `/rss.xml`：仅包含已发布文章的标题、摘要、日期、分类和链接。
- `/sitemap-index.xml`：Sitemap 入口；搜索页使用 `noindex,follow`，不进入 Sitemap。
- `/robots.txt`：允许抓取公开页面并声明 Sitemap 地址。

Pagefind 在 Astro 静态页面生成后执行。索引只收录带 `data-pagefind-body` 的详情页，草稿、列表、归档、标签、关于和搜索页不会进入索引。发布前必须运行完整的 `npm run build`；最终的 `verify:dist` 会交叉校验 HTML 元数据、JSON-LD、RSS、Sitemap、robots 和 Pagefind 产物。

## 第一阶段范围

第一阶段只建立基础工程能力：

- Astro 项目骨架
- 最小首页
- 全局基础样式
- GitHub Pages workflow
- 本地开发和维护说明

## 第二阶段范围

第二阶段把站点从最小首页推进到可浏览的博客框架：

- 手绘插画风格首屏，不使用写实照片。
- 共享布局组件和主导航组件。
- 本地每日中文名言库，按日期自动轮换。
- 首页内容入口：文章、专题、实用工具、项目、关于。
- 主导航页面骨架：`/posts`、`/topics`、`/tools`、`/projects`、`/about`。
- 构建前校验手绘 hero 资产、主导航页面和名言数据。

## 第三阶段范围

第三阶段和后续视觉调整继续沿用手绘方向，并把页面背景升级为原创手绘农场暮景：

- 新增共享背景组件 `HandPaintedFarmBackdrop`。
- 在 `BaseLayout` 层挂载背景，使首页、文章、专题、实用工具、项目和关于页面自动继承。
- 使用原创生成的手绘场景资产呈现树林、木屋、田地、道路和水岸，并保留少量游戏美术纹理，不直接复制第三方游戏素材。
- 为 5 个主栏目、3 篇现有文章和 2 个现有专题分别配置独立场景，并为每张背景提供移动端裁切图。
- 通过 `src/data/backgrounds.ts` 集中管理背景资源，文章和专题通过必填 `background` frontmatter 选择场景。
- 调整导航、页面标题和卡片样式，让内容在夜晚背景上保持可读。
- 新增 `npm run verify:visual-background`，并纳入 `npm run verify` 和 `npm run build`。

## 第四阶段范围

第四阶段把文章和专题从占位页升级为真实内容系统：

- 新增 Astro Content Collections 配置。
- 新增 `posts` 和 `topics` 两类 Markdown 内容。
- `/posts/` 按发布时间展示文章列表。
- `/posts/[slug]/` 渲染文章详情。
- `/topics/` 展示专题列表和文章数量。
- `/topics/[slug]/` 渲染专题介绍和专题内文章路径。
- 新增 `npm run verify:content`，并纳入 `npm run verify` 和 `npm run build`。

## 第五阶段范围

第五阶段完成六个纯前端实用工具、工具注册表、分类筛选、输入安全约束、单元测试和独立响应式背景。

## 第六阶段范围

第六阶段补齐内容发现和项目体系：

- 新增项目 Content Collection 和项目详情页。
- 新增自动文章归档、标签总览和标签详情页。
- 文章标签改为可点击链接。
- 文章详情新增更早一篇、更新一篇和相关推荐。
- 完善项目页、关于页和内容维护说明。
- 为项目详情、归档和标签页面增加原创响应式背景。
- 新增内容发现单元测试，并扩展内容与背景静态校验。

## 第七阶段范围

第七阶段完善内容发现和对外发布信息：

- 新增中文站内搜索页和导航搜索入口，使用 Pagefind 生成纯静态索引。
- 搜索范围覆盖文章、专题、工具和项目详情，并排除草稿与聚合页面。
- 新增 RSS、Sitemap 和 robots 路由。
- 全站输出 Canonical、Open Graph、Twitter Card；首页和文章输出 JSON-LD。
- 搜索页使用独立的桌面、移动端原创夜间手绘背景。
- 新增生产产物校验，防止部署缺少索引、订阅或 SEO 元数据。

## 第八阶段：动态体验增强

第八阶段从全站背景动效开始：夜间手绘插画上有少量自动飘落的花瓣和偶尔划过的流星。效果由 CSS 实现，不需要额外脚本或服务；手机端减少元素，系统启用“减少动态效果”时停止显示。GitHub Pages 仍可通过浏览器端 JavaScript 实现后续交互组件、Canvas 效果和本地状态；需要服务端数据时再单独设计 API 或 Serverless 边界。

后续候选需求包括：

- 暗色模式
- 评论系统
- 访问统计和当前在线人数

## 设计文档

- 中文设计文档：`docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`
- 英文设计文档：`docs/superpowers/specs/2026-09-16-blog-rebuild-design.md`
- 第一阶段实现计划：`docs/superpowers/plans/2026-09-16-blog-foundation.md`
- 第二阶段实现计划：`docs/superpowers/plans/2026-09-16-handdrawn-home.md`
- 第三阶段实现计划：`docs/superpowers/plans/2026-09-16-night-sketch-backgrounds.md`
- 第四阶段实现计划：`docs/superpowers/plans/2026-09-16-content-system.md`
- 中途视觉调整计划：`docs/superpowers/plans/2026-09-16-cozy-pixel-farm-background.md`
- 第五阶段设计：`docs/superpowers/specs/2026-09-18-practical-tools-design.zh.md`
- 第五阶段实现计划：`docs/superpowers/plans/2026-09-18-practical-tools.md`
- 第六阶段设计：`docs/superpowers/specs/2026-09-22-phase-6-content-discovery-design.zh.md`
- 第六阶段实现计划：`docs/superpowers/plans/2026-09-22-phase-6-content-discovery.md`
- 第七阶段设计：`docs/superpowers/specs/2026-09-23-phase-7-search-seo-design.zh.md`
- 第七阶段实现计划：`docs/superpowers/plans/2026-09-23-phase-7-search-seo.md`
