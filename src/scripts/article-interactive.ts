export function mountArticleInteractive(document: Document, window: Window) {
  const frame = document.querySelector<HTMLIFrameElement>('.article-interactive iframe[data-auto-height]');
  if (!frame) return;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    if (event.data?.type !== 'foundationdb-architecture-height') return;
    const height = event.data.height;
    if (!Number.isFinite(height) || height < 320 || height > 3000) return;
    frame.style.height = `${Math.ceil(height) + 2}px`;
  });
}
