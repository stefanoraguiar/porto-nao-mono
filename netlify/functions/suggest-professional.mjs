/**
 * Creates a pending professional markdown file via the GitHub Contents API
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
  role,
  areas,
  location,
  contact,
  website,
  community,
  bio,
  suggestedBy,
  suggestedEmail,
}) {
  const areasBlock =
    Array.isArray(areas) && areas.length > 0
      ? `areas:\n${areas.map((a) => `  - ${escapeYaml(String(a).trim())}`).join('\n')}`
      : 'areas: []';

  const body = (bio || '').trim();
  return `---
title: ${escapeYaml(title)}
role: ${escapeYaml(role || 'Profissional')}
${areasBlock}
location: ${escapeYaml(location || '')}
contact: ${escapeYaml(contact || '')}
website: ${escapeYaml(website || '')}
image: ""
community: ${community ? 'true' : 'false'}
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
  const role = String(data.role || '').trim();
  const location = String(data.location || '').trim();
  const contact = String(data.contact || '').trim();
  const website = String(data.website || '').trim();
  const bio = String(data.bio || data.description || '').trim();
  const suggestedBy = String(data.suggestedBy || '').trim();
  const suggestedEmail = String(data.suggestedEmail || '').trim();
  const community = Boolean(data.community);
  const areasRaw = data.areas;
  const areas = Array.isArray(areasRaw)
    ? areasRaw.map((a) => String(a).trim()).filter(Boolean)
    : String(areasRaw || '')
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

  if (!title || !role || !suggestedBy || !suggestedEmail) {
    return json(400, { error: 'Missing required fields' });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const slug = `sugestao-${stamp}-${slugify(title) || 'profissional'}`;
  const path = `src/content/professionals/${slug}.md`;
  const markdown = buildMarkdown({
    title,
    role,
    areas,
    location,
    contact,
    website,
    community,
    bio,
    suggestedBy,
    suggestedEmail,
  });

  const created = await createGithubFile({
    path,
    markdown,
    message: `Sugestão de profissional (pendente): ${title}`,
    userAgent: 'porto-nao-mono-suggest-professional',
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
    subject: `[PNM] Nova sugestão de profissional: ${title}`,
    text: [
      'Nova sugestão de profissional pendente de aprovação.',
      '',
      `Nome: ${title}`,
      `Especialidade: ${role}`,
      `Áreas: ${areas.join(', ') || '—'}`,
      `Local: ${location || '—'}`,
      `Contacto: ${contact || '—'}`,
      `Website: ${website || '—'}`,
      `Da comunidade: ${community ? 'sim' : 'não'}`,
      `Sugerido por: ${suggestedBy} <${suggestedEmail}>`,
      '',
      bio ? `Bio:\n${bio}` : '',
      '',
      'Aprova em /admin/ → Profissionais Pendentes.',
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
