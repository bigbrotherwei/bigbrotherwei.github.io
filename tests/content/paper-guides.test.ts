import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('paper topic publishes two original guides in the requested order', () => {
  const topic = read('src/content/topics/papers.md');
  const peakfs = read('src/content/posts/peakfs-paper-guide.md');
  const foundationdb = read('src/content/posts/foundationdb-paper-guide.md');

  assert.match(topic, /title: "论文"/u);
  assert.match(peakfs, /topic: "papers"[\s\S]*order: 1/u);
  assert.match(foundationdb, /topic: "papers"[\s\S]*order: 2/u);
  assert.match(peakfs, /https:\/\/doi\.org\/10\.1109\/TPDS\.2024\.3485754/u);
  assert.match(foundationdb, /https:\/\/doi\.org\/10\.1145\/3448016\.3457559/u);

  for (const [source, slug] of [
    [peakfs, 'peakfs-paper-guide'],
    [foundationdb, 'foundationdb-paper-guide'],
  ] as const) {
    assert.match(source, new RegExp(`/images/posts/${slug}/architecture\\.svg`));
    assert.match(source, new RegExp(`/images/posts/${slug}/architecture-mobile\\.svg`));
    assert.doesNotMatch(source, /<iframe\b|\.pdf\)\s*!?\[/iu);
    assert.ok(existsSync(join(root, `public/images/posts/${slug}/architecture.svg`)));
    assert.ok(existsSync(join(root, `public/images/posts/${slug}/architecture-mobile.svg`)));
  }
});
