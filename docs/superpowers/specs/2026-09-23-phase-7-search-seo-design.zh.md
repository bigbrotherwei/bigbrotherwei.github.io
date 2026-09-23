# 第七阶段：静态搜索与 SEO 发布能力设计

## 1. 背景

第六阶段已经补齐项目、归档、标签和文章内容发现，但站内仍缺少全文搜索，搜索引擎和订阅工具也缺少稳定的机器可读入口。第七阶段把博客从“可以浏览”推进到“可以搜索、订阅和被正确收录”。

本阶段继续保持 Astro 静态生成与 GitHub Pages 部署，不新增常驻后端、数据库、用户登录或搜索词采集。动态搜索只在访问者浏览器中运行。

## 2. 目标

- 新增 `/search/` 独立搜索页，并在主导航最右侧加入放大镜入口。
- 使用 Pagefind 在构建结束后生成中文静态索引。
- 搜索文章、专题详情、工具详情和项目详情。
- 生成只包含已发布文章的 `/rss.xml`。
- 生成 Sitemap 和 `robots.txt`，明确站点抓取入口。
- 为所有 HTML 页面输出 Canonical、Open Graph、Twitter Card 和 RSS 自动发现元数据。
- 为首页和文章详情输出有效 JSON-LD；文章使用 `BlogPosting` 与 `BreadcrumbList`。
- 为搜索页制作一组新的原创手绘农场暮景桌面与移动背景。
- 用自动化校验和浏览器 QA 覆盖搜索、SEO 产物、响应式布局和 GitHub Pages 路径。

## 3. 非目标

- 不实现服务端搜索、搜索历史、搜索词分析或个性化推荐。
- 不把草稿、标签页、归档页、列表页、关于页或搜索页加入全文索引。
- 不在 RSS 中输出完整 Markdown 正文；首版只输出标题、摘要、日期、标签和永久链接。
- 不实现评论、访问统计、当前在线人数、账户体系或外部 CMS。
- 不在本阶段扩展主题切换、复杂动效或游戏化交互。

## 4. 技术方案

### 4.1 依赖

- `pagefind`：开发依赖。Astro 完成静态构建后，对 `dist/` 运行索引生成。通过 npm 安装的 Pagefind 使用支持中文和日文分词的扩展版本。
- `@astrojs/rss`：生成静态 RSS 端点。
- `@astrojs/sitemap`：在 Astro 构建时生成 Sitemap。
- `lucide-astro`：主导航放大镜图标，避免手写 SVG。

依赖必须锁定到 `package-lock.json`，GitHub Actions 继续通过现有 Astro workflow 安装和构建。

### 4.2 构建流程

现有 `npm run build` 保留全部校验，并按以下顺序执行：

1. 运行静态校验和单元测试。
2. 运行 `astro check`。
3. 运行 `astro build` 生成 `dist/`。
4. 运行 Pagefind CLI，对 `dist/` 生成 `dist/pagefind/`。
5. 运行产物级 SEO 与搜索校验，检查 HTML、XML、robots 和 Pagefind 文件。

Pagefind 是部署产物的一部分，不能只在本地单独生成。Pull Request 和 `master` 发布使用同一条构建命令，因此不会出现本地有搜索、线上缺索引的分叉。

### 4.3 搜索索引边界

使用 Pagefind 的 `data-pagefind-body` 明确标记可搜索正文。只给以下详情页添加索引区域：

- `/posts/<slug>/`
- `/topics/<slug>/`
- `/tools/<slug>/`
- `/projects/<slug>/`

导航、背景装饰、上一篇/下一篇、相关推荐和通用页脚不进入正文索引。每个索引页提供稳定标题和类型元数据，便于结果展示“文章”“专题”“工具”或“项目”。草稿文章不生成详情页，因此不会进入索引。

### 4.4 搜索页面

新增 `/search/` 页面：

- 使用 `PageHero` 延续现有栏目结构。
- 页面主体包含有可见标签的搜索输入、结果摘要和结果列表。
- 输入采用适合中文的短延迟防抖，不向服务器发送搜索词。
- 空输入显示简短引导；无匹配结果显示明确空状态。
- Pagefind 资源加载失败时显示可恢复的错误状态，不留下空白页面。
- 无 JavaScript 时显示说明，其他博客页面仍可正常浏览。
- 结果展示类型、标题、纯文本摘要和 URL；不使用未经约束的 `innerHTML` 注入内容。
- 搜索页使用 `noindex,follow`，并从 Sitemap 中排除，避免搜索页面自身成为搜索结果。

Pagefind 资源只在搜索页加载。搜索页面使用 Pagefind 官方浏览器 API 和本站自定义界面，不采用不可控的结果模板，也不复制第三方主题源码。

### 4.5 主导航入口

`SiteNav` 最右侧新增固定尺寸的放大镜图标链接，目标为 `/search/`：

- 使用 Lucide 图标。
- 提供 `aria-label="搜索"` 与悬停提示。
- 保留清晰的键盘焦点样式。
- 桌面与移动端都不因图标加载或状态变化产生布局位移。

### 4.6 搜索页视觉

新增 `search-index` 背景 key，以及一组桌面和移动 WebP：

- 场景延续原创手绘加少量游戏纹理的农场暮景。
- 建议构图为夜晚林间图书亭或灯火书屋，形成“寻找内容”的语义联想。
- 桌面图至少 `1600 x 900`，移动图至少 `720 x 1280`。
- 不复制《星露谷物语》或其他第三方游戏素材。
- 继续通过 `verify:visual-background` 校验格式、体积、尺寸、注册和唯一性。

## 5. SEO 与发布元数据

### 5.1 Canonical

`BaseLayout` 使用 Astro 配置中的 `site` 与当前路径生成绝对 Canonical URL：

- 去掉查询参数和哈希。
- 保留站点统一的尾斜杠策略。
- 页面可显式覆盖 canonical path，但默认值必须安全可用。

### 5.2 Open Graph 与 Twitter Card

所有页面输出：

- `og:type`
- `og:title`
- `og:description`
- `og:url`
- `og:site_name`
- `og:locale`
- `og:image`
- `twitter:card`
- `twitter:title`
- `twitter:description`
- `twitter:image`

默认社交图片使用首页手绘背景；文章、专题、工具和项目详情优先使用当前页面背景的桌面图，并转换为绝对 URL。文章使用 `article` 类型，其他页面使用 `website`。

### 5.3 RSS

新增 `/rss.xml`：

- 只包含 `draft: false` 的文章。
- 按 `pubDate` 从新到旧排序。
- 每项包含标题、摘要、发布日期、永久链接和标签分类。
- Feed 声明 `zh-CN`，站点 `<head>` 增加 RSS 自动发现链接。

### 5.4 Sitemap 与 robots

- 使用 `@astrojs/sitemap` 生成 `sitemap-index.xml` 与分片文件。
- Sitemap 包含所有应公开收录的静态页面和内容详情。
- 排除 `/search/` 和 Pagefind 资源。
- 新增动态 `robots.txt`，允许正常抓取并声明绝对 Sitemap URL。
- `<head>` 增加 `rel="sitemap"`。

### 5.5 JSON-LD

结构化数据由纯 TypeScript helper 生成，再交给 `BaseLayout` 安全序列化：

- 首页输出 `WebSite`，包含站点名称、URL、中文语言和作者信息。
- 文章详情输出 `BlogPosting`，包含标题、摘要、发布日期、可选更新日期、永久链接、标签、作者和主图。
- 文章详情同时输出 `BreadcrumbList`：首页、文章列表、当前文章。
- 不填写未知邮箱、社交账号、版权机构或虚构个人信息。
- JSON 序列化必须转义 `<`，避免脚本上下文提前闭合。

## 6. 组件和接口

### `BaseLayout`

扩展可选属性：

- `canonicalPath?: string`
- `robots?: string`
- `pageType?: 'website' | 'article'`
- `structuredData?: JsonLdValue | readonly JsonLdValue[]`

布局负责统一生成 Canonical、社交元数据、RSS/Sitemap 发现链接和 JSON-LD，不允许各页面重复拼接 `<head>`。

### SEO helper

新增独立模块负责：

- 从站点地址和页面路径生成 canonical URL。
- 从内容数据构造 `WebSite`、`BlogPosting` 和 `BreadcrumbList`。
- 安全序列化 JSON-LD。

helper 不读取 DOM，不依赖浏览器，可以使用 Node 测试直接覆盖。

### 搜索脚本

搜索逻辑独立于 Astro 模板，职责限定为：

- 延迟加载 Pagefind。
- 防抖并执行查询。
- 将结果写入固定 DOM 容器。
- 通过 `textContent` 或 DOM 节点呈现搜索数据。
- 更新结果数量、空状态、加载状态和错误状态。

## 7. 错误与空状态

- Pagefind 索引缺失：构建失败，不允许部署无搜索索引的产物。
- Pagefind 浏览器资源加载失败：搜索页显示“搜索暂时不可用，请稍后重试”，不影响导航。
- 搜索无结果：显示查询词对应的无结果状态，并保留输入框。
- RSS 或 Sitemap 缺少站点地址：构建失败。
- 结构化数据字段缺失或 URL 非绝对地址：测试或静态验证失败。
- 搜索页无 JavaScript：显示 `<noscript>` 提示。

## 8. 验证策略

### 单元测试

- Canonical 去除查询参数和哈希。
- Canonical 对绝对站点地址和尾斜杠保持稳定。
- `BlogPosting` 日期、作者、标签和图片字段正确。
- `BreadcrumbList` 顺序和位置正确。
- JSON-LD 安全转义 `<`。
- 搜索结果映射不依赖 HTML 注入。

### 静态校验

- 所有生成的 HTML 都有唯一 canonical、description、Open Graph 和 Twitter Card。
- 首页和文章详情包含合法 JSON-LD。
- 搜索页为 `noindex,follow`，其他公开页不错误使用 `noindex`。
- RSS 不包含草稿，条目数量与已发布文章一致。
- Sitemap 存在且不包含 `/search/`。
- `robots.txt` 声明正确的绝对 Sitemap 地址。
- `dist/pagefind/` 存在必要入口与索引文件。
- 可索引详情页拥有 `data-pagefind-body`，列表和搜索页不会误入索引。

### 浏览器 QA

- 桌面 `1440 x 900` 和移动 `390 x 844` 检查 `/search/`。
- 使用中文和英文关键词命中文章、专题、工具和项目。
- 验证无结果、清空输入、键盘焦点、回车与结果链接。
- 验证移动端导航和结果列表无重叠、无遮挡、无横向滚动。
- 验证搜索页使用移动背景，控制台无错误。
- 用生产预览检查 RSS、Sitemap、robots 和主要页面 head 元数据。

## 9. 文档与发布

- README 增加搜索、RSS 和 SEO 维护说明。
- 写作指南说明文章标题、摘要、日期、标签和背景如何进入搜索、RSS 与结构化数据。
- 新增第七阶段 QA 记录。
- PR 合并后等待 GitHub Actions 成功，再检查线上 `/search/`、`/rss.xml`、`/sitemap-index.xml` 和 `/robots.txt`。

## 10. 后续阶段

第八阶段预留为“动态体验增强”。具体范围由后续需求决定，可包含轻量动画、页面过渡、主题切换、交互组件或其他浏览器端效果。该阶段仍需单独设计，不能在第七阶段预先加入未确认功能。

评论、访问统计与当前在线人数继续作为独立后续能力；涉及服务端或第三方服务时，需要单独明确隐私、成本和故障边界。

## 11. 参考资料

- Pagefind 官方文档：https://pagefind.app/docs/
- Pagefind 索引范围：https://pagefind.app/docs/indexing/
- Astro Sitemap：https://docs.astro.build/en/guides/integrations-guide/sitemap/
- Astro RSS：https://docs.astro.build/en/recipes/rss/
