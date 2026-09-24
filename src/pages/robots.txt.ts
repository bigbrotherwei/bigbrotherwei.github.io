import type { APIRoute } from 'astro';

export const GET: APIRoute = (context) => new Response([
  'User-agent: *',
  'Allow: /',
  `Sitemap: ${new URL('/sitemap-index.xml', context.site!).href}`,
  '',
].join('\n'), {
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
  },
});
