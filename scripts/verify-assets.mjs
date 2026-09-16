import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const heroPath = join(root, 'public/images/hero-city-night.png');
const indexPath = join(root, 'src/pages/index.astro');
const publicReference = '/images/hero-city-night.png';

const failures = [];

if (!existsSync(heroPath)) {
  failures.push(`Missing hero image: ${heroPath}`);
} else {
  const size = statSync(heroPath).size;
  if (size < 20_000) {
    failures.push(`Hero image looks too small to be a real bitmap asset: ${size} bytes`);
  }
}

const indexSource = readFileSync(indexPath, 'utf8');

if (!indexSource.includes(publicReference)) {
  failures.push(`Homepage must reference ${publicReference}`);
}

if (!indexSource.includes('background-image')) {
  failures.push('Homepage hero should use background-image for the city-night asset');
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
