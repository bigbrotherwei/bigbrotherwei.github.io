import assert from 'node:assert/strict';
import test from 'node:test';
import { validateToolPageContract } from '../../scripts/lib/tool-page-contracts.mjs';

const contract = {
  slug: 'json',
  backgroundKey: 'tool-json',
  logicModule: 'json.ts',
  logicCalls: ['formatJson'],
};

test('accepts a real tool layout, paired label, event control, and invoked logic', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
  <button type="button" data-json-action="format">格式化</button>
</ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {});
  formatJson(input.value);
</script>`;

  assert.deepEqual(validateToolPageContract(source, contract), []);
});

test('rejects comments pretending to be a page contract and global unsafe APIs', () => {
  const source = `<!-- <ToolLayout backgroundKey="tool-json"><label for="json-input">JSON</label> -->
<script>
  // import { formatJson } from '../../lib/tools/json.ts';
  window.fetch('/unexpected');
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must render ToolLayout')));
  assert.ok(failures.some((failure) => failure.includes('must call formatJson')));
  assert.ok(failures.some((failure) => failure.includes('must not use window.fetch')));
});

test('requires the tested swap helper when a page declares bidirectional conversion', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
</ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => formatJson(input.value));
</script>`;

  const failures = validateToolPageContract(source, { ...contract, browserCalls: ['swapTransformation'] });
  assert.ok(failures.some((failure) => failure.includes('must call swapTransformation')));
});

test('rejects a function name that appears only in a script string', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
</ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {});
  const example = 'formatJson(';
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must call formatJson')));
});
