# 博客文章写作指南

这份文档说明文章写在哪里、如何归入专题、图片如何保存，以及当前 Markdown 文章可以使用哪些展示效果。

## 1. 在哪里写文章

文章统一放在：

```text
src/content/posts/
```

每篇文章是一个独立的 `.md` 文件。文件名就是文章的 slug，也会成为公开地址的一部分。

例如：

```text
src/content/posts/my-first-post.md
```

构建后对应：

```text
/posts/my-first-post/
```

文件名建议使用小写英文、数字和连字符，例如 `astro-writing-notes.md`。不要使用空格，也不要频繁修改已经发布文章的文件名，否则公开链接会变化。

## 2. 文章如何归类

当前博客使用两层组织方式：

- `tags` 是文章标签，一篇文章可以有多个，用来描述内容涉及的主题。
- `topic` 是所属专题，一篇文章必须归入一个专题，用来组织有阅读顺序的一组文章。

专题文件位于：

```text
src/content/topics/
```

专题文件名就是专题 slug。例如：

```text
src/content/topics/blog-rebuild.md
```

文章中填写：

```yaml
topic: "blog-rebuild"
```

`order` 决定文章在该专题中的阅读顺序。第一篇通常填写 `1`，后续依次递增。

如果准备写一个全新的系列，应先创建专题，再写属于该专题的文章。当前专题状态只允许：`计划中`、`更新中`、`已完成`。

### 标签页面和 URL

公开文章的标签会自动汇总到 `/tags/`，每个标签生成 `/tags/<标签-slug>/` 详情页；已发布文章也会自动进入 `/archive/`。这些页面都来自文章 frontmatter，不需要手工维护清单，草稿不会出现在其中。

标签 slug 的生成规则是：先做 Unicode `NFKC` 标准化、去除首尾空白并转换为小写，再把连续空白替换为连字符，只保留汉字、字母、数字和连字符。例如：

```text
GitHub Pages -> github-pages
博客重构 -> 博客重构
```

显示名称仍使用文章里第一次出现的写法。为了避免标签冲突，同一个标签应始终使用完全一致的大小写和空格；如果两个不同名称生成相同标签 slug，`npm run verify:discovery` 或构建会失败并指出冲突标签，不会静默覆盖页面。

## 3. 完整文章模板

在 `src/content/posts/` 新建文件后，可以从下面的模板开始：

````markdown
---
title: "文章标题"
description: "用于文章列表和搜索摘要的一句话介绍。"
pubDate: 2026-09-22
updatedDate: 2026-09-22
tags:
  - Astro
  - 博客维护
topic: "blog-rebuild"
order: 4
draft: true
background: "post-your-article"
---

这里写文章开头。

## 一级小节

这里写正文。

### 二级小节

- 列表内容
- 另一项内容

> 这里是一段引用。

```ts
const message = '代码块需要注明语言';
```
````

字段说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `title` | 是 | 文章标题 |
| `description` | 是 | 列表、搜索和页面元信息使用的摘要 |
| `pubDate` | 是 | 首次发布日期，格式建议为 `YYYY-MM-DD` |
| `updatedDate` | 否 | 内容最后更新日期 |
| `tags` | 否 | 标签数组；没有标签时可写 `tags: []` |
| `topic` | 是 | 专题 slug，必须对应 `src/content/topics/` 中的文件名 |
| `order` | 是 | 文章在专题中的顺序 |
| `draft` | 否 | `true` 为草稿，`false` 为公开文章；默认为 `false` |
| `background` | 是 | 在 `src/data/backgrounds.ts` 注册的独立背景 key |

建议刚开始写时使用 `draft: true`，确认内容和页面效果后再改为 `false`。

### 字段如何进入搜索、RSS 和 SEO

- `title`：用于文章页标题、站内搜索结果、RSS 条目标题和社交分享标题。
- `description`：用于列表与搜索摘要、RSS 摘要、页面 description、Open Graph、Twitter Card 和文章结构化数据。
- `pubDate`：决定文章列表、归档和 RSS 的发布时间与排序。
- `updatedDate`：填写后进入文章结构化数据的修改时间；不填写时不会伪造日期。
- `tags`：生成标签页，也作为 RSS 分类和文章结构化数据关键词。
- `draft`：设为 `true` 后不会生成公开详情页，也不会进入搜索、RSS、归档或标签页。
- `background`：决定页面桌面/移动背景，同时作为文章社交分享图。

专题、工具和项目详情会进入站内搜索，但 RSS 只发布文章。搜索索引、RSS、Sitemap 和页面元数据都在生产构建中生成，因此发布前必须运行完整的 `npm run build`，不能用单独的 `astro build` 替代。

## 4. 正文图片如何保存

正文插图建议按文章 slug 单独建目录：

```text
public/images/posts/<文章-slug>/
```

例如文章文件是：

```text
src/content/posts/astro-writing-notes.md
```

它的图片可以保存为：

```text
public/images/posts/astro-writing-notes/content-collection.webp
public/images/posts/astro-writing-notes/build-result.webp
```

在文章中从站点根路径引用：

```markdown
![Astro Content Collections 配置界面](/images/posts/astro-writing-notes/content-collection.webp)
```

图片要求：

- 文件名使用小写英文、数字和连字符。
- 优先使用 WebP；需要透明背景时可以使用 PNG。
- 图片应先压缩，避免直接提交体积很大的原始截图。
- 每张图片都要填写有意义的替代文本，不要只写“图片”或“截图”。
- 不建议直接引用第三方网站图片，避免防盗链、失效、隐私和版权问题。

需要图片标题时，可以在 Markdown 中写 HTML：

```html
<figure>
  <img
    src="/images/posts/astro-writing-notes/content-collection.webp"
    alt="Astro Content Collections 配置界面"
  />
  <figcaption>文章集合的字段配置。</figcaption>
</figure>
```

### 正文插图和页面背景的区别

正文插图保存在：

```text
public/images/posts/<文章-slug>/
```

文章页面背景保存在：

```text
public/images/backgrounds/
```

每篇文章必须有独立的桌面背景和移动背景：

- 桌面图至少 `1600 x 900`。
- 移动图至少 `720 x 1280`。
- 两张图片都使用有损 WebP。
- 在 `src/data/backgrounds.ts` 注册唯一 key。
- 将该 key 填入文章 frontmatter 的 `background`。

页面背景不是正文插图，不要把正文截图注册成页面背景。

## 5. 当前是否只能写 Markdown

当前内容集合只扫描：

```text
src/content/posts/**/*.md
```

因此，自动进入文章列表、专题和文章详情页的文章目前必须使用 `.md` 格式。项目暂未启用 MDX，`.mdx` 文件不会自动成为文章。

Markdown 并不只支持纯文字。当前文章可以使用：

- 多级标题、列表、引用和分隔线。
- 链接和图片。
- 表格。
- 带语言标记的代码块。
- 粗体、斜体和行内代码。
- 浏览器原生 HTML，例如 `figure`、`details`、`summary`、`mark`、`kbd`、`video`。

例如折叠内容：

```html
<details>
  <summary>展开查看完整配置</summary>

  这里可以放补充说明或较长的代码。
</details>
```

例如视频：

```html
<video controls preload="metadata" poster="/images/posts/my-post/video-cover.webp">
  <source src="/videos/my-post/demo.mp4" type="video/mp4" />
</video>
```

视频文件建议放在 `public/videos/<文章-slug>/`。

## 6. 能否增加其它效果

可以，但要根据效果复杂度选择实现方式。

### 直接在 Markdown 中完成

适合：图片、表格、代码块、引用、折叠内容、音视频和简单 HTML。写文章时直接使用即可，不需要修改站点代码。

### 使用 HTML 类名和全局 CSS

适合：提示框、强调段落、图片画廊、特殊表格等纯样式效果。

这类效果需要先在站点样式中实现一个可复用类名，再在文章里使用：

```html
<aside class="article-note">
  这是一段需要特别注意的内容。
</aside>
```

不要在每篇文章中复制大段 `<style>`，统一样式更容易维护和适配移动端。

### 启用 MDX 或开发 Astro 组件

适合：可交互图表、标签页、步骤器、可运行代码、复杂动画和需要 JavaScript 状态的组件。

当前项目没有启用 MDX，因此 Markdown 文章里不能直接导入 Astro、React 或 Vue 组件。如果确实需要这类效果，应单独提出需求，再完成以下站点级改造：

1. 接入 Astro MDX 集成。
2. 扩展内容集合，使其识别 `.mdx`。
3. 编写可复用且兼容移动端的组件。
4. 增加构建、安全、无障碍和浏览器测试。

不要直接在文章中加入来源不明的脚本，也不要为了单篇文章引入大型前端框架。

## 7. 本地预览与发布

写作过程中运行：

```bash
npm run dev
```

完成后至少运行：

```bash
npm run verify:content
npm run verify:visual-background
npm run build
```

最后一条命令会生成 Pagefind 搜索索引，并运行 `verify:dist` 检查文章的 Canonical、社交元数据、JSON-LD、RSS、Sitemap 和搜索边界。

推荐发布流程：

1. 从 `master` 创建文章分支。
2. 新建或修改专题。
3. 新建文章、正文插图和独立背景。
4. 本地预览桌面端和移动端。
5. 将 `draft` 改为 `false`。
6. 运行完整构建。
7. 推送分支并创建 Pull Request。
8. 合并后等待 GitHub Pages 工作流完成，再检查公开文章地址。

如果只想先保存文章而不公开，可以保持 `draft: true`，但仍应保证 frontmatter 和背景配置能够通过构建校验。
