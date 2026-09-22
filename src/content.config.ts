import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { backgroundKeys } from './data/backgrounds';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    topic: z.string(),
    order: z.number(),
    draft: z.boolean().default(false),
    background: z.enum(backgroundKeys),
  }),
});

const topics = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/topics' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['更新中', '计划中', '已完成']),
    order: z.number(),
    background: z.enum(backgroundKeys),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    status: z.enum(['维护中', '实验中', '已完成', '已归档']),
    startDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    order: z.number().int(),
    repository: z.string().url().optional(),
    website: z.string().url().optional(),
    background: z.enum(backgroundKeys),
  }),
});

export const collections = { posts, topics, projects };
