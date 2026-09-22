import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'src/content.config.ts',
  'src/content/posts',
  'src/content/topics',
  'src/content/projects',
  'src/pages/posts/[slug].astro',
  'src/pages/topics/[slug].astro',
];
const failures = [];

const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

for (const path of requiredPaths) {
  if (!exists(path)) {
    failures.push(`Missing content system path: ${path}`);
  }
}

const parseFrontmatter = (source, filePath) => {
  const match = source.match(/^---\n([\s\S]*?)\n---/);
  if (!match) {
    failures.push(`${filePath} must start with YAML frontmatter`);
    return {};
  }

  const data = {};
  const lines = match[1].split('\n');

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const keyValue = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);

    if (!keyValue) {
      continue;
    }

    const [, key, rawValue] = keyValue;

    if (rawValue === '') {
      const values = [];
      let cursor = index + 1;
      while (cursor < lines.length && /^\s+-\s+/.test(lines[cursor])) {
        values.push(lines[cursor].replace(/^\s+-\s+/, '').replace(/^["']|["']$/g, ''));
        cursor += 1;
      }
      data[key] = values;
      index = cursor - 1;
      continue;
    }

    data[key] = rawValue.replace(/^["']|["']$/g, '');
  }

  return data;
};

const markdownFiles = (directory) => {
  const absoluteDirectory = join(root, directory);
  if (!existsSync(absoluteDirectory) || !statSync(absoluteDirectory).isDirectory()) {
    return [];
  }

  const files = [];
  const visit = (relativeDirectory) => {
    const absolute = join(root, relativeDirectory);

    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      const relativePath = join(relativeDirectory, entry.name);

      if (entry.isDirectory()) {
        visit(relativePath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(relativePath);
      }
    }
  };

  visit(directory);
  return files;
};

const topicFiles = markdownFiles('src/content/topics');
const postFiles = markdownFiles('src/content/posts');
const projectFiles = markdownFiles('src/content/projects');
const topicDirectory = join(root, 'src/content/topics');
const projectDirectory = join(root, 'src/content/projects');

if (topicFiles.length < 2) {
  failures.push('Expected at least 2 topic markdown files');
}

if (postFiles.length < 3) {
  failures.push('Expected at least 3 post markdown files');
}

if (projectFiles.length < 1) {
  failures.push('Expected at least 1 project markdown file');
}

if (!projectFiles.some((projectPath) => projectPath === 'src/content/projects/bigbrotherwei-github-io.md')) {
  failures.push('Expected seed project: src/content/projects/bigbrotherwei-github-io.md');
} else if (!read('src/content/projects/bigbrotherwei-github-io.md').includes('background: "project-personal-blog"')) {
  failures.push('Seed project must use the project-personal-blog background');
}

const topics = new Map();

for (const topicPath of topicFiles) {
  const data = parseFrontmatter(read(topicPath), topicPath);
  const slug = relative(topicDirectory, join(root, topicPath)).replace(/\\/g, '/').replace(/\.md$/, '');
  topics.set(slug, data);

  for (const key of ['title', 'description', 'status', 'order']) {
    if (!data[key]) {
      failures.push(`${topicPath} missing required frontmatter: ${key}`);
    }
  }
}

for (const postPath of postFiles) {
  const data = parseFrontmatter(read(postPath), postPath);

  for (const key of ['title', 'description', 'pubDate', 'tags', 'topic', 'order']) {
    if (!data[key] || (Array.isArray(data[key]) && data[key].length === 0)) {
      failures.push(`${postPath} missing required frontmatter: ${key}`);
    }
  }

  if (data.topic && !topics.has(data.topic)) {
    failures.push(`${postPath} references unknown topic: ${data.topic}`);
  }
}

const projectStatuses = new Set(['维护中', '实验中', '已完成', '已归档']);

for (const projectPath of projectFiles) {
  const data = parseFrontmatter(read(projectPath), projectPath);

  for (const key of ['title', 'description', 'status', 'startDate', 'tags', 'featured', 'order', 'background']) {
    if (!data[key] || (Array.isArray(data[key]) && data[key].length === 0)) {
      failures.push(`${projectPath} missing required frontmatter: ${key}`);
    }
  }

  if (data.status && !projectStatuses.has(data.status)) {
    failures.push(`${projectPath} has invalid project status: ${data.status}`);
  }

  for (const key of ['repository', 'website']) {
    if (!data[key]) {
      continue;
    }

    try {
      const url = new URL(data[key]);
      if (!['http:', 'https:'].includes(url.protocol)) {
        failures.push(`${projectPath} ${key} must use HTTP(S): ${data[key]}`);
      }
    } catch {
      failures.push(`${projectPath} has invalid URL for ${key}: ${data[key]}`);
    }
  }

  const projectId = relative(projectDirectory, join(root, projectPath)).replace(/\\/g, '/').replace(/\.md$/, '');
  if (!projectId) {
    failures.push(`${projectPath} must have a non-empty project id`);
  }
}

if (exists('src/content.config.ts')) {
  const contentConfig = read('src/content.config.ts');
  for (const token of [
    'defineCollection',
    "glob({ pattern: '**/*.md', base: './src/content/posts' })",
    "glob({ pattern: '**/*.md', base: './src/content/topics' })",
    "glob({ pattern: '**/*.md', base: './src/content/projects' })",
    'const projects = defineCollection',
    "status: z.enum(['维护中', '实验中', '已完成', '已归档'])",
    'repository: z.httpUrl().optional()',
    'website: z.httpUrl().optional()',
    'export const collections = { posts, topics, projects }',
  ]) {
    if (!contentConfig.includes(token)) {
      failures.push(`src/content.config.ts must include: ${token}`);
    }
  }

  if (contentConfig.includes('z.string().url()')) {
    failures.push('src/content.config.ts must use z.httpUrl() instead of deprecated z.string().url()');
  }
}

if (exists('src/pages/posts/index.astro')) {
  const postsIndex = read('src/pages/posts/index.astro');
  for (const token of ["getCollection('posts')", 'pubDate', '/posts/']) {
    if (!postsIndex.includes(token)) {
      failures.push(`src/pages/posts/index.astro must include: ${token}`);
    }
  }
}

if (exists('src/pages/topics/index.astro')) {
  const topicsIndex = read('src/pages/topics/index.astro');
  for (const token of ["getCollection('topics')", "getCollection('posts')", '/topics/']) {
    if (!topicsIndex.includes(token)) {
      failures.push(`src/pages/topics/index.astro must include: ${token}`);
    }
  }
}

if (exists('src/pages/projects/index.astro')) {
  const projectsIndex = read('src/pages/projects/index.astro');
  for (const token of ["getCollection('projects')", '/projects/${project.id}/', 'project.data.status', 'project.data.tags']) {
    if (!projectsIndex.includes(token)) {
      failures.push(`src/pages/projects/index.astro must include: ${token}`);
    }
  }
}

if (!exists('src/pages/projects/[slug].astro')) {
  failures.push('Missing project detail route: src/pages/projects/[slug].astro');
} else {
  const projectDetail = read('src/pages/projects/[slug].astro');
  for (const token of [
    'export async function getStaticPaths()',
    "getCollection('projects')",
    'render(project)',
    'backgroundKey={project.data.background}',
    'project.data.repository &&',
    'project.data.website &&',
    'target="_blank"',
    'rel="noreferrer"',
  ]) {
    if (!projectDetail.includes(token)) {
      failures.push(`src/pages/projects/[slug].astro must include: ${token}`);
    }
  }
}

if (!exists('src/components/PostsSubnav.astro')) {
  failures.push('Missing posts subnavigation component: src/components/PostsSubnav.astro');
} else {
  const postsSubnav = read('src/components/PostsSubnav.astro');
  for (const token of ['href="/posts/"', 'href="/archive/"', 'href="/tags/"', 'aria-current']) {
    if (!postsSubnav.includes(token)) {
      failures.push(`src/components/PostsSubnav.astro must include: ${token}`);
    }
  }
}

const postDiscoveryRoutes = [
  {
    path: 'src/pages/archive/index.astro',
    tokens: [
      "getCollection('posts')",
      'buildArchiveGroups',
      'buildTagIndex',
      'filter((post) => !post.data.draft)',
      '<PostsSubnav active="archive"',
      'backgroundKey="archive-index"',
      'href={`/posts/${post.id}/`}',
      'href={`/tags/${tag.slug}/`}',
      '还没有可归档的文章。',
    ],
  },
  {
    path: 'src/pages/tags/index.astro',
    tokens: [
      "getCollection('posts')",
      'buildTagIndex',
      'filter((post) => !post.data.draft)',
      '<PostsSubnav active="tags"',
      'backgroundKey="tags-index"',
      'href={`/tags/${tag.slug}/`}',
      '还没有可浏览的标签。',
    ],
  },
  {
    path: 'src/pages/tags/[slug].astro',
    tokens: [
      'export async function getStaticPaths()',
      "getCollection('posts')",
      'buildTagIndex',
      'filter((post) => !post.data.draft)',
      'params: { slug: tag.slug }',
      '<PostsSubnav active="tags"',
      'backgroundKey="tag-detail"',
      'href={`/posts/${post.id}/`}',
      '还没有可浏览的文章。',
    ],
  },
];

for (const { path, tokens } of postDiscoveryRoutes) {
  if (!exists(path)) {
    failures.push(`Missing discovery route: ${path}`);
    continue;
  }

  const source = read(path);
  for (const token of tokens) {
    if (!source.includes(token)) {
      failures.push(`${path} must include: ${token}`);
    }
  }
}

if (exists('src/pages/posts/index.astro')) {
  const postsIndex = read('src/pages/posts/index.astro');
  for (const token of ["import PostsSubnav from '../../components/PostsSubnav.astro'", '<PostsSubnav active="posts"']) {
    if (!postsIndex.includes(token)) {
      failures.push(`src/pages/posts/index.astro must include: ${token}`);
    }
  }
}

if (exists('src/pages/posts/[slug].astro')) {
  const postDetail = read('src/pages/posts/[slug].astro');
  for (const token of [
    'buildTagIndex',
    'findAdjacentPosts',
    'findRelatedPosts',
    'buildTagIndex(publishedPosts)',
    'findAdjacentPosts(publishedPosts, post.id)',
    'findRelatedPosts(publishedPosts, post)',
    'href={`/tags/${tag.slug}/`}',
    '更早一篇',
    '更新一篇',
    '相关推荐',
    '<PostsSubnav active="posts"',
    'relatedPosts.length > 0',
  ]) {
    if (!postDetail.includes(token)) {
      failures.push(`src/pages/posts/[slug].astro must include: ${token}`);
    }
  }

  for (const placeholder of ['暂无相关推荐', '没有相关推荐']) {
    if (postDetail.includes(placeholder)) {
      failures.push(`src/pages/posts/[slug].astro must not render a related-post placeholder: ${placeholder}`);
    }
  }
}

if (exists('src/data/backgrounds.ts')) {
  const backgrounds = read('src/data/backgrounds.ts');
  for (const token of [
    "'archive-index'",
    "'tags-index'",
    "'tag-detail'",
    '/images/backgrounds/archive-index.webp',
    '/images/backgrounds/archive-index-mobile.webp',
    '/images/backgrounds/tags-index.webp',
    '/images/backgrounds/tags-index-mobile.webp',
    '/images/backgrounds/tag-detail.webp',
    '/images/backgrounds/tag-detail-mobile.webp',
  ]) {
    if (!backgrounds.includes(token)) {
      failures.push(`src/data/backgrounds.ts must register: ${token}`);
    }
  }
}

if (exists('README.md')) {
  const readme = read('README.md');
  for (const token of ['文章和专题', '发布顺序', '创建新专题', '创建新文章']) {
    if (!readme.includes(token)) {
      failures.push(`README.md must document: ${token}`);
    }
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
