import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const backdropPath = join(root, 'src/components/PixelFarmBackdrop.astro');
const removedBackdropPath = join(root, 'src/components/NightSketchBackdrop.astro');
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
const sourceScanRoots = [
  'src/pages',
  'src/components',
  'src/layouts',
  'src/styles',
];

const failures = [];
const stripComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const sourceFiles = [];

const collectSourceFiles = (relativePath) => {
  const absolutePath = join(root, relativePath);
  if (!existsSync(absolutePath)) {
    return;
  }

  const stat = statSync(absolutePath);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(absolutePath)) {
      collectSourceFiles(join(relativePath, entry));
    }
    return;
  }

  if (stat.isFile() && /\.(astro|css|ts|js|mjs)$/.test(relativePath)) {
    sourceFiles.push(relativePath);
  }
};

for (const sourceRoot of sourceScanRoots) {
  collectSourceFiles(sourceRoot);
}

if (!existsSync(backdropPath)) {
  failures.push('Missing shared pixel farm backdrop component: src/components/PixelFarmBackdrop.astro');
}

if (existsSync(removedBackdropPath)) {
  failures.push('Remove old city/night backdrop component: src/components/NightSketchBackdrop.astro');
}

const layoutSource = readFileSync(layoutPath, 'utf8');
const layoutWithoutComments = stripComments(layoutSource);
const layoutBodyMatch = layoutWithoutComments.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);

if (!layoutSource.includes("import PixelFarmBackdrop from '../components/PixelFarmBackdrop.astro'")) {
  failures.push('BaseLayout must import PixelFarmBackdrop');
}

if (!layoutBodyMatch || !/<PixelFarmBackdrop\s*\/>/.test(layoutBodyMatch[1])) {
  failures.push('BaseLayout must render <PixelFarmBackdrop /> inside <body>');
}

const stylesSource = readFileSync(stylesPath, 'utf8');
const requiredStyleTokens = [
  '--color-farm-sky',
  '--color-farm-grass',
  '--color-farm-soil',
  '--color-farm-wood',
  '.pixel-farm-backdrop',
  '.pixel-farm-backdrop__stars',
  '.pixel-farm-backdrop__moon',
  '.pixel-farm-backdrop__hills',
  '.pixel-farm-backdrop__fields',
  '.pixel-farm-backdrop__fence',
  '.pixel-farm-backdrop__cabin',
  'body.home .pixel-farm-backdrop',
];

for (const token of requiredStyleTokens) {
  if (!stylesSource.includes(token)) {
    failures.push(`Global styles must include pixel farm token: ${token}`);
  }
}

const indexSource = readFileSync(indexPath, 'utf8');

const forbiddenOldHeroTokens = ['hero-city-sketch', 'hero-city-night', '--hero-image', 'var(--hero-image)'];

for (const forbidden of forbiddenOldHeroTokens) {
  if (indexSource.includes(forbidden)) {
    failures.push(`Homepage should not reference the old city hero system: ${forbidden}`);
  }
}

for (const required of ['pixel-farm-hero', 'pixel-farm-hero__field', 'pixel-farm-hero__cabin']) {
  if (!indexSource.includes(required)) {
    failures.push(`Homepage must include original pixel farm hero token: ${required}`);
  }
}

for (const routePath of routePaths) {
  const source = stripComments(readFileSync(join(root, routePath), 'utf8'));
  if (!/<BaseLayout(?:\s|>)[\s\S]*<\/BaseLayout>/.test(source)) {
    failures.push(`${routePath} must use BaseLayout so the pixel farm backdrop appears on the page`);
  }
}

for (const sourceFile of sourceFiles) {
  const source = readFileSync(join(root, sourceFile), 'utf8');

  for (const forbidden of forbiddenOldHeroTokens) {
    if (source.includes(forbidden)) {
      failures.push(`${sourceFile} should not reference the old city hero system: ${forbidden}`);
    }
  }

  if (/(Stardew|星露谷|stardew)/.test(source)) {
    failures.push(`${sourceFile} should describe the background as original pixel farm art, not as a direct game copy`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
