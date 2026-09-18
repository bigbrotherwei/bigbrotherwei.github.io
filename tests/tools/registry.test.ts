import assert from 'node:assert/strict';
import test from 'node:test';
import { toolCategories, tools } from '../../src/data/tools.ts';

test('publishes six uniquely addressable tools', () => {
  assert.equal(tools.length, 6);
  assert.equal(new Set(tools.map((tool) => tool.slug)).size, tools.length);

  for (const tool of tools) {
    assert.equal(tool.href, `/tools/${tool.slug}/`);
  }
});

test('assigns every tool to a registered category and unique future background key', () => {
  const categoryValues = new Set(toolCategories.filter((category) => category.value !== 'all').map((category) => category.value));

  for (const tool of tools) {
    assert.ok(categoryValues.has(tool.category));
  }

  assert.equal(new Set(tools.map((tool) => tool.backgroundKey)).size, tools.length);
});
