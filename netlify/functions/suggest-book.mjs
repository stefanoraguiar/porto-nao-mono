/**
 * Creates a pending book markdown file via the GitHub Contents API
 * and notifies webmasters.
 */

import {
  createGithubFile,
  escapeYaml,
  getWebmasterEmails,
  json,
  notifyWebmasters,
  slugify,
} from './_shared.mjs';

const ALLOWED_TAGS = new Set(['Acesso livre', 'Comercial']);

function buildMarkdown({
  title,
  link,
  description,
  tags,
  suggestedBy,
  suggestedEmail,
}) {
  const tagsBlock =
    Array.isArray(tags) && tags.length > 0
      ? `tags:\n${tags.map((t) => `  - ${escapeYaml(String(t).trim())}`).join('\n')}`
      : 'tags: []';

  return `---
title: ${escapeYaml(title)}
image: ""
link: ${escapeYaml(link || '')}
description: ${escapeYaml(description || '')}
${tagsBlock}
approved: false
suggestedBy: ${escapeYaml(suggestedBy || '')}
suggestedEmail: ${escapeYaml(suggestedEmail || '')}
---
`;
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }

  if (data.website_url) {
    return json(200, { ok: true });
  }

  const title = String(data.title || '').trim();
  const link = String(data.link || '').trim();
  const description = String(data.description || '')
    .trim()
    .replace(/\s+/g, ' ');
  const suggestedBy = String(data.suggestedBy || '').trim();
  const suggestedEmail = String(data.suggestedEmail || '').trim();
  const tagsRaw = data.tags;
  const tags = (
    Array.isArray(tagsRaw)
      ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
      : String(tagsRaw || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
  ).filter((t) => ALLOWED_TAGS.has(t));

  if (!title || !suggestedBy || !suggestedEmail) {
    return json(400, { error: 'Missing required fields' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = `sugestao-${stamp}-${slugify(title) || 'livro'}`;
  const path = `src/content/books/${slug}.md`;
  const markdown = buildMarkdown({
    title,
    link,
    description,
    tags,
    suggestedBy,
    suggestedEmail,
  });

  const created = await createGithubFile({
    path,
    markdown,
    message: `Sugestão de livro (pendente): ${title}`,
    userAgent: 'porto-nao-mono-suggest-book',
  });

  if (!created.ok) {
    return json(created.status || 502, {
      error: created.error,
      fallback: created.fallback,
      detail: created.detail,
      webmasters: getWebmasterEmails(),
    });
  }

  const notify = await notifyWebmasters({
    subject: `[PNM] Nova sugestão de livro: ${title}`,
    text: [
      'Nova sugestão de livro pendente de aprovação.',
      '',
      `Título: ${title}`,
      `Link: ${link || '—'}`,
      `Etiquetas: ${tags.join(', ') || '—'}`,
      `Sugerido por: ${suggestedBy} <${suggestedEmail}>`,
      '',
      description ? `Descrição:\n${description}` : '',
      '',
      'Aprova em /admin/ → Biblioteca Pendente.',
      `Ficheiro: ${path}`,
    ]
      .filter(Boolean)
      .join('\n'),
  });

  return json(200, {
    ok: true,
    path,
    slug,
    notified: notify.sent,
    webmasters: getWebmasterEmails(),
  });
}
