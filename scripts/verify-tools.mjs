import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateToolPageContract } from './lib/tool-page-contracts.mjs';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(join(root, path), 'utf8');

const toolsIndexPath = 'src/pages/tools/index.astro';
if (!existsSync(join(root, toolsIndexPath))) {
  failures.push(`Missing tool directory: ${toolsIndexPath}`);
} else {
  const directory = read(toolsIndexPath);
  for (const token of ["import { tools, toolCategories } from '../../data/tools';", 'data-tool-card', 'data-search', 'data-category-filter', 'data-empty-state', 'data-result-count', 'aria-live']) {
    if (!directory.includes(token)) {
      failures.push(`Tool directory must include: ${token}`);
    }
  }
}

const registryPath = 'src/data/tools.ts';
if (!existsSync(join(root, registryPath))) {
  failures.push(`Missing tool registry: ${registryPath}`);
} else {
  const { tools } = await import(pathToFileURL(join(root, registryPath)).href);
  const pageContracts = {
    json: {
      logicModule: 'json.ts',
      logicCalls: ['formatJson', 'minifyJson', 'validateJson'],
      valueCalls: ['formatJson', 'minifyJson', 'validateJson'],
    },
    base64: {
      logicModule: 'base64.ts',
      logicCalls: ['encodeBase64', 'decodeBase64'],
      valueCalls: ['encodeBase64', 'decodeBase64', 'swapTransformation'],
      browserCalls: ['swapTransformation'],
      browserModule: 'browser.ts',
      swapCall: 'swapTransformation',
    },
    url: {
      logicModule: 'url.ts',
      logicCalls: ['encodeUrlComponent', 'decodeUrlComponent'],
      valueCalls: ['encodeUrlComponent', 'decodeUrlComponent', 'swapTransformation'],
      browserCalls: ['swapTransformation'],
      browserModule: 'browser.ts',
      swapCall: 'swapTransformation',
    },
    timestamp: {
      logicModule: 'timestamp.ts',
      logicCalls: ['convertTimestamp'],
      valueCalls: ['convertTimestamp'],
    },
    uuid: {
      logicModule: 'uuid.ts',
      logicCalls: ['generateUuids', 'normalizeUuidCount'],
      valueCalls: ['generateUuids', 'normalizeUuidCount'],
    },
    'text-counter': {
      logicModule: 'text-counter.ts',
      logicCalls: ['countText', 'shouldShowTextPerformanceNotice'],
      valueCalls: ['countText'],
    },
  };

  for (const tool of tools) {
    const routePath = `src/pages/${tool.href.replace(/^\/+|\/+$/g, '')}.astro`;
    if (!existsSync(join(root, routePath))) {
      failures.push(`Missing tool route: ${routePath}`);
      continue;
    }

    const pageContract = pageContracts[tool.slug];
    if (!pageContract) {
      failures.push(`${routePath} has no page contract for tool slug: ${tool.slug}`);
      continue;
    }

    for (const failure of validateToolPageContract(read(routePath), {
      ...pageContract,
      slug: tool.slug,
      backgroundKey: tool.backgroundKey,
    })) {
      failures.push(`${routePath} ${failure}`);
    }
  }

  if (new Set(tools.map((tool) => tool.backgroundKey)).size !== tools.length) {
    failures.push('Tool registry background keys must be unique');
  }
}

const layoutPath = 'src/components/tools/ToolLayout.astro';
if (!existsSync(join(root, layoutPath))) {
  failures.push(`Missing shared tool layout: ${layoutPath}`);
} else {
  const layout = read(layoutPath);
  if (!layout.includes('aria-live="polite"')) {
    failures.push('Shared tool layout must expose a polite live status');
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
