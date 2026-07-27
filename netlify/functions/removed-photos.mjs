/**
 * GET  /.netlify/functions/removed-photos  → live list of hidden gallery URLs
 * POST /.netlify/functions/removed-photos  → add a URL to the shared removal list
 */

import { addRemovedPhoto, getRemovedPhotos, json, notifyWebmasters } from './_shared.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod === 'GET') {
    const list = await getRemovedPhotos();
    // Prefer live GitHub list; if token missing, return empty (client may use build-time list)
    return json(200, {
      urls: list.urls || [],
      source: list.ok ? 'github' : 'unavailable',
      error: list.ok ? undefined : list.error,
    });
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

  const url = String(data.photoUrl || data.url || '').trim();
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim();
  const reason = String(data.reason || '').trim();
  const albumTitle = String(data.albumTitle || '').trim();

  if (!url || !name || !email || !reason) {
    return json(400, { error: 'Missing required fields' });
  }

  const saved = await addRemovedPhoto({ url, name, email, reason, albumTitle });
  if (!saved.ok) {
    return json(saved.status || 502, { error: saved.error || 'Failed to persist removal' });
  }

  await notifyWebmasters({
    subject: `[PNM] Pedido de remoção de fotografia`,
    text: [
      'Pedido de remoção de fotografia na galeria.',
      '',
      `Álbum: ${albumTitle || '—'}`,
      `URL: ${url}`,
      `Nome: ${name}`,
      `E-mail: ${email}`,
      `Motivo: ${reason}`,
      '',
      'A fotografia foi adicionada à lista de ocultação partilhada (removed-photos.json).',
      'Podes apagar o ficheiro do repositório quando conveniente.',
    ].join('\n'),
  });

  return json(200, { ok: true, urls: saved.urls });
}
