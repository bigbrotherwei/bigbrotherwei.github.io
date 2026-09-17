import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const backdropPath = join(root, 'src/components/HandPaintedFarmBackdrop.astro');
const oldBackdropPath = join(root, 'src/components/PixelFarmBackdrop.astro');
const imagePath = join(root, 'public/images/hand-painted-farm-dusk.webp');
const mobileImagePath = join(root, 'public/images/hand-painted-farm-dusk-mobile.webp');
const layoutPath = join(root, 'src/layouts/BaseLayout.astro');
const stylesPath = join(root, 'src/styles/global.css');
const routePaths = [
  'src/pages/index.astro',
  'src/pages/posts/index.astro',
  'src/pages/topics/index.astro',
  'src/pages/tools/index.astro',
  'src/pages/projects/index.astro',
  'src/pages/about.astro',
  'src/pages/posts/[slug].astro',
  'src/pages/topics/[slug].astro',
];

const failures = [];
const stripComments = (source) => source.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const readWebpDimensions = (path) => {
  const data = readFileSync(path);
  const isWebp = data.toString('ascii', 0, 4) === 'RIFF'
    && data.toString('ascii', 8, 12) === 'WEBP'
    && data.toString('ascii', 12, 16) === 'VP8 ';

  if (!isWebp || data.length < 30) {
    return null;
  }

  return {
    width: data.readUInt16LE(26) & 0x3fff,
    height: data.readUInt16LE(28) & 0x3fff,
    bytes: data.length,
  };
};

if (!existsSync(backdropPath)) {
  failures.push('Missing shared hand-painted farm backdrop component');
}

if (existsSync(oldBackdropPath)) {
  failures.push('Remove the old CSS pixel farm backdrop component');
}

if (!existsSync(imagePath)) {
  failures.push('Missing hand-painted farm background image');
}

if (!existsSync(mobileImagePath)) {
  failures.push('Missing mobile hand-painted farm background image');
}

for (const [path, minimumWidth, minimumHeight, label] of [
  [imagePath, 1600, 900, 'desktop'],
  [mobileImagePath, 720, 1280, 'mobile'],
]) {
  if (!existsSync(path)) {
    continue;
  }

  const metadata = readWebpDimensions(path);
  if (!metadata) {
    failures.push(`${label} farm background must be a lossy WebP image`);
    continue;
  }

  if (metadata.width < minimumWidth || metadata.height < minimumHeight) {
    failures.push(`${label} farm background is too small: ${metadata.width}x${metadata.height}`);
  }

  if (metadata.bytes < 80_000 || metadata.bytes > 1_000_000) {
    failures.push(`${label} farm background size must stay between 80 KB and 1 MB`);
  }
}

const backdropSource = readFileSync(backdropPath, 'utf8');
if (!backdropSource.includes('aria-hidden="true"')) {
  failures.push('Decorative farm backdrop must be hidden from assistive technology');
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

for (const preload of [
  'href="/images/hand-painted-farm-dusk.webp" media="(min-width: 641px)"',
  'href="/images/hand-painted-farm-dusk-mobile.webp" media="(max-width: 640px)"',
]) {
  if (!layoutSource.includes(preload)) {
    failures.push(`BaseLayout must include responsive image preload: ${preload}`);
  }
}

const stylesSource = readFileSync(stylesPath, 'utf8');
for (const token of [
  '.hand-painted-farm-backdrop',
  '/images/hand-painted-farm-dusk.webp',
  '/images/hand-painted-farm-dusk-mobile.webp',
  'background-size: cover',
  'body.home .hand-painted-farm-backdrop',
  '@media (max-width: 640px)',
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
