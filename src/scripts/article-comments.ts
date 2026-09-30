const giscusAttributes = [
  'data-repo',
  'data-repo-id',
  'data-category',
  'data-category-id',
  'data-mapping',
  'data-strict',
  'data-lang',
] as const;

export function mountArticleComments(document: Document): void {
  const section = document.querySelector<HTMLElement>('[data-article-comments]');
  const button = document.querySelector<HTMLButtonElement>('[data-comment-load]');
  const status = document.querySelector<HTMLElement>('[data-comment-status]');
  const fallback = document.querySelector<HTMLAnchorElement>('[data-comment-fallback]');
  const embed = document.querySelector<HTMLElement>('[data-comment-embed]');
  if (!section || !button || !status || !fallback || !embed) return;

  const attributes = giscusAttributes.map((name) => [name, section.getAttribute(name)] as const);
  if (attributes.some(([, value]) => !value)) return;

  let loading = false;
  let attempt = 0;
  let currentScript: HTMLScriptElement | undefined;
  let readyFrame: HTMLIFrameElement | null = null;
  const effectiveTheme = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const sendTheme = (frame: HTMLIFrameElement, theme: 'light' | 'dark') => {
    frame.contentWindow?.postMessage({ giscus: { setConfig: { theme } } }, 'https://giscus.app');
  };
  const showFailure = () => {
    attempt += 1;
    embed.replaceChildren();
    currentScript = undefined;
    readyFrame = null;
    loading = false;
    button.disabled = false;
    button.hidden = false;
    button.textContent = '重试加载评论';
    status.textContent = '评论加载失败，请重试或前往 GitHub Discussions。';
    fallback.hidden = false;
  };

  document.defaultView?.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== 'https://giscus.app') return;
    if (event.source !== embed.querySelector('iframe')?.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || !data.giscus || typeof data.giscus !== 'object') return;
    if (typeof data.giscus.error === 'string') showFailure();
  });

  document.addEventListener('themechange', (event) => {
    const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
    if (theme !== 'light' && theme !== 'dark') return;
    currentScript?.setAttribute('data-theme', theme);
    if (readyFrame && readyFrame === embed.querySelector('iframe')) sendTheme(readyFrame, theme);
  });

  embed.addEventListener('load', (event) => {
    const frame = embed.querySelector<HTMLIFrameElement>('iframe');
    if (!currentScript || !frame || event.target !== frame || readyFrame === frame) return;
    readyFrame = frame;
    sendTheme(frame, effectiveTheme());
  }, true);

  button.addEventListener('click', () => {
    if (loading) return;
    const currentAttempt = ++attempt;
    loading = true;
    button.disabled = true;
    status.textContent = '评论加载中…';
    fallback.hidden = false;
    embed.replaceChildren();
    readyFrame = null;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    for (const [name, value] of attributes) script.setAttribute(name, value!);
    script.setAttribute('data-theme', effectiveTheme());
    currentScript = script;
    script.addEventListener('load', () => {
      if (currentAttempt !== attempt) return;
      loading = false;
      button.disabled = false;
      button.textContent = '重试加载评论';
      status.textContent = '评论组件已加载；若评论未显示，可重试或前往 GitHub Discussions。';
    });
    script.addEventListener('error', () => {
      if (currentAttempt === attempt) showFailure();
    });
    embed.appendChild(script);
  });
}
