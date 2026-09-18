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

  for (const tool of tools) {
    const routePath = `src/pages/${tool.href.replace(/^\/+|\/+$/g, '')}.astro`;
    if (!existsSync(join(root, routePath))) {
      failures.push(`Missing tool route: ${routePath}`);
    }
  }

  if (new Set(tools.map((tool) => tool.backgroundKey)).size !== tools.length) {
    failures.push('Tool registry background keys must be unique');
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
