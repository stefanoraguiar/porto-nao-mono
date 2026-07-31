/**
 * Submit anonymous community census answers.
 * Burns the invite hash then increments aggregates in one transaction.
 * Never stores the code with answers, and never logs the request body.
 */

import { json } from './_shared.mjs';
import { SURVEY_ID, validateAnswers } from '../../src/data/pesquisa-instrument.mjs';
import { burnInviteAndAggregate, getDb } from './_pesquisa-db.mjs';

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

  const code = String(data.code || '').trim();
  const consent = Boolean(data.consent);
  const answers = data.answers;

  if (!code) {
    return json(400, { error: 'Código em falta', reason: 'missing_code' });
  }
  if (!consent) {
    return json(400, { error: 'Consentimento necessário', reason: 'no_consent' });
  }

  const validated = validateAnswers(answers);
  if (!validated.ok) {
    return json(400, { error: validated.error, reason: 'invalid_answers' });
  }

  const db = getDb();
  if (!db) {
    return json(503, { error: 'Serviço temporariamente indisponível' });
  }

  const result = await burnInviteAndAggregate(db, code, answers, SURVEY_ID);

  if (!result.ok) {
    if (result.reason === 'invalid') {
      return json(400, { error: 'Código inválido', reason: 'invalid' });
    }
    if (result.reason === 'used') {
      return json(409, { error: 'Este código já foi utilizado', reason: 'used' });
    }
    return json(500, { error: 'Não foi possível guardar a resposta', reason: 'error' });
  }

  return json(200, { ok: true });
}
