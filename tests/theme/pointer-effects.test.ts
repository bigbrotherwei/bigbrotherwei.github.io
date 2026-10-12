import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseFruitKinds, fruitKinds, mountPointerEffects } from '../../src/scripts/pointer-effects.ts';

function fixture(reducedMotion = false) {
  let drawnCircles = 0;
  const circles: Array<{ x: number; y: number }> = [];
  let nextFrame: ((time: number) => void) | undefined;
  const listeners = new Map<string, (event: any) => void>();
  const context = Object.fromEntries([
    'setTransform', 'clearRect', 'save', 'restore', 'translate', 'rotate', 'scale',
    'beginPath', 'closePath', 'ellipse', 'fill', 'stroke', 'moveTo', 'lineTo', 'bezierCurveTo',
  ].map((name) => [name, () => {}])) as Record<string, (...args: any[]) => void>;
  context.arc = (x: number, y: number) => { drawnCircles += 1; circles.push({ x, y }); };
  const canvas = { width: 0, height: 0, getContext: () => context };
  const media = { matches: reducedMotion, addEventListener: () => {}, removeEventListener: () => {} };
  const document = { querySelector: () => canvas } as unknown as Document;
  const window = {
    innerWidth: 800, innerHeight: 600, devicePixelRatio: 2,
    matchMedia: () => media,
    requestAnimationFrame: (callback: (time: number) => void) => { nextFrame = callback; return 1; },
    cancelAnimationFrame: () => { nextFrame = undefined; },
    addEventListener: (name: string, callback: (event: any) => void) => { listeners.set(name, callback); },
    removeEventListener: (name: string) => { listeners.delete(name); },
  } as unknown as Window;
  return {
    canvas, circles, listeners, document, window,
    tick: (time: number) => nextFrame?.(time),
    get drawnCircles() { return drawnCircles; },
    get pendingFrame() { return Boolean(nextFrame); },
  };
}

test('mouse movement paints a rainbow and clicks paint fruit without intercepting input', () => {
  const app = fixture();
  const dispose = mountPointerEffects(app.document, app.window);
  assert.equal(app.canvas.width, 1600);
  assert.equal(app.canvas.height, 1200);
  app.listeners.get('pointermove')?.({ pointerType: 'mouse', clientX: 100, clientY: 100 });
  assert.equal(app.pendingFrame, true);
  app.tick(16);
  assert.ok(app.drawnCircles >= 6);
  app.listeners.get('pointerdown')?.({ pointerType: 'mouse', clientX: 150, clientY: 150 });
  app.tick(32);
  assert.ok(app.drawnCircles > 6);
  dispose();
  assert.equal(app.listeners.has('pointermove'), false);
});

test('reduced motion suppresses pointer animation', () => {
  const app = fixture(true);
  mountPointerEffects(app.document, app.window);
  app.listeners.get('pointermove')?.({ pointerType: 'mouse', clientX: 100, clientY: 100 });
  app.listeners.get('pointerdown')?.({ pointerType: 'mouse', clientX: 100, clientY: 100 });
  assert.equal(app.pendingFrame, false);
});

test('the rainbow stays below and right of the mouse pointer', () => {
  const app = fixture();
  mountPointerEffects(app.document, app.window);
  app.listeners.get('pointermove')?.({ pointerType: 'mouse', clientX: 100, clientY: 100 });
  app.tick(16);
  assert.ok(app.circles.length >= 6);
  assert.ok(app.circles.every(({ x, y }) => x > 100 && y > 100));
});

test('a click uses a few distinct kinds from a broader fruit selection', () => {
  assert.ok(fruitKinds.length >= 10);
  const kinds = chooseFruitKinds(() => 0.4);
  assert.ok(kinds.length >= 3 && kinds.length <= 5);
  assert.equal(new Set(kinds).size, kinds.length);
  assert.ok(kinds.every((kind) => fruitKinds.includes(kind)));
});
