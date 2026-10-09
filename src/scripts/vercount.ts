const scriptUrl = 'https://events.vercount.one/js';
const countPattern = /^\d[\d,]*$/;

export function mountVercount(document: Document, window: Window): void {
  try { window.localStorage.removeItem('analytics-visitor-id'); } catch {}
  const roots = [...document.querySelectorAll<HTMLElement>('[data-vercount-stats]')];
  const values = roots.flatMap((root) => [...root.querySelectorAll<HTMLElement>('[data-vercount-value]')]);
  let observer: MutationObserver | undefined;
  let timeout: number | undefined;

  const ready = (): boolean => {
    if (values.length === 0 || !values.every((value) => countPattern.test(value.textContent?.trim() ?? ''))) return false;
    for (const root of roots) root.dataset.state = 'ready';
    observer?.disconnect();
    if (timeout !== undefined) window.clearTimeout(timeout);
    return true;
  };
  const unavailable = (): void => {
    if (ready()) return;
    observer?.disconnect();
    for (const root of roots) {
      for (const value of root.querySelectorAll<HTMLElement>('[data-vercount-value]')) {
        if (!countPattern.test(value.textContent?.trim() ?? '')) value.textContent = '暂不可用';
      }
      root.dataset.state = 'unavailable';
    }
  };

  if (values.length > 0) {
    const counterObserver = new (window as Window & typeof globalThis).MutationObserver(() => { ready(); });
    observer = counterObserver;
    for (const value of values) counterObserver.observe(value, { childList: true, characterData: true, subtree: true });
    timeout = window.setTimeout(unavailable, 10_000);
  }

  const script = document.createElement('script');
  script.src = scriptUrl;
  script.async = true;
  script.onerror = unavailable;
  document.body.appendChild(script);
}
