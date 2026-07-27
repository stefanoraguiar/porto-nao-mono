/**
 * Shared helpers for suggestion / removal Netlify Functions.
 */

export const REPO = process.env.GITHUB_REPO || 'stefanoraguiar/porto-nao-mono';
export const BRANCH = process.env.GITHUB_BRANCH || 'main';

const REMOVED_PHOTOS_PATH = 'src/data/removed-photos.json';

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

function githubHeaders(token, userAgent) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': userAgent || 'porto-nao-mono',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function createGithubFile({ path, markdown, message, userAgent }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured', fallback: 'form' };
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: githubHeaders(token, userAgent),
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

export async function getGithubFile(path, userAgent = 'porto-nao-mono') {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured', missing: false };
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${path}?ref=${encodeURIComponent(BRANCH)}`,
    { headers: githubHeaders(token, userAgent) }
  );

  if (res.status === 404) {
    return { ok: true, missing: true, content: null, sha: null };
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('GitHub get error', res.status, errText);
    return { ok: false, status: res.status, error: errText.slice(0, 300) };
  }

  const data = await res.json();
  const content = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
  return { ok: true, missing: false, content, sha: data.sha };
}

export async function putGithubFile({ path, content, message, sha, userAgent }) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured' };
  }

  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: githubHeaders(token, userAgent),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('GitHub put error', res.status, errText);
    return { ok: false, status: 502, error: errText.slice(0, 300) };
  }

  return { ok: true };
}

export async function getRemovedPhotos() {
  const file = await getGithubFile(REMOVED_PHOTOS_PATH, 'porto-nao-mono-removed-photos');
  if (!file.ok) {
    return { ok: false, urls: [], error: file.error };
  }
  if (file.missing) {
    return { ok: true, urls: [], sha: null };
  }
  try {
    const parsed = JSON.parse(file.content || '{"urls":[]}');
    const urls = Array.isArray(parsed.urls) ? parsed.urls.filter(Boolean) : [];
    return { ok: true, urls, sha: file.sha };
  } catch {
    return { ok: true, urls: [], sha: file.sha };
  }
}

export async function addRemovedPhoto({ url, name, email, reason, albumTitle }) {
  const current = await getRemovedPhotos();
  if (!current.ok && current.error === 'GITHUB_TOKEN not configured') {
    return { ok: false, status: 503, error: 'GITHUB_TOKEN not configured' };
  }
  if (!current.ok) {
    return { ok: false, status: 502, error: current.error || 'Failed to read removed list' };
  }

  const urls = [...new Set([...(current.urls || []), url])];
  const payload = {
    updatedAt: new Date().toISOString(),
    urls,
    lastRemoval: {
      url,
      name: name || '',
      email: email || '',
      reason: reason || '',
      albumTitle: albumTitle || '',
      at: new Date().toISOString(),
    },
  };

  const saved = await putGithubFile({
    path: REMOVED_PHOTOS_PATH,
    content: `${JSON.stringify(payload, null, 2)}\n`,
    message: `Hide gallery photo: ${url}`,
    sha: current.sha || undefined,
    userAgent: 'porto-nao-mono-removed-photos',
  });

  if (!saved.ok) {
    return { ok: false, status: saved.status || 502, error: saved.error };
  }

  return { ok: true, urls };
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
