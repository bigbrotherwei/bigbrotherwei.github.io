type FruitKind = 'watermelon' | 'apple' | 'banana' | 'cabbage';

interface FruitParticle {
  kind: FruitKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  life: number;
}

interface TrailParticle {
  x: number;
  y: number;
  color: string;
  life: number;
}

const fruitKinds: readonly FruitKind[] = ['watermelon', 'apple', 'banana', 'cabbage'];
const rainbowColors = ['#ef6260', '#f2a65b', '#f6d878', '#86c88b', '#77c8d6', '#9c91d4'];

function drawFruit(ctx: CanvasRenderingContext2D, particle: FruitParticle): void {
  ctx.save();
  ctx.translate(particle.x, particle.y);
  ctx.rotate(particle.angle);
  ctx.scale(particle.size / 20, particle.size / 20);
  ctx.globalAlpha = Math.min(1, particle.life * 2);
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';

  if (particle.kind === 'watermelon') {
    ctx.fillStyle = '#64aa62';
    ctx.strokeStyle = '#285e4c';
    ctx.beginPath();
    ctx.ellipse(0, 0, 9, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -7); ctx.bezierCurveTo(-2, -3, -2, 3, -5, 7);
    ctx.moveTo(2, -8); ctx.bezierCurveTo(5, -3, 5, 3, 2, 8);
    ctx.stroke();
  } else if (particle.kind === 'apple') {
    ctx.fillStyle = '#da5c4c';
    ctx.strokeStyle = '#813c38';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.bezierCurveTo(-11, -11, -11, 1, -5, 7);
    ctx.bezierCurveTo(-2, 10, 0, 8, 0, 8);
    ctx.bezierCurveTo(0, 8, 3, 10, 6, 6);
    ctx.bezierCurveTo(11, 0, 8, -10, 0, -5);
    ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#65452f';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(1, -10); ctx.stroke();
    ctx.fillStyle = '#6b9a58';
    ctx.beginPath(); ctx.ellipse(4, -9, 3.5, 1.6, -0.45, 0, Math.PI * 2); ctx.fill();
  } else if (particle.kind === 'banana') {
    ctx.fillStyle = '#f5d470';
    ctx.strokeStyle = '#a7763f';
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.bezierCurveTo(-5, 4, 1, 9, 9, 3);
    ctx.bezierCurveTo(4, 10, -5, 6, -8, -6);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-10, -8); ctx.moveTo(9, 3); ctx.lineTo(10, 1); ctx.stroke();
  } else {
    ctx.fillStyle = '#a5c977';
    ctx.strokeStyle = '#4c7d56';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.bezierCurveTo(-5, -4, -5, 3, 0, 7);
    ctx.moveTo(-7, -2); ctx.bezierCurveTo(-2, -4, 3, -4, 7, -1);
    ctx.moveTo(-6, 4); ctx.bezierCurveTo(-1, 1, 3, 1, 6, 4);
    ctx.stroke();
  }

  ctx.restore();
}

export function mountPointerEffects(document: Document, window: Window): () => void {
  const canvas = document.querySelector<HTMLCanvasElement>('[data-pointer-effects]');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return () => {};

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fruits: FruitParticle[] = [];
  const trail: TrailParticle[] = [];
  let frame = 0;
  let previousTime = 0;
  let previousPointer: { x: number; y: number } | undefined;
  let width = 0;
  let height = 0;

  const resize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const render = (time: number) => {
    const step = Math.min((time - (previousTime || time)) / 16.67, 2);
    previousTime = time;
    ctx.clearRect(0, 0, width, height);

    for (let index = trail.length - 1; index >= 0; index -= 1) {
      const particle = trail[index];
      particle.life -= 0.028 * step;
      if (particle.life <= 0) { trail.splice(index, 1); continue; }
      ctx.globalAlpha = particle.life * 0.9;
      ctx.fillStyle = particle.color;
      ctx.shadowColor = particle.color;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 3.6 * particle.life + 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    for (let index = fruits.length - 1; index >= 0; index -= 1) {
      const particle = fruits[index];
      particle.x += particle.vx * step;
      particle.y += particle.vy * step;
      particle.vy += 0.14 * step;
      particle.angle += particle.spin * step;
      particle.life -= 0.015 * step;
      if (particle.life <= 0) { fruits.splice(index, 1); continue; }
      drawFruit(ctx, particle);
    }

    frame = trail.length || fruits.length ? window.requestAnimationFrame(render) : 0;
    if (!frame) previousTime = 0;
  };

  const start = () => { if (!frame) frame = window.requestAnimationFrame(render); };

  const onMove = (event: PointerEvent) => {
    if (reducedMotion.matches || event.pointerType !== 'mouse') return;
    const distance = previousPointer ? Math.hypot(event.clientX - previousPointer.x, event.clientY - previousPointer.y) : 20;
    if (distance < 7) return;
    const normalX = previousPointer ? -(event.clientY - previousPointer.y) / distance : 0;
    const normalY = previousPointer ? (event.clientX - previousPointer.x) / distance : 1;
    rainbowColors.forEach((color, index) => {
      const offset = (index - (rainbowColors.length - 1) / 2) * 3.2;
      trail.push({ x: event.clientX + normalX * offset, y: event.clientY + normalY * offset, color, life: 1 });
    });
    if (trail.length > 180) trail.splice(0, trail.length - 180);
    previousPointer = { x: event.clientX, y: event.clientY };
    start();
  };

  const onDown = (event: PointerEvent) => {
    if (reducedMotion.matches || event.pointerType !== 'mouse') return;
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2 + Math.random() * 0.25;
      const speed = 1.8 + Math.random() * 2.5;
      fruits.push({
        kind: fruitKinds[Math.floor(Math.random() * fruitKinds.length)],
        x: event.clientX,
        y: event.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        size: 14 + Math.random() * 9,
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.09,
        life: 1,
      });
    }
    if (fruits.length > 48) fruits.splice(0, fruits.length - 48);
    start();
  };

  const onMotionChange = () => {
    if (!reducedMotion.matches) return;
    trail.length = 0;
    fruits.length = 0;
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    ctx.clearRect(0, 0, width, height);
  };

  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  reducedMotion.addEventListener('change', onMotionChange);

  return () => {
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerdown', onDown);
    reducedMotion.removeEventListener('change', onMotionChange);
    if (frame) window.cancelAnimationFrame(frame);
    ctx.clearRect(0, 0, width, height);
  };
}
