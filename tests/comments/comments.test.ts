import assert from 'node:assert/strict';
import test from 'node:test';
import { giscusAttributes, readGiscusConfig } from '../../src/lib/comments.ts';

const completeEnv = {
  PUBLIC_GISCUS_REPO: 'bigbrotherwei/bigbrotherwei.github.io',
  PUBLIC_GISCUS_REPO_ID: 'R_kgDOExample',
  PUBLIC_GISCUS_CATEGORY: 'Comments',
  PUBLIC_GISCUS_CATEGORY_ID: 'DIC_kwDOExample',
};

test('complete public configuration maps discussions by pathname', () => {
  const config = readGiscusConfig(completeEnv);
  assert.ok(config);
  assert.deepEqual(giscusAttributes(config), {
    'data-repo': 'bigbrotherwei/bigbrotherwei.github.io',
    'data-repo-id': 'R_kgDOExample',
    'data-category': 'Comments',
    'data-category-id': 'DIC_kwDOExample',
    'data-mapping': 'pathname',
    'data-strict': '1',
    'data-lang': 'zh-CN',
  });
});

test('missing or blank public fields disable comments', () => {
  for (const field of Object.keys(completeEnv) as Array<keyof typeof completeEnv>) {
    assert.equal(readGiscusConfig({ ...completeEnv, [field]: undefined }), null, field);
    assert.equal(readGiscusConfig({ ...completeEnv, [field]: '   ' }), null, field);
  }
});

test('malformed repository names disable comments', () => {
  for (const repo of ['owner', '/repo', 'owner/', 'owner/repo/extra', 'owner /repo', 'owner/repo name']) {
    assert.equal(readGiscusConfig({ ...completeEnv, PUBLIC_GISCUS_REPO: repo }), null, repo);
  }
});

test('public values are trimmed before becoming script attributes', () => {
  const config = readGiscusConfig({
    ...completeEnv,
    PUBLIC_GISCUS_REPO: ' bigbrotherwei/bigbrotherwei.github.io ',
    PUBLIC_GISCUS_REPO_ID: ' R_kgDOExample ',
    PUBLIC_GISCUS_CATEGORY: ' Comments ',
    PUBLIC_GISCUS_CATEGORY_ID: ' DIC_kwDOExample ',
  });
  assert.ok(config);
  assert.equal(giscusAttributes(config)['data-repo'], completeEnv.PUBLIC_GISCUS_REPO);
  assert.equal(giscusAttributes(config)['data-category-id'], completeEnv.PUBLIC_GISCUS_CATEGORY_ID);
});
