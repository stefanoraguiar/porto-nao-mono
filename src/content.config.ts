import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    location: z.string(),
  }),
});

const professionals = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/professionals' }),
  schema: z.object({
    title: z.string(),
    role: z.string(),
    contact: z.string(),
  }),
});

export const collections = { articles, events, professionals };