import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const backdropPath = join(root, 'src/components/HandPaintedFarmBackdrop.astro');
const oldBackdropPath = join(root, 'src/components/PixelFarmBackdrop.astro');
const imagePath = join(root, 'public/images/hand-painted-farm-dusk.webp');
const layoutPath = join(root, 'src/layouts/BaseLayout.astro');
const stylesPath = join(root, 'src/styles/global.css');
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
  failures.push('Missing shared hand-painted farm backdrop component');
}

if (existsSync(oldBackdropPath)) {
  failures.push('Remove the old CSS pixel farm backdrop component');
}

if (!existsSync(imagePath)) {
  failures.push('Missing hand-painted farm background image');
}

const layoutSource = readFileSync(layoutPath, 'utf8');
const layoutWithoutComments = stripComments(layoutSource);
const layoutBodyMatch = layoutWithoutComments.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);

if (!layoutSource.includes("import HandPaintedFarmBackdrop from '../components/HandPaintedFarmBackdrop.astro'")) {
  failures.push('BaseLayout must import HandPaintedFarmBackdrop');
}

if (!layoutBodyMatch || !/<HandPaintedFarmBackdrop\s*\/>/.test(layoutBodyMatch[1])) {
  failures.push('BaseLayout must render <HandPaintedFarmBackdrop /> inside <body>');
}

const stylesSource = readFileSync(stylesPath, 'utf8');
for (const token of [
  '.hand-painted-farm-backdrop',
  '/images/hand-painted-farm-dusk.webp',
  'background-size: cover',
  'body.home .hand-painted-farm-backdrop',
]) {
  if (!stylesSource.includes(token)) {
    failures.push(`Global styles must include hand-painted backdrop token: ${token}`);
  }
}

const indexSource = readFileSync(join(root, 'src/pages/index.astro'), 'utf8');
for (const forbidden of ['pixel-farm-hero', 'pixel-farm-hero__field', 'pixel-farm-hero__cabin']) {
  if (indexSource.includes(forbidden)) {
    failures.push(`Homepage must remove the old CSS pixel scene: ${forbidden}`);
  }
}

for (const routePath of routePaths) {
  const source = stripComments(readFileSync(join(root, routePath), 'utf8'));
  if (!/<BaseLayout(?:\s|>)[\s\S]*<\/BaseLayout>/.test(source)) {
    failures.push(`${routePath} must use BaseLayout so the hand-painted background appears on the page`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
