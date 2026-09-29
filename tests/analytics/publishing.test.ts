import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { mountAnalytics } from '../../src/scripts/analytics.ts';
import { mountStatsDisplay } from '../../src/scripts/stats-display.ts';

const root = process.cwd();
const publicUrl = 'https://analytics.example.test/';
const secretCanary = 'private-hmac-canary-never-publish';

function filesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

function build(publicApiUrl?: string): { output: string; contents: string } {
  const output = mkdtempSync(path.join(tmpdir(), 'analytics-publishing-'));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    VISITOR_HMAC_KEY: secretCanary,
  };
  delete env.PUBLIC_ANALYTICS_API_URL;
  if (publicApiUrl) env.PUBLIC_ANALYTICS_API_URL = publicApiUrl;
  const result = spawnSync(path.join(root, 'node_modules/.bin/astro'), ['build', '--outDir', output], {
    cwd: root, env, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024,
  });
  if (result.status !== 0) {
    rmSync(output, { recursive: true, force: true });
    assert.fail(`${result.stdout}\n${result.stderr}`);
  }
  return {
    output,
    contents: filesUnder(output).map((file) => readFileSync(file).toString('utf8')).join('\n'),
  };
}

test('Pages passes the public API URL from a repository variable to the Astro build', () => {
  const workflow = readFileSync(path.join(root, '.github/workflows/deploy.yml'), 'utf8');
  const actionEnv = workflow.match(/^ {8}uses: withastro\/action@v5\n {8}env:\n((?: {10}[^\n]+\n)+)/m)?.[1];
  assert.ok(actionEnv, 'withastro/action needs build environment variables');
  assert.match(actionEnv, /^ {10}PUBLIC_ANALYTICS_API_URL: \$\{\{ vars\.PUBLIC_ANALYTICS_API_URL \}\}$/m);
  assert.doesNotMatch(workflow, /VISITOR_HMAC_KEY|CLOUDFLARE_API_TOKEN|wrangler/);
});

test('configured build exposes only the public API URL, never the Worker HMAC secret', () => {
  const built = build(publicUrl);
  try {
    assert.match(built.contents, /https:\/\/analytics\.example\.test\//);
    assert.doesNotMatch(built.contents, /private-hmac-canary-never-publish/);
  } finally {
    rmSync(built.output, { recursive: true, force: true });
  }
});

test('unconfigured build keeps static content and makes no analytics requests', async () => {
  const built = build();
  try {
    const home = readFileSync(path.join(built.output, 'index.html'), 'utf8');
    const posts = readdirSync(path.join(built.output, 'posts'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory());
    assert.match(home, /data-site-stats/);
    assert.ok(posts.length > 0);
    assert.doesNotMatch(built.contents, /https:\/\/analytics\.example\.test\//);
    assert.doesNotMatch(built.contents, /private-hmac-canary-never-publish/);

    let requests = 0;
    const window = { fetch: () => { requests++; throw new Error('unexpected request'); } } as unknown as Window;
    mountAnalytics({} as Document, window, '');
    const value = { textContent: '加载中', dataset: { statKey: 'pv' } };
    const root = {
      dataset: { statsPath: '/', state: 'loading' },
      querySelectorAll: () => [value],
    } as unknown as HTMLElement;
    await mountStatsDisplay(root, window, '');
    assert.equal(requests, 0);
    assert.equal(value.textContent, '暂不可用');
  } finally {
    rmSync(built.output, { recursive: true, force: true });
  }
});

test('setup guide covers the manual Worker lifecycle and independent Pages rollback', () => {
  const guide = readFileSync(path.join(root, 'docs/analytics-setup.zh.md'), 'utf8');
  const steps = [
    /wrangler d1 create/, /database_id/, /wrangler d1 migrations apply[^\n]*--remote/,
    /wrangler secret put VISITOR_HMAC_KEY/, /wrangler deploy/, /PUBLIC_ANALYTICS_API_URL/,
  ];
  let previous = -1;
  for (const step of steps) {
    const offset = guide.slice(previous + 1).search(step);
    assert.ok(offset >= 0, `${step} must appear in deployment order`);
    previous += offset + 1;
  }
  assert.match(guide, /ALLOWED_ORIGINS/);
  assert.match(guide, /cron/i);
  assert.match(guide, /回退/);
});
