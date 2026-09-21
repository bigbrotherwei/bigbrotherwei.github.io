# Task 8 Report: Documentation and Browser QA

## Commits

- `3ff7012 docs: document practical tool workflows`
- `d71e2be docs: tighten tool QA evidence`
- 本次第 2 轮审查修复追加提交待生成。
- 未推送远端，未创建 Pull Request。

## Documentation Fixes

- `README.md` 将“当前已经上线六个纯前端工具”改为“本阶段已实现六个纯前端工具”。
- `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md` 将“当前已上线”改为“本阶段已实现”，将未来工具说明改为“不属于首批已完成范围”。
- `src/content/topics/developer-toolbox.md` 将“第一批已经上线”改为“首批已完成”。

## Browser QA Evidence

本地服务：`http://127.0.0.1:4323`。

结构化日志：

- `/private/tmp/practical-tools-qa-round2/qa-round2.json`

代表截图：

- 目录筛选桌面端：`tools-search-time-desktop.png`、`tools-search-time-encoding-empty-desktop.png`、`tools-encoding-after-keyboard-clear-desktop.png`
- 目录筛选移动端：`tools-search-time-mobile.png`、`tools-search-time-encoding-empty-mobile.png`、`tools-encoding-after-keyboard-clear-mobile.png`
- UUID 规范化：`uuid-21-normalized-desktop.png`、`uuid-21-normalized-mobile.png`

### Directory Filtering

在 1440 x 900 和 390 x 844 视口均验证：

- 初始状态显示 6 个工具。
- 搜索“时间”时，视觉可见标题只剩“时间戳转换”；其余 5 张卡片均记录为 `hidden: true` 且 `getComputedStyle(display) === "none"`。
- 搜索“时间”同时选择“编码”时，视觉可见卡片为 0，空状态可见且 `display === "block"`。
- 使用真实键盘 `ControlOrMeta+A` + `Backspace` 清空搜索后，编码分类视觉可见“Base64 编码解码”和“URL 编码解码”2 个工具。

根因与修复：`card.hidden = true` 已正确设置，但 `.content-card { display: grid; }` 会覆盖浏览器 UA hidden 样式。新增全局 `[hidden] { display: none !important; }`，并增加回归测试 `keeps hidden tool cards visually removed even when card classes set display`。

### Per-tool Cases

桌面和移动端均验证成功路径、错误或边界路径、复制反馈、焦点样式：

- JSON：`{"name":"博客","items":[1,2]}` 格式化成功并复制 49 字符结果；`{"name":"博客",}` 显示 JSON 语法错误并保留输入。
- Base64：`博客🌙` 编码为 `5Y2a5a6i8J+MmQ==` 并可复制；解码 `%%%` 显示“Base64 无效”；长文本路径记录为当前解码模式下无效输入。
- URL：`搜索?q=中文` 编码为 `%E6%90%9C%E7%B4%A2%3Fq%3D%E4%B8%AD%E6%96%87` 并可复制；解码 `%E0%A4%A` 显示 `URI malformed`。
- 时间戳：`1700000000` 转为 `2023-11-14T22:13:20.000Z`；非数字显示“时间戳无效”；“现在”写入毫秒时间戳。
- UUID：数量输入 `21` 后，输入框值规范为 `20`，状态为“已生成 20 个 UUID”，`#uuid-results output` 记录 20 条结果，桌面和移动截图均证明结果存在。
- 字数统计：`Hello 博客\n第二行 words` 得到 18 字符、2 行、2 个英文词、5 个汉字；真实键盘清空后为 0 字符、0 行；100,000 个汉字显示性能提示并统计为 300,000 UTF-8 字节。

### Visual, Console, and Background Checks

`qa-round2.json` 覆盖 `/tools/` 和六个详情页，在 1440 x 900 与 390 x 844 均记录：

- 每个路由加载独立桌面/移动端背景资源。
- `horizontalOverflow` 为 `false`。
- 控件重叠数量为 0。
- console `error`、`warn`、`warning` 数量为 0。

重叠审计规则：只比较 `.page-shell` 内当前视口可见、未隐藏、尺寸大于 0 的互斥内容元素；固定导航、视口外元素和 `[hidden]` 子树不参与重叠判断。上一轮 text-counter 的 1 个 overlap 来自滚动位置下 fixed nav 与页面内容边缘交叉，不是内容区域真实遮挡。

## Automated Verification

本次审查修复提交前已重新执行：

```bash
git diff --check
npm run verify:tools
npm run verify:visual-background
npm run astro -- check
npm run build
```

- `git diff --check`：无输出。
- `npm run verify:tools`：54 / 54 通过，包含新增 hidden 视觉回归测试。
- `npm run verify:visual-background`：通过。
- `npm run build`：包含 `verify`、`astro check` 和 `astro build`，结果为 0 errors、0 warnings、17 个静态页面构建完成。

## Residual Risk

- 本次 QA 基于本地开发服务。远端部署仍需在 PR 合并后由 GitHub Actions 完成并在公开站点抽查。
- 本轮筛选 QA 同时记录 `hidden` 属性、computed `display` 和视觉可见标题，避免只检查 DOM 状态导致误判。
