import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createQrController, validateQrText } from '../../src/lib/tools/qr.ts';

test('QR text requires content and accepts at most 1000 UTF-8 bytes', () => {
  assert.equal(validateQrText('  ').ok, false);
  assert.equal(validateQrText('a'.repeat(1000)).ok, true);
  assert.equal(validateQrText('a'.repeat(1001)).ok, false);
  assert.equal(validateQrText('中'.repeat(333) + 'a').ok, true);
  assert.equal(validateQrText('中'.repeat(334)).ok, false);
});

test('a failed regeneration removes the previous preview and download', async () => {
  const dom = new JSDOM('<textarea id="text"></textarea><select id="size"><option value="256">256</option></select><select id="level"><option value="M">M</option></select><canvas id="canvas"></canvas><a id="download"></a><p id="status"></p>');
  const document = dom.window.document;
  const text = document.querySelector<HTMLTextAreaElement>('#text')!;
  const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
  const download = document.querySelector<HTMLAnchorElement>('#download')!;
  const status = document.querySelector<HTMLElement>('#status')!;
  const controller = createQrController({
    text,
    size: document.querySelector<HTMLSelectElement>('#size')!,
    level: document.querySelector<HTMLSelectElement>('#level')!,
    canvas,
    download,
    status,
  }, async () => {
    if (text.value === 'fail') throw new Error('capacity exceeded');
    return 'data:image/png;base64,AA==';
  });

  text.value = 'first';
  await controller.generate();
  assert.equal(canvas.hidden, false);
  assert.equal(download.hidden, false);
  assert.match(download.href, /^data:image\/png/);

  text.value = 'fail';
  await controller.generate();
  assert.equal(canvas.hidden, true);
  assert.equal(download.hidden, true);
  assert.equal(download.getAttribute('href'), null);
  assert.equal(status.dataset.state, 'error');
  dom.window.close();
});
