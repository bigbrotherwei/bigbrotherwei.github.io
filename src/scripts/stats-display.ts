export async function mountStatsDisplay(root: HTMLElement, window: Window, apiUrl: string): Promise<void> {
  const values = [...root.querySelectorAll<HTMLElement>('[data-stat-key]')];
  const unavailable = (): void => {
    for (const value of values) value.textContent = '暂不可用';
    root.dataset.state = 'unavailable';
  };

  try {
    if (!apiUrl?.trim() || !root.dataset.statsPath || values.length === 0) return unavailable();
    const base = new URL(apiUrl.endsWith('/') ? apiUrl : `${apiUrl}/`);
    if (!['http:', 'https:'].includes(base.protocol)) return unavailable();
    const url = new URL('stats', base);
    url.searchParams.set('path', root.dataset.statsPath);
    const response = await window.fetch(url.href);
    if (!response.ok) return unavailable();
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return unavailable();
    const record = data as Record<string, unknown>;
    if (values.some(({ dataset }) => {
      const count = record[dataset.statKey ?? ''];
      return !Number.isSafeInteger(count) || (count as number) < 0;
    })) return unavailable();
    for (const value of values) value.textContent = String(record[value.dataset.statKey!]);
    root.dataset.state = 'ready';
  } catch {
    unavailable();
  }
}
