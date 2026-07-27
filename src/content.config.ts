// File: src/content.config.ts
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
    tags: z.array(z.string()).optional().default([]),
    photosUrl: z.string().optional().default(''),
    external: z.boolean().optional().default(false),
    approved: z.boolean().optional().default(true),
    suggestedBy: z.string().optional().default(''),
    suggestedEmail: z.string().optional().default(''),
  }),
});

const professionals = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/professionals' }),
  schema: z.object({
    title: z.string().default('Sem Título'),
    role: z.string().default('Profissional'),
    areas: z.array(z.string()).optional().default([]),
    contact: z.string().nullable().optional().default(''),
    website: z.string().optional().default(''),
    location: z.string().optional().default(''),
    image: z.string().nullable().optional().default(''),
    community: z.boolean().optional().default(false),
    approved: z.boolean().optional().default(true),
    suggestedBy: z.string().optional().default(''),
    suggestedEmail: z.string().optional().default(''),
  }),
});

const galleries = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/galleries' }),
  schema: z.object({
    title: z.string(),
    eventDate: z.coerce.date(),
    location: z.string().optional().default('Porto'),
    folder: z.string().optional(),
    photos: z.array(
      z.union([
        z.string(),
        z.object({
          url: z.string(),
          caption: z.string().optional().default(''),
        })
      ])
    ).optional().default([]),
  }),
});

const books = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string().default('Sem Título'),
    image: z.string().optional().default(''),
    link: z.string().optional().default(''),
    description: z.string().default(''),
    tags: z.array(z.string()).optional().default([]),
    approved: z.boolean().optional().default(true),
    suggestedBy: z.string().optional().default(''),
    suggestedEmail: z.string().optional().default(''),
  }),
});

export const collections = { articles, events, professionals, galleries, books };