/**
 * Creates a pending event markdown file via the GitHub Contents API
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

function buildMarkdown({
  title,
  eventDate,
  location,
  description,
  external,
  suggestedBy,
  suggestedEmail,
}) {
  const dateIso = new Date(eventDate).toISOString();
  const body = (description || '').trim();
  return `---
title: ${escapeYaml(title)}
eventDate: ${dateIso}
location: ${escapeYaml(location || 'A anunciar')}
tags: []
photosUrl: ""
external: ${external ? 'true' : 'false'}
approved: false
suggestedBy: ${escapeYaml(suggestedBy || '')}
suggestedEmail: ${escapeYaml(suggestedEmail || '')}
---

${body}
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
  const eventDate = String(data.eventDate || '').trim();
  const location = String(data.location || '').trim();
  const description = String(data.description || '').trim();
  const suggestedBy = String(data.suggestedBy || '').trim();
  const suggestedEmail = String(data.suggestedEmail || '').trim();
  const external = Boolean(data.external);

  if (!title || !eventDate || !suggestedBy || !suggestedEmail) {
    return json(400, { error: 'Missing required fields' });
  }

  if (Number.isNaN(new Date(eventDate).getTime())) {
    return json(400, { error: 'Invalid event date' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = `sugestao-${stamp}-${slugify(title) || 'evento'}`;
  const path = `src/content/events/${slug}.md`;
  const markdown = buildMarkdown({
    title,
    eventDate,
    location,
    description,
    external,
    suggestedBy,
    suggestedEmail,
  });

  const created = await createGithubFile({
    path,
    markdown,
    message: `Sugestão de evento (pendente): ${title}`,
    userAgent: 'porto-nao-mono-suggest-event',
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
    subject: `[PNM] Nova sugestão de evento: ${title}`,
    text: [
      'Nova sugestão de evento pendente de aprovação.',
      '',
      `Título: ${title}`,
      `Data: ${eventDate}`,
      `Local: ${location || 'A anunciar'}`,
      `Externo: ${external ? 'sim' : 'não'}`,
      `Sugerido por: ${suggestedBy} <${suggestedEmail}>`,
      '',
      description ? `Descrição:\n${description}` : '',
      '',
      'Aprova em /admin/ → Eventos Pendentes.',
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
