/**
 * Turso helpers for the anonymous community census.
 * Stores invite hashes and aggregate counters only — never raw responses.
 */

import { createClient } from '@libsql/client';
import { createHash, randomBytes } from 'node:crypto';
import {
  MIN_BUCKET_COUNT,
  MIN_RESPONSES_TO_PUBLISH,
  SURVEY_ID,
  questions,
} from '../../src/data/pesquisa-instrument.mjs';

let schemaReady = false;

export function hashInviteCode(code) {
  return createHash('sha256').update(String(code).trim().toUpperCase(), 'utf8').digest('hex');
}

/** Human-friendly one-time code, e.g. PNM-A3F9-K2Q7 */
export function generateInviteCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(8);
  let raw = '';
  for (let i = 0; i < 8; i++) {
    raw += alphabet[bytes[i] % alphabet.length];
  }
  return `PNM-${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function getDb() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    return null;
  }
  return createClient({ url, authToken });
}

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS pesquisa_invites (
        code_hash TEXT PRIMARY KEY,
        survey_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        used_at TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS pesquisa_totals (
        survey_id TEXT PRIMARY KEY,
        total_responses INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS pesquisa_aggregates (
        survey_id TEXT NOT NULL,
        question_id TEXT NOT NULL,
        option_id TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (survey_id, question_id, option_id)
      )`,
    ],
    'write'
  );
  schemaReady = true;
}

/**
 * Insert invite hashes. Codes themselves are never stored.
 * @param {import('@libsql/client').Client} db
 * @param {string[]} codes plaintext codes (returned to admin once)
 * @param {string} surveyId
 */
export async function insertInviteHashes(db, codes, surveyId = SURVEY_ID) {
  await ensureSchema(db);
  const now = new Date().toISOString();
  const stmts = codes.map((code) => ({
    sql: `INSERT INTO pesquisa_invites (code_hash, survey_id, created_at, used_at)
          VALUES (?, ?, ?, NULL)`,
    args: [hashInviteCode(code), surveyId, now],
  }));
  await db.batch(stmts, 'write');
}

/**
 * Atomically burn invite + increment aggregates. Never stores answers with the code.
 * @returns {{ ok: true } | { ok: false, reason: 'invalid' | 'used' | 'error' }}
 */
export async function burnInviteAndAggregate(db, code, answers, surveyId = SURVEY_ID) {
  await ensureSchema(db);
  const codeHash = hashInviteCode(code);
  const now = new Date().toISOString();

  const tx = await db.transaction('write');
  try {
    const invite = await tx.execute({
      sql: `SELECT code_hash, used_at FROM pesquisa_invites
            WHERE code_hash = ? AND survey_id = ?`,
      args: [codeHash, surveyId],
    });

    if (invite.rows.length === 0) {
      await tx.rollback();
      return { ok: false, reason: 'invalid' };
    }
    if (invite.rows[0].used_at) {
      await tx.rollback();
      return { ok: false, reason: 'used' };
    }

    const burn = await tx.execute({
      sql: `UPDATE pesquisa_invites SET used_at = ?
            WHERE code_hash = ? AND survey_id = ? AND used_at IS NULL`,
      args: [now, codeHash, surveyId],
    });
    if (burn.rowsAffected === 0) {
      await tx.rollback();
      return { ok: false, reason: 'used' };
    }

    await tx.execute({
      sql: `INSERT INTO pesquisa_totals (survey_id, total_responses) VALUES (?, 1)
            ON CONFLICT(survey_id) DO UPDATE SET
              total_responses = total_responses + 1`,
      args: [surveyId],
    });

    for (const q of questions) {
      const optionId = answers[q.id];
      await tx.execute({
        sql: `INSERT INTO pesquisa_aggregates (survey_id, question_id, option_id, count)
              VALUES (?, ?, ?, 1)
              ON CONFLICT(survey_id, question_id, option_id) DO UPDATE SET
                count = count + 1`,
        args: [surveyId, q.id, optionId],
      });
    }

    await tx.commit();
    return { ok: true };
  } catch {
    try {
      await tx.rollback();
    } catch {
      /* ignore */
    }
    console.error('pesquisa burn/aggregate failed');
    return { ok: false, reason: 'error' };
  } finally {
    try {
      tx.close();
    } catch {
      /* already closed after commit/rollback */
    }
  }
}

/**
 * Public aggregates with k-anonymity applied.
 */
export async function getPublicAggregates(db, surveyId = SURVEY_ID) {
  await ensureSchema(db);

  const totalRes = await db.execute({
    sql: `SELECT total_responses FROM pesquisa_totals WHERE survey_id = ?`,
    args: [surveyId],
  });
  const total = Number(totalRes.rows[0]?.total_responses || 0);

  if (total < MIN_RESPONSES_TO_PUBLISH) {
    return {
      surveyId,
      published: false,
      totalResponses: total,
      minResponses: MIN_RESPONSES_TO_PUBLISH,
      questions: {},
    };
  }

  const rows = await db.execute({
    sql: `SELECT question_id, option_id, count FROM pesquisa_aggregates WHERE survey_id = ?`,
    args: [surveyId],
  });

  /** @type {Record<string, Record<string, number>>} */
  const byQuestion = {};
  for (const row of rows.rows) {
    const qid = String(row.question_id);
    const oid = String(row.option_id);
    const count = Number(row.count);
    if (!byQuestion[qid]) byQuestion[qid] = {};
    byQuestion[qid][oid] = count;
  }

  /** @type {Record<string, { id: string, label: string, count: number }[]>} */
  const questionsOut = {};
  for (const q of questions) {
    const raw = byQuestion[q.id] || {};
    let hidden = 0;
    const visible = [];
    for (const opt of q.options) {
      const count = raw[opt.id] || 0;
      if (count === 0) continue;
      if (count < MIN_BUCKET_COUNT) {
        hidden += count;
      } else {
        visible.push({ id: opt.id, label: opt.label, count });
      }
    }
    if (hidden > 0) {
      visible.push({ id: 'outros_oculto', label: 'Outros / oculto', count: hidden });
    }
    questionsOut[q.id] = visible;
  }

  return {
    surveyId,
    published: true,
    totalResponses: total,
    minResponses: MIN_RESPONSES_TO_PUBLISH,
    questions: questionsOut,
  };
}
