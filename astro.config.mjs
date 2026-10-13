import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import sitemap from '@astrojs/sitemap';
import { lazyArticleImages } from './scripts/lazy-article-images.mjs';

export default defineConfig({
  site: 'https://bigbrotherwei.github.io',
  markdown: {
    processor: satteri({ hastPlugins: [lazyArticleImages] }),
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => page !== 'https://bigbrotherwei.github.io/search/',
      namespaces: {
        news: false,
        video: false,
        xhtml: false,
        image: false,
      },
    }),
  ],
});
