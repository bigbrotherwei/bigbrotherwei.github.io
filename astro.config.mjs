import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bigbrotherwei.github.io',
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
