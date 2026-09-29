# 访问统计部署与验收

博客静态页面发布到 GitHub Pages；统计 API 单独运行在 Cloudflare Worker，计数保存在 D1。Pages workflow 只把公开的 `PUBLIC_ANALYTICS_API_URL` 传给 Astro 构建，不持有 Cloudflare 凭据，也不创建或部署 Worker。合并代码不会自动启用线上统计；以下远端步骤由站点所有者手动执行。

## 准备与本地验证

在仓库根目录安装依赖并验证：

```bash
npm ci
npm run verify:worker
npm run verify:analytics
npm run build
```

下列 Wrangler 命令均在仓库根目录执行，显式指定 `worker/wrangler.jsonc`。先用 Wrangler 登录所需的 Cloudflare 账号（`npx wrangler login`）；不要把登录凭据、API token、D1 ID 当作 Pages 变量或提交到仓库。

## 创建 D1 并迁移

1. 创建生产 D1：

   ```bash
   npx wrangler d1 create blog-analytics --config worker/wrangler.jsonc
   ```

2. 将输出的真实 D1 UUID 填入 `worker/wrangler.jsonc` 的 `d1_databases[0].database_id`，替换 `00000000-0000-0000-0000-000000000000`。确认绑定名仍为 `DB`，数据库名与创建结果一致。该 ID 是资源标识，不是密钥；不要填入 `VISITOR_HMAC_KEY`。

3. 将仓库中的 `worker/migrations/0001_statistics.sql` 应用到远端数据库，确认迁移成功后再部署 Worker：

   ```bash
   npx wrangler d1 migrations apply blog-analytics --remote --config worker/wrangler.jsonc
   ```

迁移会创建汇总、文章浏览、访客哈希、近期访问和在线状态表。对已有生产库先确认备份与迁移状态；不要删除 D1 来重试。

## 设置 Worker 并手动部署

1. 检查 `worker/wrangler.jsonc` 中 `ALLOWED_ORIGINS`：填实际站点 Origin，例如 `https://bigbrotherwei.github.io`；本地联调可保留 `http://localhost:4321`。只写 Origin，不能带路径或末尾斜杠。若以后启用自定义域名，应增列其精确 Origin，并重新部署 Worker。浏览器发出的 `Origin` 不在列表中会得到 403。
2. 检查 `triggers.crons` 当前为 `0 * * * *`（cron，每小时清理超过 24 小时的在线与近期访问记录）。确认 Cloudflare 账号允许该定时触发器；部署后在 Worker 设置中核对它已生效。
3. 在本机生成足够长的随机 HMAC 密钥，通过 Wrangler 的交互提示输入，避免写进 shell 历史、仓库文件或构建日志：

   ```bash
   npx wrangler secret put VISITOR_HMAC_KEY --config worker/wrangler.jsonc
   ```

4. 手动部署 Worker，记下 Wrangler 返回的公开 `https://...workers.dev` 地址：

   ```bash
   npx wrangler deploy --config worker/wrangler.jsonc
   ```

Worker 使用 `DB`、`VISITOR_HMAC_KEY` 和 `ALLOWED_ORIGINS`；密钥只存在于 Worker secret 中。保持 `worker/wrangler.jsonc` 的真实 D1 ID 与线上绑定一致。后续 Worker 修改也由所有者手动迁移、部署；现有 Pages workflow 不负责这一步。

## API 验证与 Pages 激活

将下例的 Worker URL 换成实际部署地址，使用站点 Origin 检查公开读取接口：

```bash
curl -i -H 'Origin: https://bigbrotherwei.github.io' 'https://YOUR-WORKER.workers.dev/stats?path=%2F'
```

预期为 HTTP 200、`Access-Control-Allow-Origin` 为该站点，JSON 包含数字 `pv`、`uv`、`online`。新库初始值为零；若得到 503，检查远端迁移与 D1 绑定。无 `Origin` 或未允许的 Origin 应返回 403。写入接口 `POST /visit`、`POST /heartbeat` 需要合法 JSON 和浏览器 UUID；首次浏览器验收比人工写入生产数据更合适。

在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 中设置 Repository Variable `PUBLIC_ANALYTICS_API_URL` 为上述 Worker 地址，末尾可有斜杠。它是公开 URL，会进入静态 JavaScript；绝不能填 HMAC 密钥。然后到 **Actions → Deploy to GitHub Pages → Run workflow** 触发新的 Pages 构建。仅修改变量不会更新已发布页面。Pull Request 未读取到该变量时仍应正常构建。

## 两个浏览器与离线验收

用桌面和移动端视口检查首页、任意文章和普通静态页面，打开浏览器网络面板：

1. 在第一个浏览器新配置中打开首页。应看到 `/visit`、`/heartbeat` 和 `/stats?path=%2F` 请求；首页 PV、UV 和在线数由“加载中”变为数字。文章页应只显示该文章 `reads`，静态正文仍完整。
2. 在同一浏览器另开标签页，在线人数应按同一个本地访客 ID 去重。等待至少 5 秒后刷新，PV 增加而 UV 不增加。
3. 在第二个独立浏览器配置或无痕会话打开网站，UV 和在线人数应增加。两个浏览器都切到后台并等待超过 90 秒，保持它们不在前台，用上面的 `curl` 命令单独读取 `/stats`，在线人数应下降；重新激活标签会立即发送心跳。在线数是近 90 秒估计值，不是精确在线用户数。
4. 在桌面与移动端分别模拟 API 离线或网络请求失败，首页及文章统计应显示“暂不可用”，不能显示误导性的零；正文、导航、搜索和评论入口仍可使用。未设置公开 URL 的构建不应发出统计请求。

如数字异常，先查看浏览器请求的 URL、状态码和 CORS 响应，再核对 Worker 的 Origin、secret、D1 绑定和迁移。不要把访客 ID、HMAC 密钥或完整请求体贴到公开 issue/log。

## 滥用、配额与回退

`Origin` 检查用于浏览器跨域访问控制，不能阻止伪造 HTTP 客户端；公开 API 可能被重复请求。当前实现通过路径/JSON 校验、2 KiB 请求上限、同访客同路径 5 秒计数窗口限制一部分滥用，但没有全局限流。上线后监控 Cloudflare Workers 请求量、D1 读写量、错误率及套餐配额；如遭滥用，先停用 Pages 统计变量，再按需要在 Cloudflare 配置 WAF/速率限制或暂停 Worker 路由。不要把统计数据当作严格的独立真人数。

回退 Pages 展示：删除或清空 Repository Variable `PUBLIC_ANALYTICS_API_URL`，重新运行 Pages workflow。新静态构建不再请求 Worker，统计显示“暂不可用”，正文不受影响。若需回退 Worker 版本，由所有者在 Cloudflare 中恢复上一个可用部署；保留 D1 数据并在确认兼容后处理迁移，不要盲目删除数据库。再次启用时，确认 Worker 健康后重设公开 URL 并重新构建 Pages。
