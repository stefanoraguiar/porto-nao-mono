/**
 * Public k-anonymized aggregates for the community census.
 * GET → { published, totalResponses, questions }
 */

import { json } from './_shared.mjs';
import { SURVEY_ID } from '../../src/data/pesquisa-instrument.mjs';
import { getDb, getPublicAggregates } from './_pesquisa-db.mjs';

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return json(204, {});
  }

  if (event.httpMethod !== 'GET') {
    return json(405, { error: 'Method not allowed' });
  }

  const db = getDb();
  if (!db) {
    return json(503, {
      error: 'Database not configured',
      published: false,
      totalResponses: 0,
      questions: {},
    });
  }

  try {
    const surveyId = event.queryStringParameters?.surveyId || SURVEY_ID;
    const aggregates = await getPublicAggregates(db, surveyId);
    return json(200, aggregates);
  } catch (err) {
    console.error('pesquisa-aggregates failed');
    return json(500, {
      error: 'Failed to load aggregates',
      published: false,
      totalResponses: 0,
      questions: {},
    });
  }
}
