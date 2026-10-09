# Vercount 访问统计部署与验收

本站使用 [Vercount](https://github.com/EvanNotFound/vercount) 托管的公开脚本统计全站访问量（PV）、累计访客数（UV）和文章页面访问量。GitHub Pages 仍负责静态页面；合并本次 PR 后重新部署即可接入统计，不需要 Cloudflare Worker、D1、API 密钥或 GitHub Actions 统计变量。本站不再展示当前在线人数，因为 Vercount 没有提供这一指标。

## 发布前

1. 确认 GitHub Pages 的 Source 为 **GitHub Actions**，部署工作流运行成功。
2. 以前设置的 Repository Variable `PUBLIC_ANALYTICS_API_URL` 已不被构建读取，可以从 **Settings → Secrets and variables → Actions → Variables** 手动删除。旧版 Worker 和 D1 不会被本次代码变更自动删除；确认新统计正常后再自行停用 Worker，并在需要保留历史数据时先备份 D1。
3. 旧版 Cloudflare 统计数字不会自动导入 Vercount。新数据从 Vercount 接入后开始累计；不同域名或子域名的统计可能分别计算，正式验收请使用线上域名。

## 验收

1. 打开线上首页，确认“总访问量”和“累计访客”由“加载中”更新为数字；打开任意文章，确认“阅读次数”更新为数字。当前在线人数应已移除。
2. 在浏览器开发者工具的网络面板确认脚本来自 `https://events.vercount.one/js`，且不再请求旧 Worker 的 `/visit`、`/heartbeat`、`/stats` 接口。浏览器拦截第三方脚本或 Vercount 暂不可用时，数字应显示“暂不可用”，正文、导航和评论仍可使用。
3. 在另一个浏览器配置中重复访问进行对照。Vercount 使用 Cookie 识别访客；UV 并非严格的独立真人数，具体更新时机以服务端结果为准，不要根据单次刷新判断故障。

本地预览地址与正式站点域名可能产生不同计数，不能用本地数字核对线上历史。访问统计会向第三方服务发起请求，详情见[隐私说明](../src/pages/privacy.astro)。

## 故障与回退

若页面始终显示“暂不可用”，先检查浏览器是否拦截脚本、网络请求是否成功，以及 Vercount 服务是否可用。若需要停用统计，应通过新的代码变更移除全站脚本并重新部署；旧版 `PUBLIC_ANALYTICS_API_URL` 变量不会控制 Vercount。不要为了重新计数而删除旧 D1 数据。
