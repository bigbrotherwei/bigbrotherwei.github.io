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
  button.addEventListener('click', () => {
    if (loading || button.hidden) return;
    loading = true;
    button.disabled = true;
    status.textContent = '评论加载中…';
    fallback.hidden = true;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    for (const [name, value] of attributes) script.setAttribute(name, value!);
    script.addEventListener('load', () => {
      status.textContent = '评论组件已连接，内容可能仍在加载。';
      button.hidden = true;
    });
    script.addEventListener('error', () => {
      script.remove();
      loading = false;
      button.disabled = false;
      button.textContent = '重试加载评论';
      status.textContent = '评论加载失败，请重试或前往 GitHub Discussions。';
      fallback.hidden = false;
    });
    embed.appendChild(script);
  });
}
