import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const publicVariables = [
  'PUBLIC_GISCUS_REPO',
  'PUBLIC_GISCUS_REPO_ID',
  'PUBLIC_GISCUS_CATEGORY',
  'PUBLIC_GISCUS_CATEGORY_ID',
] as const;

test('Pages build receives all four public Giscus variables', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  for (const variable of publicVariables) {
    assert.match(workflow, new RegExp(`^\\s+${variable}: \\x24\\{\\{ vars\\.${variable} \\}\\}$`, 'm'));
  }
});

test('unconfigured publishing keeps articles readable, comments unavailable, and Giscus unloaded', () => {
  const output = mkdtempSync(path.join(tmpdir(), 'comments-publishing-'));
  try {
    const env: NodeJS.ProcessEnv = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1' };
    for (const variable of publicVariables) delete env[variable];
    const result = spawnSync(path.join(root, 'node_modules/.bin/astro'), ['build', '--outDir', output], {
      cwd: root,
      env,
      encoding: 'utf8',
      maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const privacy = readFileSync(path.join(output, 'privacy/index.html'), 'utf8');
    assert.match(privacy, /Giscus/);
    assert.match(privacy, /GitHub Discussions/);

    const posts = readdirSync(path.join(output, 'posts'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    assert.ok(posts.length > 0, 'expected at least one published article');
    for (const post of posts) {
      const article = readFileSync(path.join(output, 'posts', post.name, 'index.html'), 'utf8');
      assert.match(article, /href="\/privacy\/"/, post.name);
      assert.match(article, /评论未开放/, post.name);
      assert.ok(!/<script[^>]+src=["']https:\/\/giscus\.app\/client\.js/.test(article), `${post.name}: eager Giscus script`);
      assert.ok(!/<iframe[^>]+src=["']https:\/\/giscus\.app/.test(article), `${post.name}: eager Giscus iframe`);
      assert.ok(!/<button[^>]+data-comment-load/.test(article), `${post.name}: unavailable comments must hide the load button`);
    }
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
