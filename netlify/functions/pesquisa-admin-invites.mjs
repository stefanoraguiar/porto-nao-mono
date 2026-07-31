/**
 * Admin: generate one-time invite codes for the community census.
 * Stores only SHA-256 hashes — plaintext codes are returned once.
 *
 * POST { secret, count? } → { ok, codes[] }
 */

import { json } from './_shared.mjs';
import { SURVEY_ID } from '../../src/data/pesquisa-instrument.mjs';
import { generateInviteCode, getDb, insertInviteHashes } from './_pesquisa-db.mjs';

const MAX_BATCH = 50;

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const adminSecret = process.env.PESQUISA_ADMIN_SECRET;
  if (!adminSecret) {
    return json(503, { error: 'PESQUISA_ADMIN_SECRET not configured' });
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

  if (String(data.secret || '') !== adminSecret) {
    return json(401, { error: 'Unauthorized' });
  }

  const count = Math.min(MAX_BATCH, Math.max(1, Number(data.count) || 1));
  const surveyId = String(data.surveyId || SURVEY_ID);

  const db = getDb();
  if (!db) {
    return json(503, { error: 'Database not configured' });
  }

  const codes = [];
  const seen = new Set();
  while (codes.length < count) {
    const code = generateInviteCode();
    if (seen.has(code)) continue;
    seen.add(code);
    codes.push(code);
  }

  try {
    await insertInviteHashes(db, codes, surveyId);
  } catch (err) {
    console.error('pesquisa-admin-invites insert failed');
    return json(500, { error: 'Failed to store invites' });
  }

  return json(200, {
    ok: true,
    surveyId,
    count: codes.length,
    codes,
    note: 'Os códigos são mostrados uma única vez. Guarda-os offline e partilha-os em privado.',
  });
}
