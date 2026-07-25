import { createClient } from '@sanity/client';
import { portableTextToMarkdown } from '@portabletext/markdown';
import fs from 'fs';
import path from 'path';

const client = createClient({
  projectId: 'zhr2ddpl',
  dataset: 'production',
  useCdn: false,
  apiVersion: '2024-01-01',
});

function slugify(text) {
  return (text || 'untitled')
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Convert Sanity image asset reference into direct CDN URL
function parseSanityImageUrl(imageObj) {
  if (!imageObj) return '';
  if (typeof imageObj === 'string' && imageObj.startsWith('http')) return imageObj;
  
  const ref = imageObj?.asset?._ref || imageObj?._ref;
  if (!ref) return '';
  
  // Sanity image ref format: "image-[id]-[dimensions]-[format]"
  const parts = ref.split('-');
  if (parts.length < 4 || parts[0] !== 'image') return '';
  
  const id = parts[1];
  const dimensions = parts[2];
  const format = parts[3];
  
  return `https://cdn.sanity.io/images/zhr2ddpl/production/${id}-${dimensions}.${format}`;
}

async function migrate() {
  console.log('Fetching documents from Sanity...');
  const allDocs = await client.fetch('*');
  const docs = allDocs.filter(
    (d) => d._type && !d._type.startsWith('sanity.') && !d._type.startsWith('system.')
  );

  let articleCount = 0;
  let proCount = 0;
  let eventCount = 0;

  for (const doc of docs) {
    const title = doc.title || doc.name || 'Sem Título';
    const slug = doc.slug?.current || slugify(title);
    
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
      
      // Extract image URL from common Sanity image field names
      const rawImage = doc.mainImage || doc.image || doc.coverImage || doc.featuredImage || doc.headerImage;
      const imageUrl = parseSanityImageUrl(rawImage);

      const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
date: ${new Date(date).toISOString()}
author: "${author.replace(/"/g, '\\"')}"
image: "${imageUrl}"
---

${bodyMarkdown}
`;
      const dir = path.join(process.cwd(), 'src/content/articles');
      ensureDirExists(dir);
      fs.writeFileSync(path.join(dir, `${slug}.md`), frontmatter);
      articleCount++;
    }

    // B. Handle Professionals
    if (['professional', 'person', 'profissional', 'author', 'membro', 'profissionais', 'member'].includes(type)) {
      const role = doc.role || doc.specialty || doc.cargo || 'Profissional';
      const contact = doc.contact || doc.email || doc.website || doc.link || 'N/A';
      const rawImage = doc.mainImage || doc.image || doc.photo || doc.avatar;
      const imageUrl = parseSanityImageUrl(rawImage);

      const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
role: "${role.replace(/"/g, '\\"')}"
contact: "${contact.replace(/"/g, '\\"')}"
image: "${imageUrl}"
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

  console.log(`\n🎉 Re-migration finished!`);
  console.log(`- ${articleCount} Articles re-imported into src/content/articles/`);
  console.log(`- ${proCount} Professionals re-imported into src/content/professionals/`);
  console.log(`- ${eventCount} Events re-imported into src/content/events/`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
});