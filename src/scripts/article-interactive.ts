export function mountArticleInteractive(document: Document, window: Window) {
  const frames = [...document.querySelectorAll<HTMLIFrameElement>('.article-interactive iframe[data-auto-height]')];
  if (frames.length === 0) return;

  window.addEventListener('message', (event) => {
    const frame = frames.find((candidate) => candidate.contentWindow === event.source);
    if (!frame || (event.origin !== 'null' && event.origin !== window.location.origin)) return;
    if (event.data?.type !== 'foundationdb-architecture-height' && event.data?.type !== 'article-interactive-height') return;
    const height = event.data.height;
    if (!Number.isFinite(height) || height < 320 || height > 3000) return;
    frame.style.height = `${Math.ceil(height) + 2}px`;
  });
}
