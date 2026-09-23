import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://bigbrotherwei.github.io',
  integrations: [
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
