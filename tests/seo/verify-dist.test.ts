import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const siteOrigin = 'https://bigbrotherwei.github.io';
const verifierPath = fileURLToPath(new URL('../../scripts/verify-dist.mjs', import.meta.url));

const write = (root: string, path: string, contents: string): void => {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

const metadata = (route: string): string => `
  <meta name="description" content="Description">
  <link rel="canonical" href="${siteOrigin}${route}">
  <meta property="og:title" content="Title">
  <meta property="og:description" content="Description">
  <meta property="og:url" content="${siteOrigin}${route}">
  <meta property="og:image" content="${siteOrigin}/image.webp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Title">
  <meta name="twitter:description" content="Description">
  <meta name="twitter:image" content="${siteOrigin}/image.webp">
`;

const html = (
  route: string,
  schemas: readonly string[],
  pagefindType?: '文章' | '专题' | '工具' | '项目',
): string => `<!doctype html>
<html><head>${metadata(route)}${schemas.map((type) => (
  `<script type="application/ld+json">{"@type":"${type}"}</script>`
)).join('')}</head><body${pagefindType ? ' data-pagefind-body' : ''}>
${pagefindType ? `<h1 data-pagefind-meta="type:${pagefindType}">Title</h1>` : ''}
</body></html>`;

const createValidFixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'dist-verifier-'));

  write(root, 'package.json', JSON.stringify({ scripts: { build: 'npm run verify:dist' } }));
  write(root, 'dist/index.html', html('/', ['WebSite']));
  write(root, 'dist/posts/hello/index.html', html('/posts/hello/', ['BlogPosting', 'BreadcrumbList'], '文章'));
  write(root, 'dist/topics/hello/index.html', html('/topics/hello/', [], '专题'));
  write(root, 'dist/tools/hello/index.html', html('/tools/hello/', [], '工具'));
  write(root, 'dist/projects/hello/index.html', html('/projects/hello/', [], '项目'));
  write(root, 'dist/rss.xml', `<rss><channel><item><link>${siteOrigin}/posts/hello/</link></item></channel></rss>`);
  write(root, 'dist/sitemap-index.xml', '<sitemapindex></sitemapindex>');
  write(root, 'dist/sitemap-0.xml', '<urlset></urlset>');
  write(root, 'dist/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap-index.xml\n`);
  write(root, 'dist/pagefind/pagefind.js', 'export const search = () => {};\n');
  write(root, 'dist/pagefind/pagefind-entry.json', '{}\n');
  write(root, 'dist/pagefind/index/en.pf_index', 'index\n');

  return root;
};

const runVerifier = (mutate?: (root: string) => void) => {
  const root = createValidFixture();

  try {
    mutate?.(root);
    return spawnSync(process.execPath, [verifierPath], {
      cwd: root,
      encoding: 'utf8',
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const replaceInHome = (root: string, from: string, to: string): void => {
  const path = join(root, 'dist/index.html');
  const source = readFileSync(path, 'utf8');
  assert.notEqual(source, source.replace(from, to), `fixture token must exist: ${from}`);
  writeFileSync(path, source.replace(from, to));
};

test('accepts complete canonical and social URL metadata', () => {
  const result = runVerifier();

  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test('rejects missing URL attributes on canonical and social metadata', async (t) => {
  const cases = [
    [
      'canonical link',
      `<link rel="canonical" href="${siteOrigin}/">`,
      '<link rel="canonical">',
      /canonical link must provide href/u,
    ],
    [
      'og:url meta',
      `<meta property="og:url" content="${siteOrigin}/">`,
      '<meta property="og:url">',
      /og:url meta must provide content/u,
    ],
    [
      'og:image meta',
      `<meta property="og:image" content="${siteOrigin}/image.webp">`,
      '<meta property="og:image">',
      /og:image meta must provide content/u,
    ],
    [
      'twitter:image meta',
      `<meta name="twitter:image" content="${siteOrigin}/image.webp">`,
      '<meta name="twitter:image">',
      /twitter:image meta must provide content/u,
    ],
  ] as const;

  for (const [label, from, to, message] of cases) {
    await t.test(label, () => {
      const result = runVerifier((root) => replaceInHome(root, from, to));

      assert.equal(result.status, 1);
      assert.match(`${result.stdout}${result.stderr}`, message);
    });
  }
});

test('rejects a canonical URL whose path does not match the generated route', () => {
  const result = runVerifier((root) => {
    replaceInHome(root, `${siteOrigin}/\"`, `${siteOrigin}/wrong/\"`);
  });

  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /canonical must match generated route/u);
});

test('rejects canonical query strings and hashes', () => {
  const result = runVerifier((root) => {
    replaceInHome(root, `${siteOrigin}/\"`, `${siteOrigin}/?from=test#section\"`);
  });

  assert.equal(result.status, 1);
  assert.match(`${result.stdout}${result.stderr}`, /canonical must not contain a query or hash/u);
});

test('rejects empty canonical query and hash delimiters', async (t) => {
  for (const delimiter of ['?', '#']) {
    await t.test(delimiter, () => {
      const result = runVerifier((root) => {
        replaceInHome(root, `${siteOrigin}/\"`, `${siteOrigin}/${delimiter}\"`);
      });

      assert.equal(result.status, 1);
      assert.match(`${result.stdout}${result.stderr}`, /canonical must not contain a query or hash/u);
    });
  }
});
