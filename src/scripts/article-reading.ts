import { calculateReadingProgress, findActiveHeadingId } from '../lib/reading';

export const mountArticleReading = (document: Document, window: Window): void => {
  const body = document.querySelector<HTMLElement>('[data-article-body]');
  const progress = document.querySelector<HTMLProgressElement>('[data-reading-progress]');
  const backToTop = document.querySelector<HTMLButtonElement>('[data-back-to-top]');
  if (!body || !progress || !backToTop) return;

  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-article-toc-link]')];
  const nav = document.querySelector<HTMLElement>('.site-nav');
  const headings = links.flatMap((link) => {
    const id = link.dataset.headingId;
    const element = id ? document.getElementById(id) : null;
    return element && id ? [{ id, element, link }] : [];
  });

  let navOffset = 0;
  const update = (): void => {
    const nextNavOffset = Math.ceil((nav?.getBoundingClientRect().height ?? 96) + 16);
    if (nextNavOffset !== navOffset) {
      document.documentElement.style.setProperty('--article-nav-offset', `${nextNavOffset}px`);
      navOffset = nextNavOffset;
    }

    const bounds = body.getBoundingClientRect();
    const start = bounds.top + window.scrollY;
    const end = bounds.bottom + window.scrollY;
    const marker = window.scrollY + window.innerHeight / 2;
    progress.value = calculateReadingProgress(start, end, marker);

    const activeId = findActiveHeadingId(
      headings.map(({ id, element }) => ({ id, top: element.getBoundingClientRect().top })),
      navOffset + 8,
    );
    for (const heading of headings) {
      if (heading.id === activeId) heading.link.setAttribute('aria-current', 'location');
      else heading.link.removeAttribute('aria-current');
    }

    backToTop.hidden = window.scrollY < 360;
  };

  let framePending = false;
  const schedule = (): void => {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(() => {
      framePending = false;
      update();
    });
  };

  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  window.addEventListener('load', schedule);
  if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(body);

  backToTop.addEventListener('click', () => {
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  });

  schedule();
};
