import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const about = readFileSync(new URL('../../src/pages/about.astro', import.meta.url), 'utf8');

test('about keeps work and personal interests in one panel with separate sections', () => {
  assert.equal((about.match(/class="sketch-card about-panel"/g) ?? []).length, 1);
  assert.equal((about.match(/class="about-panel__section"/g) ?? []).length, 2);
  assert.match(about, /<h2>工作方向<\/h2>/);
  assert.match(about, /<h2>个人兴趣与实践<\/h2>/);
  assert.ok(about.indexOf('工作方向') < about.indexOf('个人兴趣与实践'));
  assert.match(about, /分布式文件系统/);
  assert.match(about, /IO500/);
});

test('personal interests link to the Steam game, merged libfuse PR, and GitHub profile', () => {
  const interests = about.split('<h2>个人兴趣与实践</h2>')[1];
  assert.ok(interests, 'personal interests section is present');
  assert.match(interests, /https:\/\/store\.steampowered\.com\/app\/2640710\/_\//);
  assert.match(interests, /https:\/\/github\.com\/libfuse\/libfuse\/pull\/885/);
  assert.match(interests, /https:\/\/github\.com\/bigbrotherwei/);
  assert.match(interests, /这个地堡/);
  assert.match(interests, /FUSE_CAP_HANDLE_KILLPRIV/);
  assert.equal((interests.match(/target="_blank" rel="noreferrer"/g) ?? []).length, 3);
});
