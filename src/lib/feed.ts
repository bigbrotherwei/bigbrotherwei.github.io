import type { RSSFeedItem } from '@astrojs/rss';

type RssPost = {
  readonly id: string;
  readonly data: {
    readonly title: string;
    readonly description: string;
    readonly pubDate: Date;
    readonly tags: readonly string[];
    readonly draft: boolean;
  };
};

export const buildRssItems = (posts: readonly RssPost[]): RSSFeedItem[] => posts
  .filter((post) => !post.data.draft)
  .sort((left, right) => right.data.pubDate.getTime() - left.data.pubDate.getTime())
  .map((post) => ({
    title: post.data.title,
    description: post.data.description,
    pubDate: post.data.pubDate,
    link: `/posts/${post.id}/`,
    categories: [...post.data.tags],
  }));
