import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const indexPath = join(root, 'src/pages/index.astro');
const requiredComponentPaths = [
  'src/layouts/BaseLayout.astro',
  'src/components/SiteNav.astro',
  'src/components/PageHero.astro',
  'src/components/HandPaintedFarmBackdrop.astro',
];
const requiredAssetPaths = [
  'public/images/hand-painted-farm-dusk.webp',
];
const requiredRoutePaths = [
  'src/pages/posts/index.astro',
  'src/pages/topics/index.astro',
  'src/pages/tools/index.astro',
  'src/pages/projects/index.astro',
  'src/pages/about.astro',
];
const forbiddenAssetPaths = [
  'public/images/hero-city-sketch.png',
  'public/images/hero-city-night.png',
];
const forbiddenReferences = [
  '/images/hero-city-sketch.png',
  '/images/hero-city-night.png',
];
const sourceScanRoots = [
  'src/pages',
  'src/components',
  'src/layouts',
  'src/styles',
];

const failures = [];
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

for (const assetPath of forbiddenAssetPaths) {
  const absolutePath = join(root, assetPath);
  if (existsSync(absolutePath)) {
    failures.push(`Remove unused city hero asset: ${assetPath}`);
  }
}

for (const componentPath of requiredComponentPaths) {
  const absolutePath = join(root, componentPath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing shared component: ${componentPath}`);
  }
}

for (const assetPath of requiredAssetPaths) {
  const absolutePath = join(root, assetPath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing required visual asset: ${assetPath}`);
  }
}

for (const routePath of requiredRoutePaths) {
  const absolutePath = join(root, routePath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing primary navigation route: ${routePath}`);
  }
}

const indexSource = readFileSync(indexPath, 'utf8');

for (const sourceFile of sourceFiles) {
  const source = readFileSync(join(root, sourceFile), 'utf8');

  for (const forbiddenReference of forbiddenReferences) {
    if (source.includes(forbiddenReference)) {
      failures.push(`${sourceFile} must not reference old city hero asset ${forbiddenReference}`);
    }
  }

  if (/hero-city|--hero-image|var\(--hero-image\)/.test(source)) {
    failures.push(`${sourceFile} must use the shared hand-painted farm background instead of the old city hero system`);
  }
}

for (const forbiddenToken of ['pixel-farm-hero', 'pixel-farm-hero__cabin', 'pixel-farm-hero__field']) {
  if (indexSource.includes(forbiddenToken)) {
    failures.push(`Homepage must remove old CSS pixel farm token: ${forbiddenToken}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
