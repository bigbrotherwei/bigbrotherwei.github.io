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
  const label = button?.querySelector<HTMLElement>('[data-comment-label]');
  const status = document.querySelector<HTMLElement>('[data-comment-status]');
  const fallback = document.querySelector<HTMLAnchorElement>('[data-comment-fallback]');
  const embed = document.querySelector<HTMLElement>('[data-comment-embed]');
  if (!section || !button || !label || !status || !fallback || !embed) return;

  const attributes = giscusAttributes.map((name) => [name, section.getAttribute(name)] as const);
  if (attributes.some(([, value]) => !value)) return;

  let visible = false;
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
    visible = false;
    button.disabled = false;
    button.hidden = false;
    button.setAttribute('aria-expanded', 'false');
    label.textContent = '重试加载评论';
    status.textContent = '评论加载失败，请重试或前往 GitHub Discussions。';
    fallback.hidden = false;
  };

  document.defaultView?.addEventListener('message', (event: MessageEvent) => {
    if (event.origin !== 'https://giscus.app') return;
    if (event.source !== embed.querySelector('iframe')?.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object' || !data.giscus || typeof data.giscus !== 'object') return;
    if (typeof data.giscus.error === 'string' && data.giscus.error.trim().replace(/\.$/, '') !== 'Discussion not found') {
      showFailure();
    }
  });

  document.addEventListener('themechange', (event) => {
    const theme = (event as CustomEvent<{ theme?: unknown }>).detail?.theme;
    if (theme !== 'light' && theme !== 'dark') return;
    currentScript?.setAttribute('data-theme', theme);
    if (readyFrame && readyFrame === embed.querySelector('iframe')) sendTheme(readyFrame, theme);
  });

  embed.addEventListener('load', (event) => {
    const frame = embed.querySelector<HTMLIFrameElement>('iframe');
    if (!currentScript || !frame || event.target !== frame) return;
    readyFrame = frame;
    sendTheme(frame, effectiveTheme());
  }, true);

  const loadComments = () => {
    const currentAttempt = ++attempt;
    visible = true;
    button.disabled = false;
    button.setAttribute('aria-expanded', 'true');
    label.textContent = '隐藏评论';
    status.textContent = '评论加载中…';
    fallback.hidden = true;
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
      status.textContent = '';
    });
    script.addEventListener('error', () => {
      if (currentAttempt === attempt) showFailure();
    });
    embed.appendChild(script);
  };

  button.addEventListener('click', () => {
    if (!visible) {
      loadComments();
      return;
    }
    attempt += 1;
    visible = false;
    currentScript = undefined;
    readyFrame = null;
    embed.replaceChildren();
    label.textContent = '显示评论';
    button.setAttribute('aria-expanded', 'false');
    status.textContent = '评论已隐藏';
    fallback.hidden = true;
  });

  loadComments();
}
