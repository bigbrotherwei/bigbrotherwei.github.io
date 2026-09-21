import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeUrlComponent, encodeUrlComponent } from '../../src/lib/tools/url.ts';

test('encodes a URL component without hiding errors', () => {
  assert.deepEqual(encodeUrlComponent('搜索?q=中文'), {
    ok: true,
    value: '%E6%90%9C%E7%B4%A2%3Fq%3D%E4%B8%AD%E6%96%87',
  });
});

test('decodes a URL component', () => {
  assert.deepEqual(decodeUrlComponent('%E6%90%9C%E7%B4%A2%3Fq%3D%E4%B8%AD%E6%96%87'), {
    ok: true,
    value: '搜索?q=中文',
  });
});

test('returns an error for malformed URL encoding', () => {
  const result = decodeUrlComponent('%E0%A4%A');

  assert.equal(result.ok, false);
});

test('returns an error for an unpaired surrogate', () => {
  const result = encodeUrlComponent('\ud800');

  assert.equal(result.ok, false);
});
