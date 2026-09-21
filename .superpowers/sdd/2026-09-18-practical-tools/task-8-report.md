# Task 8 Report: Documentation and Browser QA

## Commits

- `3ff7012 docs: document practical tool workflows`
- 本次审查修复追加提交待生成。
- 未推送远端，未创建 Pull Request。

## Documentation Fixes

- `README.md` 将“当前已经上线六个纯前端工具”改为“本阶段已实现六个纯前端工具”。
- `docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md` 将“当前已上线”改为“本阶段已实现”，将未来工具说明改为“不属于首批已完成范围”。
- `src/content/topics/developer-toolbox.md` 将“第一批已经上线”改为“首批已完成”。

## Browser QA Evidence

本地服务：`http://127.0.0.1:4323`。

结构化日志：

- `/private/tmp/practical-tools-qa/qa-matrix.json`
- `/private/tmp/practical-tools-qa/layout-background-audit.json`

代表截图：

- 目录筛选：`tools-filter-time-desktop.png`、`tools-empty-time-encoding-desktop.png`、`tools-filter-keyboard-clear-desktop.png`
- 目录筛选移动端：`tools-filter-time-mobile.png`、`tools-empty-time-encoding-mobile.png`、`tools-filter-keyboard-clear-mobile.png`
- 六工具桌面端：`json-desktop.png`、`base64-desktop.png`、`url-desktop.png`、`timestamp-desktop.png`、`uuid-desktop.png`、`text-counter-desktop.png`
- 六工具移动端：`json-mobile.png`、`base64-mobile.png`、`url-mobile.png`、`timestamp-mobile.png`、`uuid-mobile.png`、`text-counter-mobile.png`

### Directory Filtering

在 1440 x 900 和 390 x 844 视口均验证：

- 初始状态显示 6 个工具。
- 搜索“时间”只显示“时间戳转换”。
- 搜索“时间”同时选择“编码”显示空状态。
- 使用真实键盘 `ControlOrMeta+A` + `Backspace` 清空搜索后，编码分类显示“Base64 编码解码”和“URL 编码解码”2 个工具。
- 点击“全部”后恢复 6 个工具。

注：in-app Browser 的 `fill('')` 对搜索框清空没有触发页面 input 更新，真实键盘路径正常，因此未作为产品 bug 修复。

### Per-tool Cases

桌面和移动端均验证成功路径、错误或边界路径、复制反馈、焦点样式：

- JSON：`{"name":"博客","items":[1,2]}` 格式化成功并复制 49 字符结果；`{"name":"博客",}` 显示 JSON 语法错误并保留输入。
- Base64：`博客🌙` 编码为 `5Y2a5a6i8J+MmQ==` 并可复制；解码 `%%%` 显示“Base64 无效”；长文本路径记录为当前解码模式下无效输入。
- URL：`搜索?q=中文` 编码为 `%E6%90%9C%E7%B4%A2%3Fq%3D%E4%B8%AD%E6%96%87` 并可复制；解码 `%E0%A4%A` 显示 `URI malformed`。
- 时间戳：`1700000000` 转为 `2023-11-14T22:13:20.000Z`；非数字显示“时间戳无效”；“现在”写入毫秒时间戳。
- UUID：未生成时“复制全部”显示“请先生成 UUID”；数量 `21` 被规范为 20 个；单项复制返回 36 字符 UUID。
- 字数统计：`Hello 博客\n第二行 words` 得到 18 字符、2 行、2 个英文词、5 个汉字；真实键盘清空后为 0 字符、0 行；100,000 个汉字显示性能提示并统计为 300,000 UTF-8 字节。

### Visual, Console, and Background Checks

`layout-background-audit.json` 覆盖 `/tools/` 和六个详情页，在 1440 x 900 与 390 x 844 均记录：

- 每个路由加载独立桌面/移动端背景资源。
- `horizontalOverflow` 为 `false`。
- 控件重叠数量为 0。
- console `error`、`warn`、`warning` 数量为 0。

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
- `npm run verify:tools`：53 / 53 通过。
- `npm run verify:visual-background`：通过。
- `npm run build`：包含 `verify`、`astro check` 和 `astro build`，结果为 0 errors、0 warnings、17 个静态页面构建完成。

## Residual Risk

- 本次 QA 基于本地开发服务。远端部署仍需在 PR 合并后由 GitHub Actions 完成并在公开站点抽查。
- 浏览器自动化的 `fill('')` 清空事件与真实键盘行为不一致；报告和证据采用真实键盘路径作为用户路径。
