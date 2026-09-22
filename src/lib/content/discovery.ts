export interface PostLike {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly pubDate: Date;
    readonly tags: readonly string[];
    readonly topic: string;
    readonly draft: boolean;
  };
}

export interface ArchiveMonth<T extends PostLike = PostLike> {
  readonly month: number;
  readonly posts: readonly T[];
}

export interface ArchiveGroup<T extends PostLike = PostLike> {
  readonly year: number;
  readonly months: readonly ArchiveMonth<T>[];
}

export interface TagIndexEntry<T extends PostLike = PostLike> {
  readonly label: string;
  readonly slug: string;
  readonly count: number;
  readonly posts: readonly T[];
}

export interface AdjacentPosts<T extends PostLike = PostLike> {
  readonly older: T | undefined;
  readonly newer: T | undefined;
}

const freezeArray = <T>(items: T[]): readonly T[] => Object.freeze(items.slice());

const compareIds = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const compareLabels = (left: string, right: string) => {
  if (left === right) {
    return 0;
  }

  return left < right ? -1 : 1;
};

const comparePostsByDate = <T extends PostLike>(left: T, right: T) => {
  const dateDifference = right.data.pubDate.getTime() - left.data.pubDate.getTime();
  return dateDifference || compareIds(left.id, right.id);
};

const isPublished = <T extends PostLike>(post: T) => !post.data.draft;

export const sortPostsByDate = <T extends PostLike>(posts: readonly T[]): readonly T[] =>
  freezeArray(posts.filter(isPublished).sort(comparePostsByDate));

export const buildArchiveGroups = <T extends PostLike>(posts: readonly T[]): readonly ArchiveGroup<T>[] => {
  const groups = new Map<number, Map<number, T[]>>();

  for (const post of sortPostsByDate(posts)) {
    const year = post.data.pubDate.getUTCFullYear();
    const month = post.data.pubDate.getUTCMonth() + 1;
    const months = groups.get(year) ?? new Map<number, T[]>();
    const monthPosts = months.get(month) ?? [];
    monthPosts.push(post);
    months.set(month, monthPosts);
    groups.set(year, months);
  }

  const archiveGroups = [...groups.entries()]
    .sort(([leftYear], [rightYear]) => rightYear - leftYear)
    .map(([year, months]) => Object.freeze({
      year,
      months: freezeArray([...months.entries()]
        .sort(([leftMonth], [rightMonth]) => rightMonth - leftMonth)
        .map(([month, monthPosts]) => Object.freeze({
          month,
          posts: freezeArray(monthPosts),
        }))),
    }));

  return freezeArray(archiveGroups);
};

export const toTagSlug = (label: string): string => {
  const normalized = label.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, '-');
  return Array.from(normalized)
    .filter((character) => /[\p{Letter}\p{Number}\p{Script=Han}-]/u.test(character))
    .join('');
};

export const buildTagIndex = <T extends PostLike>(posts: readonly T[]): readonly TagIndexEntry<T>[] => {
  const entries = new Map<string, { label: string; posts: T[] }>();

  for (const post of sortPostsByDate(posts)) {
    const seenSlugs = new Set<string>();

    for (const label of post.data.tags) {
      const slug = toTagSlug(label);
      if (!slug) {
        throw new Error(`标签 slug 为空：${JSON.stringify(label)}`);
      }

      const existing = entries.get(slug);
      if (existing && existing.label !== label) {
        throw new Error(`标签 slug 冲突：${JSON.stringify(existing.label)} 与 ${JSON.stringify(label)} -> ${slug}`);
      }

      if (!existing) {
        entries.set(slug, { label, posts: [] });
      }

      if (!seenSlugs.has(slug)) {
        entries.get(slug)?.posts.push(post);
        seenSlugs.add(slug);
      }
    }
  }

  const tagEntries = [...entries.entries()]
    .map(([slug, entry]) => Object.freeze({
      label: entry.label,
      slug,
      count: entry.posts.length,
      posts: freezeArray(entry.posts),
    }))
    .sort((left, right) => right.count - left.count || compareLabels(left.label, right.label));

  return freezeArray(tagEntries);
};

export const findAdjacentPosts = <T extends PostLike>(posts: readonly T[], currentId: string): AdjacentPosts<T> => {
  const publishedPosts = sortPostsByDate(posts);
  const currentIndex = publishedPosts.findIndex((post) => post.id === currentId);

  return Object.freeze({
    older: currentIndex >= 0 ? publishedPosts[currentIndex + 1] : undefined,
    newer: currentIndex > 0 ? publishedPosts[currentIndex - 1] : undefined,
  });
};

export const findRelatedPosts = <T extends PostLike>(posts: readonly T[], current: T): readonly T[] => {
  const currentTags = new Set(current.data.tags);
  const candidates = sortPostsByDate(posts)
    .filter((post) => post.id !== current.id)
    .map((post) => {
      const candidateTags = new Set(post.data.tags);
      const sharedTags = [...currentTags].filter((tag) => candidateTags.has(tag)).length;
      const score = (post.data.topic === current.data.topic ? 100 : 0) + sharedTags * 10;
      return { post, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || comparePostsByDate(left.post, right.post))
    .slice(0, 3)
    .map(({ post }) => post);

  return freezeArray(candidates);
};
