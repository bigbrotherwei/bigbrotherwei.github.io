import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readPage = (slug: string) => readFileSync(new URL(`../../src/pages/tools/${slug}.astro`, import.meta.url), 'utf8');

test('uses only the shared live status instead of per-result output elements', () => {
  for (const slug of ['text-counter', 'timestamp', 'uuid']) {
    const source = readPage(slug);
    assert.doesNotMatch(source, /<output\b|createElement\('output'\)|HTMLOutputElement/);
  }
});

test('announces complete Chinese summaries through the shared tool status', () => {
  const textCounter = readPage('text-counter');
  for (const label of ['字符', '去空白字符', '汉字', '英文词', '行数', 'UTF-8 字节']) {
    assert.match(textCounter, new RegExp(label));
  }

  const timestamp = readPage('timestamp');
  for (const label of ['本地时间', 'UTC ISO 时间', '秒时间戳', '毫秒时间戳']) {
    assert.match(timestamp, new RegExp(label));
  }

  assert.match(readPage('uuid'), /已生成 \$\{uuids\.length\} 个 UUID/);
});
