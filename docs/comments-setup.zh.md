# 文章评论配置

文章评论使用公开仓库的 GitHub Discussions 和 Giscus。配置完成后，读者打开文章即自动连接 Giscus；可以点击“隐藏评论”移除评论框，再点击“显示评论”重新加载。未完成配置时，文章显示“评论未开放”，静态站仍可正常构建和发布。

## 仓库准备

1. 在目标公开仓库的 Settings → General → Features 中开启 **Discussions**。
2. 在 Discussions 中选择一个供文章评论使用的分类（例如 `Announcements` 或新建 `Comments`）。Giscus 推荐公告类型分类；即使读者不能直接在 GitHub 创建公告讨论，Giscus 仍可在收到首条评论时创建对应 Discussion。由仓库维护者在 GitHub Discussions 审核内容。
3. 由仓库所有者安装 [Giscus GitHub App](https://github.com/apps/giscus)，并授权目标仓库。此操作涉及 GitHub 账号授权，无法由本仓库代码自动完成。
4. 打开 [Giscus 配置页](https://giscus.app/zh-CN)，选择仓库和评论分类，确认仓库与分类符合页面提示，复制生成的仓库 ID、分类名称和分类 ID。文章使用 `pathname` 严格映射；修改文章标题不会迁移评论，修改文章路径时需人工处理对应 Discussion。

## Pages 构建变量

在 GitHub 仓库的 Settings → Secrets and variables → Actions → **Variables** 中设置下列四项。它们是公开配置，会进入静态页面；不要填入 access token、App 私钥或其他凭据。

| 变量 | 值 |
| --- | --- |
| `PUBLIC_GISCUS_REPO` | `owner/repo`，例如 `bigbrotherwei/bigbrotherwei.github.io` |
| `PUBLIC_GISCUS_REPO_ID` | Giscus 配置页给出的仓库 ID |
| `PUBLIC_GISCUS_CATEGORY` | 评论分类的名称，须与 GitHub 分类一致 |
| `PUBLIC_GISCUS_CATEGORY_ID` | Giscus 配置页给出的分类 ID |

部署 workflow 在 Astro 构建步骤读取这四项 Repository Variables。设置后通过 **Actions → Deploy to GitHub Pages → Run workflow** 触发新的 Pages 构建；已有静态页面不会因只修改变量而自动更新。Pull Request 的构建如果无法读取变量，也应以“评论未开放”状态通过。

## 上线检查与回退

发布后打开一篇文章，确认浏览器自动请求 `giscus.app/client.js` 且评论区显示。点击“隐藏评论”应移除评论框，点击“显示评论”应重新加载。用 GitHub 账号发表一条测试评论，确认它出现在该文章路径对应的 Discussion。首次评论前，Giscus 可能提示 `Discussion not found`，表示当前文章尚无对应 Discussion；评论框仍应可用，提交首条评论后才会创建对应 Discussion。再检查窄屏布局和真正加载失败时的重试、Discussions 链接。

需要临时停用时，清除任一项公开变量并重新运行 Pages 构建；文章阅读不受影响，评论区将显示“评论未开放”。已在 GitHub Discussions 中的评论不会被删除。隐私说明见站点的 `/privacy/` 页面。
