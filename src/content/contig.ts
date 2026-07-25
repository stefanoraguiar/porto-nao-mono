import { defineCollection, z } from 'astro:content';

const articles = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string(),
  }),
});

const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    location: z.string(),
  }),
});

const professionals = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    role: z.string(),
    contact: z.string(),
  }),
});

export const collections = { articles, events, professionals };