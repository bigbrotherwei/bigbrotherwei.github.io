import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const backdropPath = join(root, 'src/components/NightSketchBackdrop.astro');
const layoutPath = join(root, 'src/layouts/BaseLayout.astro');
const stylesPath = join(root, 'src/styles/global.css');
const indexPath = join(root, 'src/pages/index.astro');
const routePaths = [
  'src/pages/index.astro',
  'src/pages/posts/index.astro',
  'src/pages/topics/index.astro',
  'src/pages/tools/index.astro',
  'src/pages/projects/index.astro',
  'src/pages/about.astro',
];

const failures = [];
const stripComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

if (!existsSync(backdropPath)) {
  failures.push('Missing shared night sketch backdrop component: src/components/NightSketchBackdrop.astro');
}

const layoutSource = readFileSync(layoutPath, 'utf8');
const indexSource = readFileSync(indexPath, 'utf8');
const layoutWithoutComments = stripComments(layoutSource);
const layoutBodyMatch = layoutWithoutComments.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);

if (!layoutSource.includes("import NightSketchBackdrop from '../components/NightSketchBackdrop.astro'")) {
  failures.push('BaseLayout must import NightSketchBackdrop');
}

if (!layoutBodyMatch || !/<NightSketchBackdrop\s*\/>/.test(layoutBodyMatch[1])) {
  failures.push('BaseLayout must render <NightSketchBackdrop /> inside <body>');
}

const stylesSource = readFileSync(stylesPath, 'utf8');
const requiredStyleTokens = [
  '--color-night',
  '--color-night-glow',
  '.night-sketch-backdrop',
  '.night-sketch-backdrop__stars',
  '.night-sketch-backdrop__skyline',
  'body.home .night-sketch-backdrop',
];

for (const token of requiredStyleTokens) {
  if (!stylesSource.includes(token)) {
    failures.push(`Global styles must include night backdrop token: ${token}`);
  }
}

for (const routePath of routePaths) {
  const source = stripComments(readFileSync(join(root, routePath), 'utf8'));
  if (!/<BaseLayout(?:\s|>)[\s\S]*<\/BaseLayout>/.test(source)) {
    failures.push(`${routePath} must use BaseLayout so the night backdrop appears on the page`);
  }
}

if (!/h1\s*\{[^}]*color:\s*#fffaf1;/s.test(indexSource)) {
  failures.push('Homepage hero h1 must explicitly use a light color on the night illustration');
}

if (!/\.section-heading h2\s*\{[^}]*color:\s*#fffaf1;/s.test(indexSource)) {
  failures.push('Homepage section heading must explicitly use a light color on the night backdrop');
}

if (!/\.section-heading p:last-child\s*\{[^}]*color:\s*rgba\(255,\s*250,\s*241,\s*0\.76\);/s.test(indexSource)) {
  failures.push('Homepage section description must explicitly use a readable light color on the night backdrop');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
