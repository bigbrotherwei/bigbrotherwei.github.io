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

工具箱位于 `/tools/`，当前已经上线六个纯前端工具：

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

后续阶段会继续实现：

- 实用工具具体功能
- 项目页和关于页内容完善
- 搜索
- 暗色模式
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
