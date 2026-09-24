import rss from '@astrojs/rss';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildRssItems } from '../lib/feed';

export const GET: APIRoute = async (context) => {
  const posts = await getCollection('posts');

  return rss({
    title: 'bigbrotherwei',
    description: 'bigbrotherwei 的技术文章、学习记录和阶段性思考。',
    site: context.site!,
    items: buildRssItems(posts),
    customData: '<language>zh-CN</language>',
  });
};
