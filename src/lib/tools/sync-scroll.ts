interface SyncScrollElements {
  source: HTMLElement;
  preview: HTMLElement;
  enabled: () => boolean;
}

export const createSyncScroll = ({ source, preview, enabled }: SyncScrollElements) => {
  let lastDriver: 'source' | 'preview' = 'source';
  let pendingSource: number | null = null;
  let pendingPreview: number | null = null;

  const mapPosition = (from: HTMLElement, to: HTMLElement): number => {
    const fromRange = Math.max(0, from.scrollHeight - from.clientHeight);
    const toRange = Math.max(0, to.scrollHeight - to.clientHeight);
    if (!fromRange || !toRange) return 0;
    const progress = Math.max(0, Math.min(1, from.scrollTop / fromRange));
    return progress * toRange;
  };

  const sync = (from: HTMLElement, to: HTMLElement, driver: 'source' | 'preview') => {
    if (!enabled()) return;
    const target = mapPosition(from, to);
    if (driver === 'source') pendingPreview = target;
    else pendingSource = target;
    to.scrollTop = target;
  };

  const onSourceScroll = () => {
    if (pendingSource !== null && Math.abs(source.scrollTop - pendingSource) <= 1) {
      pendingSource = null;
      return;
    }
    pendingSource = null;
    lastDriver = 'source';
    sync(source, preview, lastDriver);
  };

  const onPreviewScroll = () => {
    if (pendingPreview !== null && Math.abs(preview.scrollTop - pendingPreview) <= 1) {
      pendingPreview = null;
      return;
    }
    pendingPreview = null;
    lastDriver = 'preview';
    sync(preview, source, lastDriver);
  };

  source.addEventListener('scroll', onSourceScroll, { passive: true });
  preview.addEventListener('scroll', onPreviewScroll, { passive: true });

  return {
    onSourceScroll,
    onPreviewScroll,
    refresh: () => {
      if (lastDriver === 'source') sync(source, preview, lastDriver);
      else sync(preview, source, lastDriver);
    },
    dispose: () => {
      source.removeEventListener('scroll', onSourceScroll);
      preview.removeEventListener('scroll', onPreviewScroll);
    },
  };
};
