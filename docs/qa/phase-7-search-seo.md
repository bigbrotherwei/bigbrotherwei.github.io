# 阶段七：搜索与 SEO 验收记录

## 构建基线

- 分支：`codex/phase-7-search-seo-20260923`
- 当前内容：3 篇公开文章、2 个专题、6 个工具、1 个项目
- 生产页面：30 个 HTML
- Pagefind：12 个详情页，1 种语言（`zh-cn`）

## 自动验证

- `npm run verify`
- `npm run astro -- check`
- `npm run build`
- `git diff --check`

`npm run build` 的最终 `verify:dist` 必须报告 HTML、RSS 与可搜索详情数量，并验证 Canonical、社交元数据、JSON-LD、RSS、Sitemap、robots 和 Pagefind 文件。

## 浏览器验收

生产预览地址：`http://127.0.0.1:4325/`。

### 桌面端

- 视口：`1440 x 900`。
- 背景：加载 `/images/backgrounds/search-index.webp`，标题、输入框和结果面板可读，没有元素重叠。
- `Astro`：4 条结果，覆盖项目、文章和专题。
- `博客`：6 条结果，覆盖文章、专题和项目。
- `JSON`：2 条结果，覆盖工具和专题。
- `个人博客`：5 条结果，覆盖专题、文章和项目。
- 查询快速从 `Astro` 替换为 `JSON` 后，只显示 JSON 结果。
- 点击首条 JSON 结果成功进入 `/tools/json/`。
- 成功流程控制台：0 error、0 warning。

### 移动端

- 视口：`390 x 844`。
- 背景：加载 `/images/backgrounds/search-index-mobile.webp`。
- 导航换行正常，搜索图标保持 `2.25rem` 固定尺寸。
- `博客` 返回 6 条结果；结果卡片、摘要和类型标签没有横向溢出。
- 页面 `scrollWidth` 不大于视口宽度，输入焦点轮廓清晰。

### 状态与失败路径

- 清空输入后回到“输入关键词开始搜索”，显示空闲提示并隐藏结果。
- 无匹配查询显示“未找到匹配内容”。
- 临时移走 `dist/pagefind/pagefind.js` 后，新页面显示“搜索暂时不可用，请稍后重试”；随后已恢复文件。
- 初次验收发现生产脚本包含未替换的 `__VITE_PRELOAD__`，会让搜索停在加载态。修复为由未经过 Vite 处理的页面模块加载 Pagefind，再把 loader 注入已测试的控制器；`verify:dist` 已增加对应回归检查。

### 发布信息

- 首页 Canonical：`https://bigbrotherwei.github.io/`；JSON-LD：`WebSite`。
- 文章 Canonical：`https://bigbrotherwei.github.io/posts/blog-rebuild-roadmap/`；Open Graph 类型：`article`；JSON-LD：`BlogPosting`、`BreadcrumbList`。
- `/rss.xml`、`/sitemap-index.xml`、`/robots.txt` 本地 HTTP 状态均为 `200`，类型分别为 `text/xml`、`text/xml`、`text/plain`。
- 内置浏览器会拦截直接展示本地原始 XML，内容正确性由 `verify:dist` 的结构化产物检查覆盖。

阶段七搜索页面实现提交：`6c1690e feat: add illustrated static search experience`。
