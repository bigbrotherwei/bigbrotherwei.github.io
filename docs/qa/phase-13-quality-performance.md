# 第十三阶段：背景、窄屏与键盘 QA

检查日期：2026-10-13。对象：本地 `dist/` 的 Astro 生产预览（`http://127.0.0.1:4337`），分支 `codex/phase-13-quality-audit`，包含背景预加载校验提交 `95f4e2d`。以下是抽查结果，不代表所有文章或设备。浏览器截图在检查时查看，未保存为仓库附件。

## 抽查矩阵与方法

| 页面 | 路由 | 320px | 390px | 1280px |
| --- | --- | --- | --- | --- |
| 首页 | `/` | 浅/深 | 浅/深 | 浅/深 |
| 文章详情 | `/posts/foundationdb-three-node-performance/` | 浅/深 | 浅/深 | 浅/深 |
| 专题详情 | `/topics/foundationdb/` | 浅/深 | 浅/深 | 浅/深 |
| 搜索 | `/search/` | 浅/深 | 浅/深 | 浅/深 |
| Markdown 工具 | `/tools/markdown/` | 浅/深 | 浅/深 | 浅/深 |

浏览器视口高度为 800px。通过站内“选择主题”分别指定浅色和深色，每次切换路由后确认 `html[data-theme]`；检查 `document.documentElement.scrollWidth - innerWidth` 和实际计算的背景图。30 个页面/宽度/主题组合的页面级水平溢出均为 **0px**，七个主导航链接在各组合中均保留。320px 的首屏截图人工查看了文章、搜索和 Markdown 工具；320px 首页也查看了截图。截图没有持久留档，视觉结论仅限当次观察。

动态效果只在浏览器默认设置下观察，**未控制或确认 `prefers-reduced-motion` 状态**。本次 CUA 浏览器能力清单仅提供视口覆盖，没有媒体偏好模拟；尝试访问 Chrome 原生开发者控件被工具拒绝。未更改系统设置。源码有 `prefers-reduced-motion: reduce` 规则（隐藏环境动画，取消首页插画动画及主内容入场动画等），但这不是浏览器行为验收。人工补测：在 Chrome DevTools 的 Rendering 面板依次将 `Emulate CSS media feature prefers-reduced-motion` 设为 `no-preference` 和 `reduce`，每次重新加载首页与文章页；查看 `main` 入场动画、`.ambient-motion`、首页 `.farm-night__fairy` 等元素的计算 `animation`/`display`，观察画面并各留一张截图；退出时恢复模拟为默认。其余未逐格查看的长内容、点击区域和视觉对比也需人工复核，不能由 `scrollWidth` 为 0 推断全部可读。

## 背景基线

下表的体积是 `dist/` 文件大小（字节），**不是网络传输体积**。浏览器计算样式在 320/390px 指向手机图，在 1280px 指向桌面图；每页 HTML 各有一条手机 `(max-width: 640px)` 和桌面 `(min-width: 640.01px)` 的高优先级图片预加载声明。

| 页面 | 320/390px 计算背景，文件字节 | 1280px 计算背景，文件字节 |
| --- | --- | --- |
| 首页 | `hand-painted-farm-dusk-mobile.webp`，132,048 | `hand-painted-farm-dusk.webp`，302,630 |
| 文章 | `post-writing-components-mobile.webp`，171,292 | `post-writing-components.webp`，183,116 |
| 专题 | `topic-foundationdb-mobile.webp`，229,508 | `topic-foundationdb.webp`，239,630 |
| 搜索 | `search-index-mobile.webp`，199,504 | `search-index.webp`，185,016 |
| Markdown 工具 | `tool-markdown-mobile.webp`，268,788 | `tool-markdown.webp`，312,434 |

为补齐请求基线，在一个此前未访问的本地源 `http://127.0.0.1:43789` 启动临时静态服务器，记录 `.webp` 请求的 URL、HTTP 状态及是否带 `If-None-Match`。服务器对文件设置 `Cache-Control: public, max-age=0, must-revalidate` 和 `ETag`，首取返回 200，条件命中返回 304。Chrome CUA 在 320px 和 1280px 分别打开/重新加载页面，等到 `networkidle` 后读取日志；第一次请求对应此前未访问的图片 URL。首页桌面图在新标签初次打开时取得，手机版图在首次切到 320px 时取得；其余页面逐页首取并重新加载。同一视口再次加载时，下表每个背景 URL 都出现一次带条件头的 304。调整视口时，离开前页面的旧背景偶有额外 304，未计入目标页面的加载记录。

| 页面 | 320px 首取 / 重新加载 | 1280px 首取 / 重新加载 |
| --- | --- | --- |
| 首页 | `hand-painted-farm-dusk-mobile.webp`：200 / 304 | `hand-painted-farm-dusk.webp`：200 / 304 |
| 文章 | `post-writing-components-mobile.webp`：200 / 304 | `post-writing-components.webp`：200 / 304 |
| 专题 | `topic-foundationdb-mobile.webp`：200 / 304 | `topic-foundationdb.webp`：200 / 304 |
| 搜索 | `search-index-mobile.webp`：200 / 304 | `search-index.webp`：200 / 304 |
| Markdown 工具 | `tool-markdown-mobile.webp`：200 / 304 | `tool-markdown.webp`：200 / 304 |

以上目标页面的首取和重新加载日志中，均未出现**该页**另一视口背景的请求；这是在此临时服务器、这两个视口及此轮导航下的请求事实，不外推到 GitHub Pages 的缓存策略。首页另有月亮/精灵等装饰 WebP 请求，未纳入背景变体计数。304 表明浏览器发出了条件请求并复用了已缓存的图片正文，**不是零网络流量**。服务器日志中的 200 文件长度来自磁盘元数据，不能作为浏览器传输字节；传输字节、背景可见耗时及瞬时闪烁仍为**未测**。导航后的截图可见背景，未观察到持续纯色；没有性能修改，故无同条件前后对比。

## 布局与交互

- 320/390/1280px、浅/深两种指定主题下，上述五页无页面级横向滚动。320px 文章中的代码块可在自身容器内水平滚动（所测首块 `scrollWidth` 387px、`clientWidth` 256px），页面保持 320px；表格未推动页面变宽。长标题在 320px 折行，首屏导航未遮住标题。
- 320px 搜索：聚焦“搜索关键词”并输入 `FoundationDB`，状态从“正在搜索”变为“找到 7 条结果”，结果链接可见，页面仍为 320px。此项验证本地索引的主要输入路径；未覆盖所有关键词。
- 320px Markdown 工具：在“Markdown 内容”输入含标题、列表、表格的文本，预览随后出现对应结构，状态为“预览已更新”，页面仍为 320px；未选择本地文件。
- 320px 键盘：从搜索页连续按 Tab，焦点依次到达品牌、主导航各链接、主题按钮和搜索框。聚焦链接及 Markdown 输入框的计算轮廓为 `solid 3px`，截图中导航焦点框可见。主题按钮可用 Enter 展开菜单，Escape 关闭并返回按钮。图标导航链接在可访问性树中有“首页”“文章”“专题”“实用工具”“关于”“搜索”等名称。

复测步骤：启动本分支生产预览；将浏览器设为 320px × 800px；依次打开上述路由并从主题菜单切换浅/深；检查背景、页面右侧是否出现水平滚动；在文章中查看代码和表格；在搜索框输入 `FoundationDB`；在 Markdown 编辑框输入标题/列表/表格；从页面起始处按 Tab 到主题按钮，再用 Enter/Escape 操作。390px 与 1280px 重复背景和页面宽度检查。

## 结论与待补检查

本次可复现检查未发现需要修改页面或样式的缺陷，因此没有针对性失败测试或修复提交。代表页背景变体的首次请求及条件重新加载、页面宽度、搜索和 Markdown 主要输入、基础键盘焦点在上述实测范围内通过。**尚未验收**：浏览器真实传输字节、背景可见时间与瞬时闪烁、已部署站点的缓存行为、减少动态效果浏览器行为、全部点击区域及完整长文视觉检查。补齐浏览器 Network 和媒体偏好控制后，再决定是否有性能优化或独立修复 PR 的依据。
