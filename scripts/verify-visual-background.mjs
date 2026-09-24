import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { hasExplicitBackgroundKey } from './lib/visual-background-rules.mjs';

const root = process.cwd();
const backdropPath = join(root, 'src/components/HandPaintedFarmBackdrop.astro');
const registryPath = join(root, 'src/data/backgrounds.ts');
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
  'src/pages/search/index.astro',
  'src/pages/about.astro',
  'src/pages/posts/[slug].astro',
  'src/pages/topics/[slug].astro',
  'src/pages/projects/[slug].astro',
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

if (!existsSync(registryPath)) {
  failures.push('Missing page background registry: src/data/backgrounds.ts');
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

for (const token of [
  'class="ambient-motion" aria-hidden="true"',
  'ambient-motion__meteor',
  'ambient-motion__petal',
]) {
  if (!backdropSource.includes(token)) {
    failures.push(`Shared backdrop must render decorative ambient motion: ${token}`);
  }
}

const layoutSource = readFileSync(layoutPath, 'utf8');
const layoutWithoutComments = stripComments(layoutSource);
const layoutBodyMatch = layoutWithoutComments.match(/<body\b[^>]*>([\s\S]*?)<\/body>/);

if (!layoutSource.includes("import HandPaintedFarmBackdrop from '../components/HandPaintedFarmBackdrop.astro'")) {
  failures.push('BaseLayout must import HandPaintedFarmBackdrop');
}

if (!layoutBodyMatch || !/<HandPaintedFarmBackdrop[\s\S]*background=\{background\}[\s\S]*\/>/.test(layoutBodyMatch[1])) {
  failures.push('BaseLayout must pass the selected background to HandPaintedFarmBackdrop');
}

for (const required of ['backgroundKey', 'background.desktop', 'background.mobile', 'media="(min-width: 640.01px)"', 'media="(max-width: 640px)"']) {
  if (!layoutSource.includes(required)) {
    failures.push(`BaseLayout must select and preload only the active page background: ${required}`);
  }
}

if (existsSync(registryPath)) {
  const registrySource = readFileSync(registryPath, 'utf8');
  const entries = [...registrySource.matchAll(/^\s{2}(?:'([^']+)'|([a-z][\w-]*)):\s*\{\n([\s\S]*?)^\s{2}\},?$/gm)];
  const assetOwners = new Map();

  if (entries.length === 0) {
    failures.push('Background registry must contain at least one page background');
  }

  for (const entry of entries) {
    const key = entry[1] ?? entry[2];
    const body = entry[3];

    for (const [variant, assetMatch] of [
      ['desktop', body.match(/desktop:\s*'([^']+)'/)],
      ['mobile', body.match(/mobile:\s*'([^']+)'/)],
    ]) {
      if (!assetMatch) {
        failures.push(`Background registry entry ${key} is missing its ${variant} asset`);
        continue;
      }

      const asset = assetMatch[1];
      const previousOwner = assetOwners.get(asset);
      if (previousOwner) {
        failures.push(`Background ${key} must not reuse ${variant} asset ${asset} from ${previousOwner}`);
      } else {
        assetOwners.set(asset, `${key}.${variant}`);
      }

      const path = join(root, 'public', asset.replace(/^\//, ''));
      if (!existsSync(path)) {
        failures.push(`Missing page background asset: ${asset}`);
        continue;
      }

      const metadata = readWebpDimensions(path);
      const isMobile = variant === 'mobile';
      const minimumWidth = isMobile ? 720 : 1600;
      const minimumHeight = isMobile ? 1280 : 900;

      if (!metadata) {
        failures.push(`Page background must be a lossy WebP image: ${asset}`);
      } else if (metadata.width < minimumWidth || metadata.height < minimumHeight) {
        failures.push(`Page background is too small: ${asset} (${metadata.width}x${metadata.height})`);
      } else if (metadata.bytes < 80_000 || metadata.bytes > 1_000_000) {
        failures.push(`Page background size must stay between 80 KB and 1 MB: ${asset}`);
      }
    }
  }
}

const stylesSource = readFileSync(stylesPath, 'utf8');
if (!/\.ambient-motion\s*\{[^}]*pointer-events:\s*none;/u.test(stylesSource)) {
  failures.push('Ambient motion must not intercept pointer input');
}

if (!/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\.ambient-motion\s*\{[^}]*display:\s*none;/u.test(stylesSource)) {
  failures.push('Ambient motion must stop when reduced motion is requested');
}

for (const token of [
  '.hand-painted-farm-backdrop',
  'var(--background-image)',
  'var(--background-image-mobile)',
  'var(--background-position)',
  'var(--background-position-mobile)',
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

const pageBackgroundRequirements = {
  'src/pages/index.astro': 'home',
  'src/pages/posts/index.astro': 'posts-index',
  'src/pages/topics/index.astro': 'topics-index',
  'src/pages/tools/index.astro': 'tools-index',
  'src/pages/projects/index.astro': 'projects-index',
  'src/pages/search/index.astro': 'search-index',
  'src/pages/about.astro': 'about',
  'src/pages/tools/json.astro': 'tool-json',
  'src/pages/tools/base64.astro': 'tool-base64',
  'src/pages/tools/url.astro': 'tool-url',
  'src/pages/tools/timestamp.astro': 'tool-timestamp',
  'src/pages/tools/uuid.astro': 'tool-uuid',
  'src/pages/tools/text-counter.astro': 'tool-text-counter',
};

const expectedToolAssets = {
  'tool-json': {
    desktop: '/images/backgrounds/tool-json-archive.webp',
    mobile: '/images/backgrounds/tool-json-archive-mobile.webp',
  },
  'tool-base64': {
    desktop: '/images/backgrounds/tool-base64-telegraph.webp',
    mobile: '/images/backgrounds/tool-base64-telegraph-mobile.webp',
  },
  'tool-url': {
    desktop: '/images/backgrounds/tool-url-waystation.webp',
    mobile: '/images/backgrounds/tool-url-waystation-mobile.webp',
  },
  'tool-timestamp': {
    desktop: '/images/backgrounds/tool-timestamp-clockshop.webp',
    mobile: '/images/backgrounds/tool-timestamp-clockshop-mobile.webp',
  },
  'tool-uuid': {
    desktop: '/images/backgrounds/tool-uuid-greenhouse.webp',
    mobile: '/images/backgrounds/tool-uuid-greenhouse-mobile.webp',
  },
  'tool-text-counter': {
    desktop: '/images/backgrounds/tool-text-scriptorium.webp',
    mobile: '/images/backgrounds/tool-text-scriptorium-mobile.webp',
  },
};

const expectedSearchAssets = {
  desktop: '/images/backgrounds/search-index.webp',
  mobile: '/images/backgrounds/search-index-mobile.webp',
};

for (const [routePath, key] of Object.entries(pageBackgroundRequirements)) {
  const source = readFileSync(join(root, routePath), 'utf8');
  if (!hasExplicitBackgroundKey(source, key)) {
    failures.push(`${routePath} must explicitly use its unique background key: ${key}`);
  }
}

if (existsSync(registryPath)) {
  const registrySource = readFileSync(registryPath, 'utf8');
  const searchEntryStart = registrySource.indexOf("  'search-index': {");
  const searchEntryEnd = registrySource.indexOf('\n  },', searchEntryStart);
  const searchEntrySource = searchEntryStart === -1 || searchEntryEnd === -1
    ? ''
    : registrySource.slice(searchEntryStart, searchEntryEnd);

  if (!searchEntrySource) {
    failures.push('Missing required unique search background key: search-index');
  } else {
    for (const [variant, asset] of Object.entries(expectedSearchAssets)) {
      if (!searchEntrySource.includes(`${variant}: '${asset}'`)) {
        failures.push(`Search background must register its dedicated ${variant} asset`);
      }
    }
  }

  for (const [key, assets] of Object.entries(expectedToolAssets)) {
    const entryStart = registrySource.indexOf(`  '${key}': {`);
    const entryEnd = registrySource.indexOf('\n  },', entryStart);
    const entrySource = entryStart === -1 || entryEnd === -1
      ? ''
      : registrySource.slice(entryStart, entryEnd);

    if (!entrySource) {
      failures.push(`Missing required unique tool background key: ${key}`);
      continue;
    }

    for (const [variant, asset] of Object.entries(assets)) {
      if (!entrySource.includes(`${variant}: '${asset}'`)) {
        failures.push(`Tool background ${key} must register its dedicated ${variant} asset`);
      }
    }
  }
}

const expectedContentBackgrounds = {
  posts: {
    'blog-rebuild-roadmap.md': 'post-blog-rebuild-roadmap',
    'github-pages-workflow.md': 'post-github-pages-workflow',
    'pixel-farm-background.md': 'post-pixel-farm-background',
  },
  topics: {
    'blog-rebuild.md': 'topic-blog-rebuild',
    'developer-toolbox.md': 'topic-developer-toolbox',
  },
  projects: {
    'bigbrotherwei-github-io.md': 'project-personal-blog',
  },
};

const claimedBackgrounds = new Map(
  Object.entries(pageBackgroundRequirements).map(([routePath, key]) => [key, routePath]),
);

for (const [collection, expectedEntries] of Object.entries(expectedContentBackgrounds)) {
  for (const [filename, key] of Object.entries(expectedEntries)) {
    const source = readFileSync(join(root, 'src/content', collection, filename), 'utf8');
    if (!source.includes(`background: "${key}"`)) {
      failures.push(`${collection}/${filename} must declare its unique background: ${key}`);
    }
  }

  const collectionPath = join(root, 'src/content', collection);
  for (const filename of readdirSync(collectionPath).filter((name) => name.endsWith('.md'))) {
    const source = readFileSync(join(collectionPath, filename), 'utf8');
    const backgroundMatch = source.match(/^background:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (!backgroundMatch) {
      failures.push(`${collection}/${filename} must declare a background key`);
      continue;
    }

    const key = backgroundMatch[1].trim();
    const previousOwner = claimedBackgrounds.get(key);
    if (previousOwner) {
      failures.push(`${collection}/${filename} must not reuse background ${key} from ${previousOwner}`);
    } else {
      claimedBackgrounds.set(key, `${collection}/${filename}`);
    }
  }
}

for (const [routePath, expression] of [
  ['src/pages/posts/[slug].astro', 'backgroundKey={post.data.background}'],
  ['src/pages/topics/[slug].astro', 'backgroundKey={topic.data.background}'],
  ['src/pages/projects/[slug].astro', 'backgroundKey={project.data.background}'],
]) {
  const source = readFileSync(join(root, routePath), 'utf8');
  if (!source.includes(expression)) {
    failures.push(`${routePath} must pass its content-specific background to BaseLayout`);
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
