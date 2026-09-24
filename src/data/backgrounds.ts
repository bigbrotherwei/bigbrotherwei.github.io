export const backgroundKeys = [
  'home',
  'posts-index',
  'archive-index',
  'tags-index',
  'tag-detail',
  'topics-index',
  'tools-index',
  'projects-index',
  'search-index',
  'project-personal-blog',
  'about',
  'post-blog-rebuild-roadmap',
  'post-github-pages-workflow',
  'post-pixel-farm-background',
  'topic-blog-rebuild',
  'topic-developer-toolbox',
  'tool-json',
  'tool-base64',
  'tool-url',
  'tool-timestamp',
  'tool-uuid',
  'tool-text-counter',
] as const;

export type BackgroundKey = (typeof backgroundKeys)[number];

export interface PageBackground {
  desktop: string;
  mobile: string;
  position?: string;
  mobilePosition?: string;
}

export const pageBackgrounds: Record<BackgroundKey, PageBackground> = {
  home: {
    desktop: '/images/hand-painted-farm-dusk.webp',
    mobile: '/images/hand-painted-farm-dusk-mobile.webp',
  },
  'posts-index': {
    desktop: '/images/backgrounds/posts-reading-grove.webp',
    mobile: '/images/backgrounds/posts-reading-grove-mobile.webp',
  },
  'archive-index': {
    desktop: '/images/backgrounds/archive-index.webp',
    mobile: '/images/backgrounds/archive-index-mobile.webp',
  },
  'tags-index': {
    desktop: '/images/backgrounds/tags-index.webp',
    mobile: '/images/backgrounds/tags-index-mobile.webp',
  },
  'tag-detail': {
    desktop: '/images/backgrounds/tag-detail.webp',
    mobile: '/images/backgrounds/tag-detail-mobile.webp',
  },
  'topics-index': {
    desktop: '/images/backgrounds/topics-valley-crossroads.webp',
    mobile: '/images/backgrounds/topics-valley-crossroads-mobile.webp',
  },
  'tools-index': {
    desktop: '/images/backgrounds/tools-lantern-workshop.webp',
    mobile: '/images/backgrounds/tools-lantern-workshop-mobile.webp',
  },
  'projects-index': {
    desktop: '/images/backgrounds/projects-timber-yard.webp',
    mobile: '/images/backgrounds/projects-timber-yard-mobile.webp',
  },
  'search-index': {
    desktop: '/images/backgrounds/search-index.webp',
    mobile: '/images/backgrounds/search-index-mobile.webp',
    position: 'center',
    mobilePosition: 'center',
  },
  'project-personal-blog': {
    desktop: '/images/backgrounds/project-personal-blog.webp',
    mobile: '/images/backgrounds/project-personal-blog-mobile.webp',
  },
  about: {
    desktop: '/images/backgrounds/about-lakeside-garden.webp',
    mobile: '/images/backgrounds/about-lakeside-garden-mobile.webp',
  },
  'post-blog-rebuild-roadmap': {
    desktop: '/images/backgrounds/post-roadmap-trail.webp',
    mobile: '/images/backgrounds/post-roadmap-trail-mobile.webp',
  },
  'post-github-pages-workflow': {
    desktop: '/images/backgrounds/post-workflow-waystation.webp',
    mobile: '/images/backgrounds/post-workflow-waystation-mobile.webp',
  },
  'post-pixel-farm-background': {
    desktop: '/images/backgrounds/post-painter-overlook.webp',
    mobile: '/images/backgrounds/post-painter-overlook-mobile.webp',
  },
  'topic-blog-rebuild': {
    desktop: '/images/backgrounds/topic-renovated-homestead.webp',
    mobile: '/images/backgrounds/topic-renovated-homestead-mobile.webp',
  },
  'topic-developer-toolbox': {
    desktop: '/images/backgrounds/topic-inventor-workshop.webp',
    mobile: '/images/backgrounds/topic-inventor-workshop-mobile.webp',
  },
  'tool-json': {
    desktop: '/images/backgrounds/tool-json-archive.webp',
    mobile: '/images/backgrounds/tool-json-archive-mobile.webp',
    position: 'center',
    mobilePosition: 'center',
  },
  'tool-base64': {
    desktop: '/images/backgrounds/tool-base64-telegraph.webp',
    mobile: '/images/backgrounds/tool-base64-telegraph-mobile.webp',
    position: 'right center',
    mobilePosition: 'right center',
  },
  'tool-url': {
    desktop: '/images/backgrounds/tool-url-waystation.webp',
    mobile: '/images/backgrounds/tool-url-waystation-mobile.webp',
    position: 'left center',
    mobilePosition: 'left center',
  },
  'tool-timestamp': {
    desktop: '/images/backgrounds/tool-timestamp-clockshop.webp',
    mobile: '/images/backgrounds/tool-timestamp-clockshop-mobile.webp',
    position: 'right center',
    mobilePosition: 'right center',
  },
  'tool-uuid': {
    desktop: '/images/backgrounds/tool-uuid-greenhouse.webp',
    mobile: '/images/backgrounds/tool-uuid-greenhouse-mobile.webp',
    position: 'left center',
    mobilePosition: 'left center',
  },
  'tool-text-counter': {
    desktop: '/images/backgrounds/tool-text-scriptorium.webp',
    mobile: '/images/backgrounds/tool-text-scriptorium-mobile.webp',
    position: 'center',
    mobilePosition: 'right center',
  },
};
