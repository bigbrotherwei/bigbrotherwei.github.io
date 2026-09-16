# Personal Blog Rebuild Design

Date: 2026-09-16
Repository: `bigbrotherwei/bigbrotherwei.github.io`
Current production branch: `master`
Target owner/title: `bigbrotherwei`

## Summary

Rebuild the personal blog as a maintainable static site with a Fluid-inspired visual language, first-class writing workflows, and room for embedded utility tools. The implementation should not copy source code from `fluid-dev/hexo-theme-fluid`; it should independently recreate the desired experience with modern static-site components.

The first implementation batch focuses on the blog foundation: framework, layout, homepage, article system, topic pages, a basic utility tools area, project/about pages, and GitHub Pages deployment. Traffic statistics and online-user counts are included in the architecture as a later phase, but are not part of the first batch.

## Current State

The current remote repository contains generated Hexo static output from 2021, including `index.html`, hashed JavaScript and CSS assets, article archives, fonts, and images. The repository does not currently contain the Hexo source project, reusable content structure, build scripts, package metadata, or GitHub Actions workflows.

The local workspace is an empty Git repository on `main` with no commits and no configured remote. Before implementation starts, the repository should be bootstrapped into a source-first project and connected to the GitHub repository.

## Goals

- Replace generated static output with a source-managed blog project.
- Use `bigbrotherwei` as the visible site title and brand.
- Build a Fluid-inspired, independently implemented visual style.
- Provide a city-night homepage hero with daily Chinese quotes.
- Support articles, topics, archives, tags, projects, about content, and utility tools.
- Make future maintenance PR-based: feature branch, review, merge, publish.
- Deploy automatically to GitHub Pages after approved merges.
- Keep the first batch small enough to ship safely.

## Non-Goals For First Batch

- Do not copy or modify `hexo-theme-fluid` source code.
- Do not implement visitor statistics or online-user tracking in the first batch.
- Do not build backend-dependent tools in the first batch.
- Do not add account login, private dashboards, or user-generated content.
- Do not migrate every possible historical artifact before the new foundation exists.
- Do not introduce a CMS unless a later requirement clearly justifies it.

## Recommended Architecture

Use Astro with Markdown/MDX content and static generation.

Recommended stack:

- Astro for routing, layouts, and static output.
- TypeScript for typed data and utility logic.
- Markdown/MDX for articles and long-form pages.
- CSS variables plus component-scoped CSS, or a restrained Tailwind setup if implementation benefits from it.
- Shiki or Astro-integrated highlighting for code blocks.
- Pagefind for static local search in a later early-stage PR.
- GitHub Actions for build and GitHub Pages deployment.

This stack keeps the site static, fast, and friendly to writing. It also gives enough component flexibility to build a real utility tools section, which would be awkward if the site remained only a themed Hexo output.

## Branch And Deployment Model

Target model:

- `main` stores source code, content, configuration, and documentation.
- GitHub Actions builds the site from `main`.
- GitHub Pages serves the generated artifact or a deployment branch managed by the workflow.
- Future changes are made on feature branches and opened as pull requests.

The implementation should include a README describing:

- How to install dependencies.
- How to run the site locally.
- How to create an article.
- How deployment works.
- How to request future changes through PRs.

## Visual Direction

The visual language should be inspired by Fluid, especially:

- Immersive full-viewport hero.
- Transparent top navigation on the hero.
- Glass-like navigation background after scrolling.
- Material-influenced cards.
- Comfortable article reading layout.
- Table of contents on article pages.
- Dark mode support.
- Local search experience.

The implementation must be original. It may use the same broad design ideas, but must not copy Fluid templates, scripts, stylesheets, assets, or configuration files.

Primary mood:

- City night.
- Quiet, reflective, technical.
- Blue-black and cool gray base colors.
- Small amber or cyan accents.
- Clean Chinese reading experience.

Avoid:

- Overly saturated cyberpunk styling.
- Marketing-style hero copy.
- Decorative blobs, orbs, and purely ornamental gradients.
- Stock-like imagery that makes the site feel generic.

## Homepage Design

The homepage first viewport is a large city-night cover.

Hero content:

- Center title: `bigbrotherwei`.
- Subtitle area: one daily Chinese quote.
- Quote attribution: author and source when available.
- Down-scroll affordance leading to the content section.

Navigation:

- Transparent over the hero at page top.
- Changes to glass/blur background after scroll.
- Desktop navigation shows main sections.
- Mobile navigation collapses into a compact menu.

Below the hero:

- Latest articles.
- Featured articles.
- Topic highlights.
- Utility tools entry.
- Project highlights.
- About/profile teaser.

The homepage should reveal a hint of the next section on common desktop and mobile viewports when possible, so the hero feels immersive without becoming a dead end.

## Daily Quote Module

The daily quote module is local and deterministic.

Requirements:

- Chinese-first quotes.
- No manual "switch quote" button.
- Same date shows the same quote for all visitors.
- The quote changes automatically by date.
- No external quote API.
- The quote data is easy to expand.

Initial dataset:

- At least 100 quotes in the first batch.
- Prefer public-domain classical Chinese, literature, philosophy, science, and personal-growth quotes.
- Avoid unsourced internet quote collections and likely misattributed celebrity quotes.

Data shape:

```ts
type Quote = {
  text: string;
  author: string;
  source?: string;
  tags: string[];
};
```

Selection logic:

- Calculate a stable day index from the local date or UTC date.
- Use modulo against the quote list length.
- Return the selected quote to the hero component.

Display example:

```text
知者不惑，仁者不忧，勇者不惧。
-- 孔子《论语》
```

## Navigation And Information Architecture

Main navigation:

- Home: `/`
- Articles: `/posts`
- Topics: `/topics`
- Tools: `/tools`
- Projects: `/projects`
- About: `/about`

Secondary pages:

- Archive: `/archive`
- Tags: `/tags`
- Categories: `/categories`
- Search: `/search`

Articles and topics have different responsibilities:

- Article: a single independent post, usually time-based.
- Topic: a curated series or learning path that groups related posts in a meaningful order.
- Category: a broad content bucket such as technical notes or life essays.
- Tag: a fine-grained keyword such as Astro, GitHub Pages, CSS, AI, or tooling.

Example:

- Article: "How GitHub Actions Publishes This Blog"
- Topic: "Personal Blog Rebuild"
- Category: "Technical Notes"
- Tags: "Astro", "GitHub Pages", "CI"

## Content Model

Use content collections for posts, topics, tools, and projects.

Post frontmatter:

```yaml
title:
description:
date:
updated:
category:
tags:
featured:
draft:
cover:
topic:
```

Topic frontmatter:

```yaml
title:
description:
slug:
cover:
status:
posts:
```

Tool frontmatter:

```yaml
title:
description:
slug:
category:
tags:
featured:
status:
```

Project frontmatter:

```yaml
title:
description:
slug:
repo:
demo:
status:
tags:
cover:
```

Draft content should not publish in production builds.

## Article Experience

Article pages should include:

- City/night-compatible page header or article cover.
- Title, description, date, update date, category, tags, and reading time.
- Main content column with comfortable width.
- Table of contents on desktop.
- Collapsible or inline table of contents on mobile.
- Code highlighting.
- Previous and next article links.
- Related posts by topic or tags.
- Optional copyright notice.

Comments are not part of the first batch. Giscus can be considered later if comment support is desired.

## Topics Experience

Topics are curated pages, not just filtered article lists.

Each topic page should include:

- Topic title and description.
- Status such as planned, active, or complete.
- Ordered post list.
- Reading progress concept for visitors, if simple to implement.
- Optional intro text explaining why the topic exists.

Initial likely topic:

- "个人博客重构"

## Utility Tools Section

The `Tools` navigation item is a first-class page inspired by tool directory sites such as tool.lu. It should feel native to the blog, not like an external portal pasted into it.

Tools homepage:

- Search input.
- Category filters.
- Featured tools.
- Tool cards with title, description, category, and tags.
- Responsive dense layout that scans well.

First-batch tools should be browser-only and not require a backend:

- JSON formatter, compressor, and validator.
- Base64 encode/decode.
- URL encode/decode.
- Timestamp converter.
- UUID generator.
- Word/character counter.
- Text diff.
- Markdown preview.
- Mermaid preview if feasible without bloating the first batch.
- Regex tester if feasible without bloating the first batch.

Tool routes:

- `/tools`
- `/tools/json`
- `/tools/base64`
- `/tools/url`
- `/tools/timestamp`
- `/tools/uuid`
- `/tools/text-counter`
- `/tools/diff`
- `/tools/markdown`

Implementation preference:

- Shared tool layout.
- Small focused components per tool.
- Tool logic kept separate from UI components.
- No upload to a server for local text transformations.

## Projects Section

The projects page should present selected work, experiments, and repositories.

Each project card should show:

- Name.
- Short description.
- Tags.
- GitHub link when available.
- Demo link when available.
- Status.

This section should support both real projects and lightweight experiments connected to blog posts or tools.

## About Page

The about page should be personal but concise.

Recommended sections:

- Short introduction.
- Technical interests.
- Current focus.
- Selected links.
- Timeline or milestones.
- Contact links.

The tone should match a personal technical blog: direct, human, and not overly formal.

## Search

Search should be static and privacy-friendly.

Recommended approach:

- Use Pagefind after the basic site structure exists.
- Search posts, topics, tools, and project descriptions.
- Exclude draft content.

Search can be implemented after the first page structure is stable if needed for PR sizing.

## Dark Mode

Dark mode is required eventually and should be accounted for from the start.

The first batch should define tokens for:

- Background.
- Surface.
- Surface elevated.
- Text primary.
- Text muted.
- Border.
- Accent.
- Code background.

If full toggle implementation is too large for the first PR, the token system must still not block adding it later.

## Traffic Statistics And Online Users

This is a planned later-phase feature and is not implemented in the first batch.

Desired metrics:

- Total page views.
- Total unique visitors.
- Current online visitor count.
- Per-article views.
- Per-tool views.

Recommended later architecture:

- Cloudflare Worker or similar serverless endpoint.
- D1 or KV for lightweight storage.
- Anonymous browser visitor ID stored locally.
- `/api/visit` for page-load events.
- `/api/heartbeat` every 30 seconds while the page is active.
- Online count calculated as visitors with heartbeat within the last 90 seconds.

Privacy rules:

- Do not collect account identity.
- Do not store plaintext IP addresses.
- Do not require login.
- Do not show fake placeholder statistics before the feature exists.

Design reservation:

- Footer can reserve a future statistics area.
- Homepage can later display subtle metrics such as total visits and online users.
- Article pages can later show read counts.

## First-Batch Scope

The first implementation batch should include:

- Astro project setup.
- Source-first repository structure.
- GitHub Pages build/deploy workflow.
- Base layout and navigation.
- Fluid-inspired city-night homepage hero.
- `bigbrotherwei` site title.
- Daily local Chinese quote module with at least 100 quotes.
- Posts collection and article detail page.
- Article listing page.
- Topics collection and topic listing/detail pages.
- Tools landing page and several simple browser-only tools.
- Projects page.
- About page.
- Basic SEO metadata.
- Responsive desktop and mobile layouts.
- README maintenance documentation.

The first implementation batch should not include:

- Statistics backend.
- Online-user tracking.
- Comments.
- External CMS.
- Backend-dependent tools.
- Full historical-content migration beyond a small seed set.

## Suggested PR Sequence

PR 1: Project foundation

- Initialize Astro project.
- Add TypeScript, base config, source directories, and GitHub Pages workflow.
- Add README and build scripts.

PR 2: Visual system and homepage

- Add design tokens, layout, navigation, city-night hero, and daily quote module.
- Add responsive homepage sections.

PR 3: Content system

- Add posts, topics, tags, categories, archive, and article pages.
- Add seed content and frontmatter validation.

PR 4: Utility tools foundation

- Add tools directory, tool cards, search/filter UI, and first browser-only tools.

PR 5: Projects and about

- Add projects collection, projects page, about page, and social/contact links.

PR 6: Polish and production readiness

- Add SEO refinements, accessibility pass, performance pass, error/empty states, and deployment validation.

Later PRs:

- Static search.
- Dark-mode toggle if not fully completed earlier.
- Giscus comments if desired.
- Traffic statistics and online-user service.
- Additional utility tools.

## Acceptance Criteria

The first batch is successful when:

- The site builds locally and in GitHub Actions.
- The generated site can deploy to GitHub Pages.
- The homepage shows a city-night hero with `bigbrotherwei` and a daily Chinese quote.
- Navigation works across desktop and mobile.
- Articles, topics, tools, projects, and about pages exist.
- Markdown articles render with code highlighting and readable typography.
- Utility tools work fully in the browser without a backend.
- Draft content is excluded from production.
- README explains local development, writing, and publishing.
- No Fluid source code is copied into the project.

## Risks And Mitigations

Risk: The current repository only has generated output.

Mitigation: Treat the rebuild as a source-first replacement, preserving old content manually where useful.

Risk: First batch becomes too large.

Mitigation: Use the PR sequence above and keep statistics, comments, and backend tools out of the first batch.

Risk: City-night hero harms readability.

Mitigation: Use a dark overlay, text shadow, and responsive image positioning; verify on desktop and mobile.

Risk: Quote attribution is inaccurate.

Mitigation: Prefer classical/public-domain sources and keep the quote data easy to review.

Risk: Tool pages bloat the initial bundle.

Mitigation: Split tools into separate routes and avoid heavy libraries unless a tool clearly needs them.

## Open Implementation Notes

- Choose final package manager during implementation, with `npm` as the default unless the repo indicates otherwise.
- Use an original city-night asset with a clear license or generated image asset.
- Keep all future backend/statistics configuration outside the first deployment path.
- Prefer small focused components over large all-purpose page files.
