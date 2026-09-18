import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

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
    json: 'json.ts',
    base64: 'base64.ts',
    url: 'url.ts',
    timestamp: 'timestamp.ts',
    uuid: 'uuid.ts',
    'text-counter': 'text-counter.ts',
  };

  for (const tool of tools) {
    const routePath = `src/pages/${tool.href.replace(/^\/+|\/+$/g, '')}.astro`;
    if (!existsSync(join(root, routePath))) {
      failures.push(`Missing tool route: ${routePath}`);
      continue;
    }

    const route = read(routePath);
    const logicModule = pageContracts[tool.slug];
    const requiredTokens = [
      "import ToolLayout from '../../components/tools/ToolLayout.astro';",
      `../../lib/tools/${logicModule}`,
      `backgroundKey=\"${tool.backgroundKey}\"`,
      '<label',
      'aria-label=',
    ];

    for (const token of requiredTokens) {
      if (!route.includes(token)) {
        failures.push(`${routePath} must include: ${token}`);
      }
    }

    if (!/<(?:input|textarea)\b/.test(route)) {
      failures.push(`${routePath} must render a labeled input control`);
    }

    for (const forbidden of ['innerHTML', 'fetch(', 'localStorage', 'sessionStorage']) {
      if (route.includes(forbidden)) {
        failures.push(`${routePath} must not use ${forbidden}`);
      }
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
