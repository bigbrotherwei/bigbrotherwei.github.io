export const mountArticleMedia = (
  document: Document,
  window: Window,
  clipboard: { writeText(text: string): Promise<void> } | undefined = window.navigator.clipboard,
): void => {
  const body = document.querySelector<HTMLElement>('[data-article-body]');
  const dialog = document.querySelector<HTMLDialogElement>('[data-article-image-dialog]');
  const dialogImage = dialog?.querySelector<HTMLImageElement>('[data-dialog-image]');
  const close = dialog?.querySelector<HTMLButtonElement>('[data-image-close]');
  const status = document.querySelector<HTMLElement>('[data-article-media-status]');
  if (!body || !status) return;

  for (const pre of body.querySelectorAll<HTMLPreElement>('pre')) {
    const code = pre.querySelector('code');
    if (!code) continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'article-code-copy';
    button.textContent = '复制代码';
    button.setAttribute('aria-label', '复制代码');
    button.addEventListener('click', async () => {
      if (!clipboard) {
        status.textContent = '当前浏览器不支持复制，请手动选择代码。';
        return;
      }
      try {
        await clipboard.writeText(code.textContent ?? '');
        status.textContent = '代码已复制。';
      } catch {
        status.textContent = '无法复制代码，请手动选择。';
      }
    });
    pre.prepend(button);
  }

  if (!dialog || !dialogImage || !close || typeof dialog.showModal !== 'function') return;
  let opener: HTMLElement | null = null;
  const openImage = (image: HTMLImageElement, trigger: HTMLElement) => {
    opener = trigger;
    dialogImage.src = image.currentSrc || image.src;
    dialogImage.alt = image.alt;
    dialog.showModal();
    close.focus();
  };

  for (const image of body.querySelectorAll<HTMLImageElement>('img')) {
    const link = image.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        openImage(image, link);
      });
    } else {
      image.tabIndex = 0;
      image.setAttribute('role', 'button');
      image.setAttribute('aria-label', `放大图片：${image.alt || '文章图片'}`);
      image.addEventListener('click', () => openImage(image, image));
      image.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        openImage(image, image);
      });
    }
  }

  close.addEventListener('click', () => dialog.close());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && dialog.open) {
      event.preventDefault();
      dialog.close();
    }
  });
  dialog.addEventListener('close', () => opener?.focus());
  dialogImage.addEventListener('error', () => {
    status.textContent = '图片无法加载，可从正文中的原图链接重试。';
    if (dialog.open) dialog.close();
  });
};
