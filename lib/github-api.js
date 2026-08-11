const crypto = require('crypto');
const { PRIORITY_LABELS } = require('./labels');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
}

// Puja una captura de pantalla al repositori del tiquet via la Contents API de GitHub
// (a la carpeta .ticket-uploads/) i retorna la URL pública de descàrrega de la imatge.
async function uploadScreenshotToGithub(owner, repo, file) {
  const path = `.ticket-uploads/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${sanitizeFilename(file.originalname)}`;
  const ghResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Adjunt de tiquet: ${file.originalname}`,
        content: file.buffer.toString('base64')
      })
    }
  );
  if (!ghResponse.ok) {
    const errText = await ghResponse.text();
    console.error('Error pujant captura a GitHub:', ghResponse.status, errText);
    return null;
  }
  const data = await ghResponse.json();
  return data.content?.download_url || null;
}

// Fa servir el token del propietari real dels repos (no el d'UauuBot), ja que
// accions com eliminar una issue només les permet GitHub al propietari.
function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_ADMIN_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Token d'UauuBot (el mateix que crea els tiquets), per a lectures/escriptures
// de comentaris fetes des de zones públiques sense token d'administració.
function ghPublicHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

// Extreu owner/repo/número d'issue de la URL desada al tiquet.
function parseGithubIssueUrl(url) {
  const match = (url || '').match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], issueNumber: match[3] };
}

// Reflecteix a GitHub el canvi d'estat (tanca/reobre la issue) i/o de prioritat
// (actualitza l'etiqueta "prioritat: X") fet des de l'admin del portal.
async function syncTicketToGithub({ owner, repo, issueNumber }, { status, priority }) {
  const body = {};

  if (status !== undefined) {
    if (status === 'acabat') {
      body.state = 'closed';
      body.state_reason = 'completed';
    } else if (status === 'cancelat') {
      body.state = 'closed';
      body.state_reason = 'not_planned';
    } else {
      body.state = 'open';
    }
  }

  if (priority !== undefined) {
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
      { headers: ghHeaders() }
    );
    if (!getRes.ok) {
      throw new Error('No s\'ha pogut llegir la incidència a GitHub.');
    }
    const issue = await getRes.json();
    const otherLabels = (issue.labels || [])
      .map((l) => (typeof l === 'string' ? l : l.name))
      .filter((name) => !name.startsWith('prioritat: '));
    body.labels = [...otherLabels, PRIORITY_LABELS[priority]];
  }

  const patchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  );
  if (!patchRes.ok) {
    const errText = await patchRes.text();
    console.error('Error actualitzant issue a GitHub:', patchRes.status, errText);
    throw new Error('No s\'ha pogut actualitzar la incidència a GitHub.');
  }
}

// Elimina definitivament una issue de GitHub via l'API GraphQL (l'API REST no
// permet eliminar issues). Requereix que el token pertanyi a un compte amb
// permisos d'administrador del repositori; si no, GitHub retorna un error.
async function deleteGithubIssue({ owner, repo, issueNumber }) {
  const getRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    { headers: ghHeaders() }
  );
  if (!getRes.ok) {
    throw new Error('No s\'ha pogut llegir la incidència a GitHub.');
  }
  const issue = await getRes.json();

  const gqlRes = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'mutation($id: ID!) { deleteIssue(input: { issueId: $id }) { clientMutationId } }',
      variables: { id: issue.node_id }
    })
  });
  const gqlData = await gqlRes.json().catch(() => ({}));
  if (!gqlRes.ok || gqlData.errors) {
    const message = gqlData.errors?.[0]?.message || `Error ${gqlRes.status}`;
    console.error('Error eliminant issue a GitHub:', message);
    const lower = message.toLowerCase();
    throw new Error(
      lower.includes('permission') || lower.includes('admin') || lower.includes('resource not accessible')
        ? 'El token de GitHub no té permisos d\'administrador del repositori per eliminar issues.'
        : 'No s\'ha pogut eliminar la incidència a GitHub.'
    );
  }
}

// Comprova que owner/repo existeix a GitHub i que GITHUB_TOKEN hi té accés
// (permís per llegir el repositori; és el mínim necessari per crear-hi issues).
async function verifyGithubRepo(owner, repo) {
  if (!GITHUB_TOKEN) {
    return { ok: false, error: 'El servidor no té GITHUB_TOKEN configurat (revisa .env).' };
  }
  try {
    const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (ghResponse.status === 404) {
      return { ok: false, error: `No s'ha trobat el repositori ${owner}/${repo} (o el token no hi té accés).` };
    }
    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error('Error verificant repositori a GitHub:', ghResponse.status, errText);
      return { ok: false, error: 'No s\'ha pogut verificar el repositori a GitHub.' };
    }
    const data = await ghResponse.json();
    if (data.has_issues === false) {
      return { ok: false, error: `El repositori ${owner}/${repo} té les issues desactivades a GitHub.` };
    }
    return { ok: true };
  } catch (err) {
    console.error('Error connectant amb GitHub:', err);
    return { ok: false, error: 'No s\'ha pogut connectar amb GitHub.' };
  }
}

function normalizeProjectUrl(projectUrl) {
  const trimmed = projectUrl?.trim() || '';
  if (!trimmed) return { ok: true, value: '' };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol');
    return { ok: true, value: trimmed };
  } catch (err) {
    return { ok: false, error: 'El link del projecte ha de ser una URL vàlida (http:// o https://).' };
  }
}

module.exports = {
  GITHUB_TOKEN,
  GITHUB_ADMIN_TOKEN,
  ghHeaders,
  ghPublicHeaders,
  parseGithubIssueUrl,
  uploadScreenshotToGithub,
  syncTicketToGithub,
  deleteGithubIssue,
  verifyGithubRepo,
  normalizeProjectUrl
};
