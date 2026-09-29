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
  });
}
