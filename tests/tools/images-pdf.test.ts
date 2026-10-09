import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { buildImagesPdf, normalizeImage, placeImage, refreshImagePreviewUrls, restoreQueueFocus, startPdfDownload, validateImageFiles, validateImageFileSignatures } from '../../src/lib/tools/images-pdf.ts';

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

test('recreates thumbnail URLs from retained files after page cache restoration', () => {
  const queued = [
    { file: file('first.jpg'), url: 'blob:released-1' },
    { file: file('second.jpg'), url: 'blob:released-2' },
  ];
  const created: string[] = [];
  refreshImagePreviewUrls(queued, (source) => {
    created.push(source.name);
    return `blob:new-${created.length}`;
  });
  assert.deepEqual(created, ['first.jpg', 'second.jpg']);
  assert.deepEqual(queued.map((item) => item.url), ['blob:new-1', 'blob:new-2']);
});

test('PDF page reconnects thumbnails when the browser restores it from cache', async () => {
  const { readFileSync } = await import('node:fs');
  const page = readFileSync(new URL('../../src/pages/tools/images-pdf.astro', import.meta.url), 'utf8');
  assert.match(page, /addEventListener\('pagehide',[\s\S]*?previewUrlsReleased = true/);
  assert.match(page, /addEventListener\('pageshow',[\s\S]*?refreshImagePreviewUrls\(queue\)/);
});

test('checks actual signatures, including a GIF mislabeled as JPEG', async () => {
  const { readFileSync } = await import('node:fs');
  const bytes = (path: string) => new Uint8Array(readFileSync(new URL(path, import.meta.url)));
  const jpeg = new File([bytes('../fixtures/tiny.jpg')], 'good.jpg', { type: 'image/jpeg' });
  const png = new File([bytes('../fixtures/transparent.png')], 'good.png', { type: 'image/png' });
  const webp = new File([bytes('../../public/images/backgrounds/tool-images-pdf.webp')], 'good.webp', { type: 'image/webp' });
  assert.equal((await validateImageFileSignatures([jpeg, png, webp])).ok, true);

  const corrupt = new File([new Uint8Array([1, 2, 3, 4])], 'corrupt.jpg', { type: 'image/jpeg' });
  const disguisedGif = new File([bytes('../fixtures/tiny.gif')], 'disguised.jpg', { type: 'image/jpeg' });
  const invalid = await validateImageFileSignatures([corrupt, disguisedGif]);
  assert.equal(invalid.ok, false);
  if (!invalid.ok) assert.match(invalid.error, /corrupt\.jpg.*disguised\.jpg/s);
});

test('writes twenty A4 pages with distinct JPEG content in queue order', async () => {
  const { readFileSync } = await import('node:fs');
  const jpeg = new Uint8Array(readFileSync(new URL('../fixtures/tiny.jpg', import.meta.url)));
  const otherJpeg = new Uint8Array(readFileSync(new URL('../fixtures/tiny-mobile.jpg', import.meta.url)));
  const images = Array.from({ length: 20 }, (_, i) => ({
    name: `${i}.jpg`, bytes: i % 2 ? otherJpeg : jpeg, width: i % 2 ? 100 : 200, height: i % 2 ? 200 : 100,
  }));
  const bytes = await buildImagesPdf(images);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 20);
  for (let i = 0; i < 20; i += 1) {
    const { width, height } = pdf.getPage(i).getSize();
    assert.ok(i % 2 ? height > width : width > height);
    const resources = pdf.getPage(i).node.Resources();
    assert.ok(resources);
    const imagesOnPage = resources.lookup(PDFName.of('XObject'), PDFDict);
    assert.ok(imagesOnPage);
    assert.equal(imagesOnPage.entries().length, 1);
    const embedded = pdf.context.lookup(imagesOnPage.entries()[0][1]);
    assert.ok(embedded instanceof PDFRawStream);
    assert.deepEqual(embedded.getContents(), images[i].bytes);
  }
});

test('preserves a nonrepeating order of three distinct landscape JPEGs', async () => {
  const { readFileSync } = await import('node:fs');
  const bytes = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)));
  const ordered = [bytes('tiny-green.jpg'), bytes('tiny.jpg'), bytes('tiny-blue.jpg')];
  const pdf = await PDFDocument.load(await buildImagesPdf(ordered.map((image, index) => ({
    name: `${index}.jpg`, bytes: image, width: 2, height: 1,
  }))));
  assert.equal(pdf.getPageCount(), 3);
  for (const [index, expected] of ordered.entries()) {
    const resources = pdf.getPage(index).node.Resources();
    assert.ok(resources);
    const images = resources.lookup(PDFName.of('XObject'), PDFDict);
    assert.ok(images);
    assert.equal(images.entries().length, 1);
    const embedded = pdf.context.lookup(images.entries()[0][1]);
    assert.ok(embedded instanceof PDFRawStream);
    assert.deepEqual(embedded.getContents(), expected);
  }
});

test('reports damaged JPEG bytes during PDF creation', async () => {
  await assert.rejects(buildImagesPdf([{ name: 'broken.jpg', bytes: new Uint8Array([1, 2]), width: 1, height: 1 }]), /broken\.jpg/);
});

test('composites transparent pixels over white and releases canvas resources', async () => {
  const { readFileSync } = await import('node:fs');
  const source = new File([new Uint8Array(readFileSync(new URL('../fixtures/transparent.png', import.meta.url)))], 'transparent.png', { type: 'image/png' });
  const pixels = new Uint8Array(16);
  let fill = '';
  let encodedAs = '';
  let closed = false;
  const bitmap = { width: 2, height: 2, close: () => { closed = true; } };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({
      set fillStyle(value: string) { fill = value; },
      fillRect: () => { if (fill === '#fff') for (let i = 0; i < pixels.length; i += 4) pixels.set([255, 255, 255, 255], i); },
      drawImage: () => { pixels.set([255, 0, 0, 255], 0); },
    }),
    toBlob: (done: (blob: Blob | null) => void, type: string) => { encodedAs = type; done(new Blob([pixels])); },
  };
  const image = await normalizeImage(source,
    async () => bitmap as ImageBitmap, () => canvas as unknown as HTMLCanvasElement);
  assert.deepEqual([...image.bytes], [255, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);
  assert.equal(encodedAs, 'image/jpeg');
  assert.equal(closed, true);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('closes the bitmap and clears the canvas when drawing fails', async () => {
  let closed = false;
  const bitmap = { width: 1, height: 1, close: () => { closed = true; } };
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ fillStyle: '', fillRect: () => {}, drawImage: () => { throw new Error('drawing failed'); } }),
  };
  await assert.rejects(normalizeImage(file('broken.png', 'image/png'),
    async () => bitmap as ImageBitmap, () => canvas as unknown as HTMLCanvasElement), /broken\.png.*drawing failed/);
  assert.equal(closed, true);
  assert.equal(canvas.width, 0);
  assert.equal(canvas.height, 0);
});

test('restores focus to enabled queue controls or the upload input', () => {
  let focused = '';
  const button = (name: string, disabled = false) => ({
    disabled, dataset: { move: name }, focus: () => { focused = name; },
  });
  const up = button('up', true);
  const down = button('down');
  const remove = button('remove');
  const row = { querySelectorAll: () => [up, down, remove] };
  const fallback = { focus: () => { focused = 'upload'; } };
  restoreQueueFocus({ children: [row] } as unknown as HTMLElement, 0, 'up', fallback as HTMLElement);
  assert.equal(focused, 'down');
  restoreQueueFocus({ children: [row] } as unknown as HTMLElement, 0, 'down', fallback as HTMLElement);
  assert.equal(focused, 'down');
  restoreQueueFocus({ children: [] } as unknown as HTMLElement, 0, 'remove', fallback as HTMLElement);
  assert.equal(focused, 'upload');
});

test('releases the download URL and anchor when clicking the download throws', () => {
  const active = new Set<string>();
  const released: string[] = [];
  let removed = false;
  let scheduled = false;
  const anchor = {
    download: '', href: '',
    click: () => { throw new Error('download blocked'); },
    remove: () => { removed = true; },
  };
  assert.throws(() => startPdfDownload(new Blob(['pdf']), 'images.pdf', active, {
    createObjectURL: () => 'blob:test',
    revokeObjectURL: (url) => { released.push(url); },
    createAnchor: () => anchor as unknown as HTMLAnchorElement,
    appendAnchor: () => {},
    scheduleRevoke: () => { scheduled = true; },
  }), /download blocked/);
  assert.equal(anchor.download, 'images.pdf');
  assert.equal(anchor.href, 'blob:test');
  assert.equal(removed, true);
  assert.equal(scheduled, false);
  assert.deepEqual(released, ['blob:test']);
  assert.equal(active.size, 0);
});
