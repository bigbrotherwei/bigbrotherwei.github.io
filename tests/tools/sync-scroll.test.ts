import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { createSyncScroll } from '../../src/lib/tools/sync-scroll.ts';

const fixture = () => {
  const window = new JSDOM('<textarea></textarea><div></div>').window;
  const source = window.document.querySelector('textarea')!;
  const preview = window.document.querySelector('div')!;
  let sourceHeight = 1200;
  let previewHeight = 1000;
  Object.defineProperty(source, 'scrollHeight', { get: () => sourceHeight });
  Object.defineProperty(source, 'clientHeight', { get: () => 400 });
  Object.defineProperty(preview, 'scrollHeight', { get: () => previewHeight });
  Object.defineProperty(preview, 'clientHeight', { get: () => 500 });
  let active = true;
  const controller = createSyncScroll({ source, preview, enabled: () => active });
  return {
    window, source, preview, controller,
    setSourceHeight: (value: number) => { sourceHeight = value; },
    setPreviewHeight: (value: number) => { previewHeight = value; },
    setActive: (value: boolean) => { active = value; },
  };
};

test('scrolling either pane maps top, middle and bottom proportionally', () => {
  const { source, preview, controller } = fixture();
  source.scrollTop = 400;
  controller.onSourceScroll();
  assert.equal(preview.scrollTop, 250);
  source.scrollTop = 800;
  controller.onSourceScroll();
  assert.equal(preview.scrollTop, 500);
  preview.scrollTop = 0;
  controller.onPreviewScroll();
  assert.equal(source.scrollTop, 0);
  preview.scrollTop = 125;
  controller.onPreviewScroll();
  assert.equal(source.scrollTop, 200);
});

test('a pane with no scrolling distance never creates NaN or a loop', () => {
  const { source, preview, controller, setPreviewHeight, setSourceHeight } = fixture();
  setPreviewHeight(500);
  source.scrollTop = 100;
  controller.onSourceScroll();
  assert.equal(preview.scrollTop, 0);
  setSourceHeight(400);
  preview.scrollTop = 100;
  controller.onPreviewScroll();
  assert.equal(source.scrollTop, 0);
});

test('programmatic echo is ignored but a later user drag changes the driver', () => {
  const { source, preview, controller } = fixture();
  source.scrollTop = 400;
  controller.onSourceScroll();
  controller.onPreviewScroll();
  assert.equal(source.scrollTop, 400);
  preview.scrollTop = 400;
  controller.onPreviewScroll();
  assert.equal(source.scrollTop, 640);
});

test('refresh keeps the last reading position after preview reflow', () => {
  const { source, preview, controller, setPreviewHeight } = fixture();
  source.scrollTop = 400;
  controller.onSourceScroll();
  setPreviewHeight(2000);
  controller.refresh();
  assert.equal(preview.scrollTop, 750);
});

test('narrow layout disables linking and dispose removes listeners', () => {
  const { source, preview, controller, setActive, window } = fixture();
  setActive(false);
  source.scrollTop = 400;
  source.dispatchEvent(new window.Event('scroll'));
  assert.equal(preview.scrollTop, 0);
  setActive(true);
  controller.refresh();
  assert.equal(preview.scrollTop, 250);
  controller.dispose();
  source.scrollTop = 800;
  source.dispatchEvent(new window.Event('scroll'));
  assert.equal(preview.scrollTop, 250);
});
