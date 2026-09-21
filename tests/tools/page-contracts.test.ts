import assert from 'node:assert/strict';
import test from 'node:test';
import { validateToolPageContract } from '../../scripts/lib/tool-page-contracts.mjs';

const contract = {
  slug: 'json',
  backgroundKey: 'tool-json',
  logicModule: 'json.ts',
  logicCalls: ['formatJson'],
  toolResultCalls: ['formatJson'],
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
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
    input.value = result.value;
  });
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
  assert.ok(failures.some((failure) => failure.includes('must not use fetch')));
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

test('rejects a module path that appears only in a string', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
</ToolLayout>
<script>
  const modulePath = '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must statically import json.ts')));
});

test('rejects a conversion call whose result is discarded', () => {
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

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must consume formatJson ToolResult')));
});

test('rejects a bare swap helper call that does not update fields and mode', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
</ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  import { swapTransformation } from '../../lib/tools/browser.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
    swapTransformation({ input: '', output: '', mode: 'encode' });
  });
</script>`;

  const failures = validateToolPageContract(source, {
    ...contract,
    browserCalls: ['swapTransformation'],
    browserModule: 'browser.ts',
    toolResultCalls: ['formatJson'],
    swapCall: 'swapTransformation',
  });
  assert.ok(failures.some((failure) => failure.includes('must assign and consume swapTransformation')));
});

test('rejects a UUID page that omits consumed count normalization', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="uuid-count">生成数量</label>
  <input id="uuid-count" />
</ToolLayout>
<script>
  import { generateUuids } from '../../lib/tools/uuid.ts';
  const input = document.querySelector('#uuid-count');
  input.addEventListener('input', () => {
    const result = generateUuids(1);
    if (!result.ok) return;
  });
</script>`;

  const failures = validateToolPageContract(source, {
    ...contract,
    logicModule: 'uuid.ts',
    logicCalls: ['generateUuids', 'normalizeUuidCount'],
    toolResultCalls: ['generateUuids'],
    sinkCalls: ['normalizeUuidCount'],
  });
  assert.ok(failures.some((failure) => failure.includes('must call normalizeUuidCount')));
});

test('rejects an aria-label that overrides a visible control label', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input" aria-label="覆盖名称"></textarea>
</ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must not override its visible label')));
});

test('rejects computed and destructured aliases for forbidden browser APIs', () => {
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
  const request = window['fetch'];
  const { localStorage: storage } = globalThis;
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must not use fetch')));
  assert.ok(failures.some((failure) => failure.includes('must not use localStorage')));
});

test('rejects a local function that shadows a missing named import', () => {
  const source = `---
import ToolLayout from '../../components/tools/ToolLayout.astro';
---
<ToolLayout backgroundKey="tool-json">
  <label for="json-input">JSON 内容</label>
  <textarea id="json-input"></textarea>
</ToolLayout>
<script>
  import { minifyJson } from '../../lib/tools/json.ts';
  const formatJson = () => ({ ok: true, value: '{}' });
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
    input.value = result.value;
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must import formatJson as a named binding')));
});

test('rejects const and function declarations that shadow a real named import at the call site', () => {
  const constShadow = `
<ToolLayout backgroundKey="tool-json"><label for="json-input">JSON 内容</label><textarea id="json-input"></textarea></ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    const formatJson = () => ({ ok: true, value: '{}' });
    const result = formatJson(input.value);
    if (!result.ok) return;
    input.value = result.value;
  });
</script>`;
  const functionShadow = `
<ToolLayout backgroundKey="tool-json"><label for="json-input">JSON 内容</label><textarea id="json-input"></textarea></ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => {
    function formatJson() { return { ok: true, value: '{}' }; }
    const result = formatJson(input.value);
    if (!result.ok) return;
    input.value = result.value;
  });
</script>`;

  assert.ok(validateToolPageContract(constShadow, contract).some((failure) => failure.includes('must call formatJson')));
  assert.ok(validateToolPageContract(functionShadow, contract).some((failure) => failure.includes('must call formatJson')));
});

test('resolves destructuring, var hoisting, and loop scopes for named imports', () => {
  const page = (handler: string) => `
<ToolLayout backgroundKey="tool-json"><label for="json-input">JSON 内容</label><textarea id="json-input"></textarea></ToolLayout>
<script>
  import { formatJson } from '../../lib/tools/json.ts';
  const input = document.querySelector('#json-input');
  input.addEventListener('input', () => ${handler});
</script>`;
  const consumed = (expression: string) => `{
    const result = ${expression};
    if (!result.ok) return;
    input.value = result.value;
  }`;

  const shadowingCases = [
    page(`{
      var formatJson = () => ({ ok: true, value: '{}' });
      ${consumed('formatJson(input.value)')}
    }`),
    page(`{
      const { formatJson } = { formatJson: () => ({ ok: true, value: '{}' }) };
      ${consumed('formatJson(input.value)')}
    }`),
    page(`{
      const [formatJson] = [() => ({ ok: true, value: '{}' })];
      ${consumed('formatJson(input.value)')}
    }`),
    page(`({ formatJson }) => ${consumed('formatJson(input.value)')}`),
    page(`{
      try { throw { formatJson: () => ({ ok: true, value: '{}' }) }; }
      catch ({ formatJson }) { ${consumed('formatJson(input.value)')} }
    }`),
  ];
  for (const source of shadowingCases) {
    assert.ok(
      validateToolPageContract(source, contract).some((failure) => failure.includes('must call formatJson')),
    );
  }

  const legalAfterLoop = page(`{
    for (const formatJson of []) { ${consumed('formatJson(input.value)')} }
    for (let formatJson of []) { ${consumed('formatJson(input.value)')} }
    for (const formatJson in {}) { ${consumed('formatJson(input.value)')} }
    for (let formatJson of []) { ${consumed('formatJson(input.value)')} }
    ${consumed('formatJson(input.value)')}
  }`);
  assert.deepEqual(validateToolPageContract(legalAfterLoop, contract), []);

  const varLoop = page(`{
    for (var formatJson of []) { ${consumed('formatJson(input.value)')} }
    ${consumed('formatJson(input.value)')}
  }`);
  assert.ok(validateToolPageContract(varLoop, contract).some((failure) => failure.includes('must call formatJson')));
});

test('rejects a ToolResult that is only stored on an unrelated object', () => {
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
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    const metadata = { result };
    console.log(metadata);
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must consume formatJson ToolResult')));
});

test('rejects a ToolResult that appears only in an unreachable branch', () => {
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
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (false) {
      if (result.ok) input.value = result.value;
    }
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must consume formatJson ToolResult')));
});

test('rejects a result that is shadowed by a consumed nested-block variable', () => {
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
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (true) {
      const result = { ok: true, value: '{}' };
      if (result.ok) input.value = result.value;
    }
  });
</script>`;

  const failures = validateToolPageContract(source, contract);
  assert.ok(failures.some((failure) => failure.includes('must consume formatJson ToolResult')));
});

test('allows an unrelated object property named fetch', () => {
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
  const metadata = { fetch: 'not a browser API' };
  input.addEventListener('input', () => {
    const result = formatJson(input.value);
    if (!result.ok) return;
    input.value = result.value;
  });
  console.log(metadata);
</script>`;

  assert.deepEqual(validateToolPageContract(source, contract), []);
});
