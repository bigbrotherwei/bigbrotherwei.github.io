import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const quotePath = join(root, 'src/data/quotes.ts');
const failures = [];

if (!existsSync(quotePath)) {
  failures.push(`Missing quote data module: ${quotePath}`);
} else {
  const source = readFileSync(quotePath, 'utf8');
  const quoteCount = (source.match(/\btext:\s*"/g) ?? []).length;

  if (!source.includes('export type Quote')) {
    failures.push('quotes.ts must export Quote type');
  }

  if (!source.includes('export const quotes')) {
    failures.push('quotes.ts must export quotes array');
  }

  if (!source.includes('export function getDailyQuote')) {
    failures.push('quotes.ts must export getDailyQuote');
  }

  if (quoteCount < 100) {
    failures.push(`Expected at least 100 quotes, found ${quoteCount}`);
  }

  for (const field of ['text:', 'author:', 'tags:']) {
    if (!source.includes(field)) {
      failures.push(`quotes.ts must contain ${field} fields`);
    }
  }

  if (/\b(?:TODO|TBD)\b/.test(source)) {
    failures.push('quotes.ts must not contain TODO or TBD placeholders');
  }
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}
