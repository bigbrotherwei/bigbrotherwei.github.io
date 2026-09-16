import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const heroPath = join(root, 'public/images/hero-city-sketch.png');
const forbiddenHeroPath = join(root, 'public/images/hero-city-night.png');
const indexPath = join(root, 'src/pages/index.astro');
const requiredComponentPaths = [
  'src/layouts/BaseLayout.astro',
  'src/components/SiteNav.astro',
  'src/components/PageHero.astro',
];
const publicReference = '/images/hero-city-sketch.png';
const forbiddenReference = '/images/hero-city-night.png';

const failures = [];

if (!existsSync(heroPath)) {
  failures.push(`Missing hero image: ${heroPath}`);
} else {
  const size = statSync(heroPath).size;
  if (size < 20_000) {
    failures.push(`Hero image looks too small to be a real bitmap asset: ${size} bytes`);
  }
}

if (existsSync(forbiddenHeroPath)) {
  failures.push(`Remove photorealistic hero image: ${forbiddenHeroPath}`);
}

for (const componentPath of requiredComponentPaths) {
  const absolutePath = join(root, componentPath);
  if (!existsSync(absolutePath)) {
    failures.push(`Missing shared component: ${componentPath}`);
  }
}

const indexSource = readFileSync(indexPath, 'utf8');

if (!indexSource.includes(publicReference)) {
  failures.push(`Homepage must reference ${publicReference}`);
}

if (indexSource.includes(forbiddenReference)) {
  failures.push(`Homepage must not reference photorealistic asset ${forbiddenReference}`);
}

if (!indexSource.includes('background-image')) {
  failures.push('Homepage hero should use background-image for the hand-drawn city asset');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
