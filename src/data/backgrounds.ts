export const backgroundKeys = [
  'home',
  'posts-index',
  'topics-index',
  'tools-index',
  'projects-index',
  'about',
  'post-blog-rebuild-roadmap',
  'post-github-pages-workflow',
  'post-pixel-farm-background',
  'topic-blog-rebuild',
  'topic-developer-toolbox',
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
};
