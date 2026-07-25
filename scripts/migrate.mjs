import { createClient } from '@sanity/client';
import { portableTextToMarkdown } from '@portabletext/markdown';
import fs from 'fs';
import path from 'path';

// Connect to Sanity
const client = createClient({
  projectId: 'zhr2ddpl',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-01-01',
});

// Helper function to create clean file slugs
function slugify(text) {
  return (text || 'untitled')
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

// Ensure directory exists
function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function migrate() {
  console.log('Fetching documents from Sanity...');
  
  // Fetch all documents and filter system types in JS
  const allDocs = await client.fetch('*');
  const docs = allDocs.filter(
    (d) => d._type && !d._type.startsWith('sanity.') && !d._type.startsWith('system.')
  );

  console.log(`Found ${docs.length} user documents in Sanity.`);

  // Print all document types found in Sanity
  const typeSummary = {};
  docs.forEach((d) => {
    typeSummary[d._type] = (typeSummary[d._type] || 0) + 1;
  });
  console.log('\n--- SANITY DOCUMENT TYPES FOUND ---');
  console.dir(typeSummary);
  console.log('-----------------------------------\n');

  let articleCount = 0;
  let proCount = 0;
  let eventCount = 0;

  for (const doc of docs) {
    const title = doc.title || doc.name || 'Sem Título';
    const slug = doc.slug?.current || slugify(title);
    
    // Convert portable text body to Markdown if present
    let bodyMarkdown = '';
    const rawBody = doc.body || doc.content || doc.bio || doc.description;
    if (Array.isArray(rawBody)) {
      try {
        bodyMarkdown = portableTextToMarkdown(rawBody);
      } catch (e) {
        bodyMarkdown = '';
      }
    } else if (typeof rawBody === 'string') {
      bodyMarkdown = rawBody;
    }

    const type = (doc._type || '').toLowerCase();

    // A. Handle Articles / Posts
    if (['post', 'article', 'artigo', 'tertulia', 'artigos', 'blogpost'].includes(type)) {
      const author = doc.authorName || doc.author || 'Tertúlias Não Mónó';
      const date = doc.publishedAt || doc.date || doc._createdAt || new Date().toISOString();

      const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${new Date(date).toISOString()}
author: "${author.replace(/"/g, '\\"')}"
---

${bodyMarkdown}
`;
      const dir = path.join(process.cwd(), 'src/content/articles');
      ensureDirExists(dir);
      fs.writeFileSync(path.join(dir, `${slug}.md`), frontmatter);
      articleCount++;
    }

    // B. Handle Professionals / Persons
    if (['professional', 'person', 'profissional', 'author', 'membro', 'profissionais', 'member'].includes(type)) {
      const role = doc.role || doc.specialty || doc.cargo || 'Profissional';
      const contact = doc.contact || doc.email || doc.website || doc.link || 'N/A';

      const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
role: "${role.replace(/"/g, '\\"')}"
contact: "${contact.replace(/"/g, '\\"')}"
---

${bodyMarkdown}
`;
      const dir = path.join(process.cwd(), 'src/content/professionals');
      ensureDirExists(dir);
      fs.writeFileSync(path.join(dir, `${slug}.md`), frontmatter);
      proCount++;
    }

    // C. Handle Events
    if (['event', 'evento', 'eventos', 'events'].includes(type)) {
      const location = doc.location || doc.place || doc.local || 'A anunciar';
      const eventDate = doc.eventDate || doc.date || doc.startDate || doc.dateTime || doc._createdAt || new Date().toISOString();

      const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
eventDate: ${new Date(eventDate).toISOString()}
location: "${location.replace(/"/g, '\\"')}"
---

${bodyMarkdown}
`;
      const dir = path.join(process.cwd(), 'src/content/events');
      ensureDirExists(dir);
      fs.writeFileSync(path.join(dir, `${slug}.md`), frontmatter);
      eventCount++;
    }
  }

  console.log(`\n🎉 Migration finished!`);
  console.log(`- ${articleCount} Articles imported into src/content/articles/`);
  console.log(`- ${proCount} Professionals imported into src/content/professionals/`);
  console.log(`- ${eventCount} Events imported into src/content/events/`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
});