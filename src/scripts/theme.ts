import { parseThemePreference, resolveTheme, type ThemePreference } from '../lib/theme.ts';

const storageKey = 'blog-theme-preference';

export function mountTheme(document: Document, window: Window): void {
  const root = document.documentElement;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(storageKey);
  } catch {
    // Theme selection remains usable for this page when storage is blocked.
  }

  const initial = root.getAttribute('data-theme-preference');
  let preference: ThemePreference = parseThemePreference(
    initial === 'system' || initial === 'light' || initial === 'dark' ? initial : stored,
  );
  let media: MediaQueryList | undefined;
  try {
    media = window.matchMedia?.('(prefers-color-scheme: dark)');
  } catch {
    // Unsupported media queries default to light.
  }

  const update = (): void => {
    const theme = resolveTheme(preference, media?.matches ?? false);
    const changed = root.getAttribute('data-theme') !== theme;
    root.setAttribute('data-theme-preference', preference);
    root.setAttribute('data-theme', theme);
    if (changed) document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  };

  update();
  media?.addEventListener?.('change', update);
  document.addEventListener('themepreferencechange', (event) => {
    const value = (event as CustomEvent<{ preference?: unknown }>).detail?.preference;
    if (value !== 'system' && value !== 'light' && value !== 'dark') return;
    preference = value;
    try {
      window.localStorage.setItem(storageKey, preference);
    } catch {
      // The DOM still reflects the selected preference for this page.
    }
    update();
    syncChoices();
  });

  const toggle = document.querySelector?.<HTMLButtonElement>('[data-theme-toggle]');
  const menu = document.querySelector?.<HTMLElement>('[data-theme-menu]');
  const choices = Array.from(document.querySelectorAll?.<HTMLButtonElement>('[data-theme-choice]') ?? []);
  const syncChoices = (): void => {
    for (const choice of choices) {
      choice.setAttribute('aria-checked', String(choice.getAttribute('data-theme-choice') === preference));
    }
  };
  if (!toggle || !menu || choices.length === 0) return;
  syncChoices();

  const closeMenu = (restoreFocus = false): void => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  };
  toggle.addEventListener('click', () => {
    if (!menu.hidden) {
      closeMenu();
      return;
    }
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    (choices.find((choice) => choice.getAttribute('aria-checked') === 'true') ?? choices[0]).focus();
  });
  for (const choice of choices) {
    choice.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('themepreferencechange', {
        detail: { preference: choice.getAttribute('data-theme-choice') },
      }));
      closeMenu(true);
    });
  }
  document.addEventListener('keydown', (event) => {
    if (menu.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === 'Tab') {
      closeMenu();
      return;
    }
    const index = choices.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowDown': next = (index + 1) % choices.length; break;
      case 'ArrowUp': next = (index - 1 + choices.length) % choices.length; break;
      case 'Home': next = 0; break;
      case 'End': next = choices.length - 1; break;
      default: return;
    }
    event.preventDefault();
    choices[next].focus();
  });
  document.addEventListener('focusin', (event) => {
    if (!menu.hidden && event.target && !menu.contains(event.target as Node) && !toggle.contains(event.target as Node)) closeMenu();
  });
  document.addEventListener('click', (event) => {
    if (!menu.hidden && event.target && !menu.contains(event.target as Node) && !toggle.contains(event.target as Node)) closeMenu();
  });
}
