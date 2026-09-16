# bigbrotherwei.github.io

`bigbrotherwei` 的个人博客源码工程。

## 技术栈

- Astro
- TypeScript
- Markdown/MDX 内容体系
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

文章系统和实用工具系统还没有在第一阶段实现。新增文章、专题、工具和项目的具体写作方式，会在对应阶段完成后补充到本文档。

## 第一阶段范围

第一阶段只建立基础工程能力：

- Astro 项目骨架
- 最小首页
- 全局基础样式
- GitHub Pages workflow
- 本地开发和维护说明

后续阶段会继续实现：

- Fluid-inspired 城市夜景视觉系统
- 每日中文名言库
- 文章和专题内容系统
- 实用工具页面
- 项目页和关于页完善
- 搜索
- 暗色模式
- 访问统计和当前在线人数

## 设计文档

- 中文设计文档：`docs/superpowers/specs/2026-09-16-blog-rebuild-design.zh.md`
- 英文设计文档：`docs/superpowers/specs/2026-09-16-blog-rebuild-design.md`
- 第一阶段实现计划：`docs/superpowers/plans/2026-09-16-blog-foundation.md`
