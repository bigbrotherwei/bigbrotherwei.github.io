export interface ReadingHeading {
  id: string;
  top: number;
}

export const calculateReadingProgress = (start: number, end: number, marker: number): number => {
  if (end <= start) return marker >= start ? 100 : 0;
  return Math.round(Math.max(0, Math.min(1, (marker - start) / (end - start))) * 100);
};

export const findActiveHeadingId = (headings: readonly ReadingHeading[], cutoff: number): string | null => {
  let activeId = headings[0]?.id ?? null;
  for (const heading of headings) {
    if (heading.top <= cutoff) activeId = heading.id;
  }
  return activeId;
};
