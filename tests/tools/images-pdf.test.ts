import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildImagesPdf, placeImage, validateImageFiles } from '../../src/lib/tools/images-pdf.ts';

const mib = 1024 * 1024;
const file = (name: string, type = 'image/jpeg', size = 8) =>
  new File([new Uint8Array(size)], name, { type });

test('requires one to twenty supported images', () => {
  assert.equal(validateImageFiles([]).ok, false);
  assert.equal(validateImageFiles(Array.from({ length: 20 }, (_, i) => file(`${i}.jpg`))).ok, true);
  const tooMany = validateImageFiles(Array.from({ length: 21 }, (_, i) => file(`${i}.jpg`)));
  assert.equal(tooMany.ok, false);
  if (!tooMany.ok) assert.match(tooMany.error, /20/);
  assert.equal(validateImageFiles([file('a.png', 'image/png'), file('b.webp', 'image/webp')]).ok, true);
});

test('reports names for unsupported, empty and oversized files', () => {
  const invalid = validateImageFiles([file('bad.gif', 'image/gif')]);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.error, /bad\.gif.*JPEG.*PNG.*WebP/s);
  const empty = validateImageFiles([file('empty.jpg', 'image/jpeg', 0)]);
  assert.equal(empty.ok, false);
  if (!empty.ok) assert.match(empty.error, /empty\.jpg/);
  const tooLarge = validateImageFiles([file('huge.jpg', 'image/jpeg', 20 * mib + 1)]);
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) assert.match(tooLarge.error, /huge\.jpg/);
  const total = validateImageFiles(Array.from({ length: 6 }, (_, i) => file(`${i}.jpg`, 'image/jpeg', 17 * mib)));
  assert.equal(total.ok, false);
  if (!total.ok) assert.match(total.error, /100/);
});

test('places images proportionally within a 24 pt inset', () => {
  assert.deepEqual(placeImage(1000, 500, 842, 595, 24), { x: 24, y: 99, width: 794, height: 397 });
  assert.deepEqual(placeImage(500, 1000, 595, 842, 24), { x: 99, y: 24, width: 397, height: 794 });
});

test('writes twenty ordered A4 pages and rejects damaged JPEG bytes', async () => {
  const { readFileSync } = await import('node:fs');
  const jpeg = new Uint8Array(readFileSync(new URL('../fixtures/tiny.jpg', import.meta.url)));
  const images = Array.from({ length: 20 }, (_, i) => ({
    name: `${i}.jpg`, bytes: jpeg, width: i % 2 ? 100 : 200, height: i % 2 ? 200 : 100,
  }));
  const bytes = await buildImagesPdf(images);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 20);
  for (let i = 0; i < 20; i += 1) {
    const { width, height } = pdf.getPage(i).getSize();
    assert.ok(i % 2 ? height > width : width > height);
  }
  await assert.rejects(buildImagesPdf([{ name: 'broken.jpg', bytes: new Uint8Array([1, 2]), width: 1, height: 1 }]), /broken\.jpg/);
});
