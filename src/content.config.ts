import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const articles = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/articles' }),
  schema: z.object({
    title: z.string().default('Sem Título'),
    date: z.coerce.date().default(() => new Date()),
    author: z.string().nullable().optional().default('Tertúlias Não Mónó'),
    image: z.string().nullable().optional().default(''),
  }),
});

const events = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/events' }),
  schema: z.object({
    title: z.string().default('Sem Título'),
    eventDate: z.coerce.date().default(() => new Date()),
    location: z.string().default('A anunciar'),
  }),
});

const professionals = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/professionals' }),
  schema: z.object({
    title: z.string().default('Sem Título'),
    role: z.string().default('Profissional'),
    contact: z.string().nullable().optional().default('N/A'),
    image: z.string().nullable().optional().default(''),
  }),
});

export const collections = { articles, events, professionals };