import { relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

const publicRoot = resolve('public');

export const lazyArticleImages = {
  name: 'lazy-article-images',
  element: {
    filter: ['img'],
    async visit(node, ctx) {
      const props = node.properties ?? {};
      if (props.loading == null) ctx.setProperty(node, 'loading', 'lazy');
      if (props.decoding == null) ctx.setProperty(node, 'decoding', 'async');

      const src = props.src;
      if (typeof src !== 'string' || !src.startsWith('/images/posts/')) return;

      const pathname = decodeURIComponent(new URL(src, 'https://blog.local').pathname);
      const file = resolve(publicRoot, pathname.slice(1));
      const relativePath = relative(publicRoot, file);
      if (relativePath === '..' || relativePath.startsWith(`..${sep}`)) return;

      const { width, height } = await sharp(file).metadata();
      if (width && height) {
        if (props.width == null) ctx.setProperty(node, 'width', width);
        if (props.height == null) ctx.setProperty(node, 'height', height);
      }
    },
  },
};
