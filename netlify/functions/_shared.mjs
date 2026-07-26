/**
 * Shared helpers for suggestion Netlify Functions.
 */

export const REPO = process.env.GITHUB_REPO || 'stefanoraguiar/porto-nao-mono';
export const BRANCH = process.env.GITHUB_BRANCH || 'main';

/** Comma-separated override: WEBMASTER_EMAILS=a@x.com,b@y.com */
export function getWebmasterEmails() {
  const fromEnv = (process.env.WEBMASTER_EMAILS || '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;
  return ['stefano@stefanoaguiar.com'];
}

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    body: JSON.stringify(body),
  };
}

export function slugify(text) {
  return String(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

export function escapeYaml(value) {
  const str = String(value ?? '').replace(/"/g, '\\"');
  return `"${str}"`;
}

export async function createGithubFile({ path, markdown, message, userAgent }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured', fallback: 'form' };
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': userAgent || 'porto-nao-mono',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(markdown, 'utf8').toString('base64'),
      branch: BRANCH,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('GitHub API error', res.status, errText);
    return { ok: false, status: 502, error: 'Failed to create pending entry', detail: errText.slice(0, 300) };
  }

  return { ok: true };
}

/**
 * Email webmasters when a suggestion is created.
 * Uses Resend when RESEND_API_KEY is set; otherwise no-ops (Netlify Forms still notify).
 */
export async function notifyWebmasters({ subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SUGGESTION_FROM_EMAIL || 'Porto Não-Monogâmico <onboarding@resend.dev>';
  const to = getWebmasterEmails();

  if (!apiKey) {
    console.log('RESEND_API_KEY not set — skipping direct email. Recipients:', to.join(', '));
    return { sent: false, reason: 'no_resend_key', to };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      text,
      html: html || undefined,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('Resend error', res.status, errText);
    return { sent: false, reason: 'resend_error', detail: errText.slice(0, 300), to };
  }

  return { sent: true, to };
}
