import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const requiredPaths = [
  'src/content.config.ts',
  'src/content/posts',
  'src/content/topics',
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
const topicDirectory = join(root, 'src/content/topics');

if (topicFiles.length < 2) {
  failures.push('Expected at least 2 topic markdown files');
}

if (postFiles.length < 3) {
  failures.push('Expected at least 3 post markdown files');
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

if (exists('src/content.config.ts')) {
  const contentConfig = read('src/content.config.ts');
  for (const token of ['defineCollection', "glob({ pattern: '**/*.md', base: './src/content/posts' })", "glob({ pattern: '**/*.md', base: './src/content/topics' })"]) {
    if (!contentConfig.includes(token)) {
      failures.push(`src/content.config.ts must include: ${token}`);
    }
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
