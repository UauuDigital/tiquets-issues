require('dotenv').config();
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

function formatDateCa(date) {
  return new Intl.DateTimeFormat('ca-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_ADMIN_TOKEN = process.env.GITHUB_ADMIN_TOKEN;
const reposStore = require('./repos.store');
const ticketsStore = require('./tickets.store');
const activityStore = require('./activity.store');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn GITHUB_TOKEN. " +
    'Copia .env.example a .env i emplena-la abans de rebre tiquets reals.'
  );
}
if (!GITHUB_ADMIN_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn GITHUB_ADMIN_TOKEN. " +
    'Canviar estat/prioritat o eliminar tiquets des de /tickets-admin.html estarà desactivat.'
  );
}
if (!ADMIN_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn ADMIN_TOKEN. " +
    "La gestió de repositoris (/admin.html) estarà desactivada fins que la configuris."
  );
}
if (reposStore.list().length === 0) {
  console.warn('AVIS: no hi ha cap repositori configurat. Afegeix-ne des de /admin.html.');
}

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: "El servidor no té ADMIN_TOKEN configurat." });
  }
  const provided = req.get('x-admin-token');
  if (provided !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Token d\'administració invàlid.' });
  }
  next();
}

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL } = process.env;
const emailEnabled = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS && NOTIFY_EMAIL);

let mailer = null;
if (emailEnabled) {
  mailer = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });
} else {
  console.warn(
    'AVIS: falten variables SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS, NOTIFY_EMAIL). ' +
    'No s\'enviaran correus de notificació dels tiquets nous.'
  );
}

async function notifyByEmail({ title, url, number, repoLabel }) {
  if (!mailer) return;
  try {
    await mailer.sendMail({
      from: SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `[${repoLabel}] Nou tiquet #${number}: ${title}`,
      text: `S'ha creat un tiquet nou a "${repoLabel}".\n\n${title}\n\n${url}`
    });
  } catch (err) {
    console.error('Error enviant la notificació per correu:', err);
  }
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Evita abús del formulari: màxim 10 tiquets per IP cada 15 minuts
const ticketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Massa tiquets enviats des d\'aquesta connexió. Torna-ho a provar més tard.' }
});

// Evita abús dels comentaris públics: màxim 20 per IP cada 15 minuts
const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Massa comentaris enviats des d\'aquesta connexió. Torna-ho a provar més tard.' }
});

// Edita aquests mapes per adaptar les categories/prioritats de la teva empresa.
// Si una etiqueta no existeix al repositori, GitHub la crea automàticament (sense color personalitzat).
const CATEGORY_LABELS = {
  bug: 'tipus: error',
  funcionalitat: 'tipus: petició',
  acces: 'tipus: accés i permisos',
  altres: 'tipus: altres'
};

const PRIORITY_LABELS = {
  baixa: 'prioritat: baixa',
  mitjana: 'prioritat: mitjana',
  alta: 'prioritat: alta',
  critica: 'prioritat: crítica'
};

// Etiquetes llegibles pel desplegable de Departament del portal (public/index.html).
const DEPARTMENT_LABELS = {
  comercial: 'Comercial',
  coordinacio: 'Coordinació',
  cuina: 'Cuina',
  administracio: 'Administració',
  digital: 'Digital'
};

// Etiquetes llegibles per al lliscador de Prioritat del portal.
const PRIORITY_TEXT = {
  baixa: 'Baixa',
  mitjana: 'Mitjana',
  alta: 'Alta',
  critica: 'Crítica'
};

// Estats possibles d'un tiquet a l'historial de l'admin.
const TICKET_STATUSES = ['no_comencat', 'comencat', 'acabat', 'cancelat', 'en_espera'];

// Un tiquet acabat o cancel·lat s'elimina sol (GitHub inclòs) al cap d'aquest temps.
const AUTO_DELETE_DAYS = 14;
const AUTO_DELETE_MS = AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;

// --- Captures de pantalla adjuntes al formulari de tiquets ---
const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SCREENSHOT_SIZE, files: MAX_SCREENSHOTS },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_SCREENSHOT_TYPES.includes(file.mimetype)) {
      return cb(new Error('INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});

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

// Els comentaris públics es publiquen amb el compte del bot, així que el nom
// de qui l'escriu es guarda com a primera línia del propi cos del comentari,
// amb aquest format exacte: "_Comentari de NOM:_" seguit d'una línia en blanc.
function publicCommentAuthorLine(name, email) {
  return `_Comentari de ${name}${email ? ` — ${email}` : ''}:_`;
}
const PUBLIC_COMMENT_AUTHOR_RE = /^_Comentari de (.+?):_\n/;
function extractPublicCommentAuthor(body) {
  const match = (body || '').match(PUBLIC_COMMENT_AUTHOR_RE);
  return match ? match[1].trim() : null;
}
function stripPublicCommentAuthor(body) {
  return (body || '').replace(PUBLIC_COMMENT_AUTHOR_RE, '').trim();
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

// Elimina sols (GitHub inclòs) els tiquets que fa AUTO_DELETE_DAYS que estan
// acabats o cancel·lats. Si l'eliminació a GitHub falla, es reintenta a la
// següent passada (el tiquet no es toca fins que GitHub confirma l'eliminació).
async function cleanupExpiredTickets() {
  const expired = ticketsStore.list().filter((t) => {
    if (t.status !== 'acabat' && t.status !== 'cancelat') return false;
    if (!t.closedAt) return false;
    return Date.now() - new Date(t.closedAt).getTime() >= AUTO_DELETE_MS;
  });

  for (const t of expired) {
    try {
      const ghIssue = parseGithubIssueUrl(t.url);
      if (ghIssue && GITHUB_ADMIN_TOKEN) {
        await deleteGithubIssue(ghIssue);
      }
      ticketsStore.remove(t.id);
      activityStore.add({
        id: crypto.randomUUID(),
        ticketId: t.id,
        ticketNumber: t.number,
        ticketTitle: t.title,
        type: 'deleted',
        by: 'auto',
        at: new Date().toISOString()
      });
      console.log(`Tiquet #${t.number} eliminat automàticament (${AUTO_DELETE_DAYS} dies com a ${t.status}).`);
    } catch (err) {
      console.error(`No s'ha pogut eliminar automàticament el tiquet #${t.number}:`, err.message);
    }
  }
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // comprova cada hora
setInterval(cleanupExpiredTickets, CLEANUP_INTERVAL_MS);
cleanupExpiredTickets();

app.get('/api/repos', (_req, res) => {
  res.json(reposStore.list().map(({ id, label, description }) => ({ id, label, description: description || '' })));
});

// Llista pública (sense token) de tots els tiquets, perquè qualsevol
// usuari del portal en tingui una visió ràpida sense accedir a l'admin.
// No s'hi inclou el correu de qui reporta (reporterEmail), per privacitat.
app.get('/api/tickets', (_req, res) => {
  res.json(ticketsStore.list().map(({
    id, number, url, title, description, repoLabel, priority, status, category, department, reporterName, screenshotUrls, createdAt
  }) => ({
    id, number, url, title, description, repoLabel, priority, status: status || 'no_comencat', category, department, reporterName, screenshotUrls: screenshotUrls || [], createdAt
  })));
});

// Últims esdeveniments (creació de tiquets, canvis d'estat i prioritat),
// visibles a qualsevol usuari del portal (sense token), per a la columna
// d'activitat recent de tickets.html.
app.get('/api/activity', (_req, res) => {
  res.json(activityStore.list().slice(0, 40));
});

// Comentaris d'un tiquet, visibles a qualsevol usuari del portal (sense token).
// Fa servir GITHUB_TOKEN (no l'admin) perquè és una lectura pública.
app.get('/api/tickets/:id/comments', async (req, res) => {
  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) return res.json([]);
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat GITHUB_TOKEN (revisa .env).' });
  }

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${ghIssue.owner}/${ghIssue.repo}/issues/${ghIssue.issueNumber}/comments`,
      { headers: ghPublicHeaders() }
    );
    if (!ghResponse.ok) {
      throw new Error(`Error ${ghResponse.status}`);
    }
    const comments = await ghResponse.json();
    res.json(comments.map((c) => ({
      author: extractPublicCommentAuthor(c.body) || c.user?.login || 'Desconegut',
      avatarUrl: c.user?.avatar_url || null,
      body: stripPublicCommentAuthor(c.body),
      url: c.html_url,
      createdAt: c.created_at
    })));
  } catch (err) {
    console.error('Error llegint comentaris de GitHub:', err);
    res.status(502).json({ error: 'No s\'han pogut carregar els comentaris de GitHub.' });
  }
});

// Deixa un comentari des del portal públic (sense token). Com que es publica
// amb el compte del bot, el nom de qui l'escriu es desa dins el propi text
// del comentari perquè es pugui mostrar igualment a la llista.
app.post('/api/tickets/:id/comments', commentLimiter, async (req, res) => {
  const { body, authorName, authorEmail } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Cal escriure un comentari.' });
  }

  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) {
    return res.status(502).json({ error: 'Aquest tiquet no està enllaçat amb cap incidència de GitHub.' });
  }
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat GITHUB_TOKEN (revisa .env).' });
  }

  const cleanAuthor = (authorName || '').trim().slice(0, 80) || 'Anònim';
  const cleanEmail = (authorEmail || '').trim().slice(0, 120);
  const taggedBody = `${publicCommentAuthorLine(cleanAuthor, cleanEmail)}\n\n${body.trim()}`;

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${ghIssue.owner}/${ghIssue.repo}/issues/${ghIssue.issueNumber}/comments`,
      {
        method: 'POST',
        headers: { ...ghPublicHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: taggedBody })
      }
    );
    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error('Error creant comentari públic a GitHub:', ghResponse.status, errText);
      throw new Error();
    }
    const comment = await ghResponse.json();
    res.status(201).json({
      author: cleanAuthor + (cleanEmail ? ` — ${cleanEmail}` : ''),
      avatarUrl: comment.user?.avatar_url || null,
      body: body.trim(),
      url: comment.html_url,
      createdAt: comment.created_at
    });
  } catch (err) {
    res.status(502).json({ error: 'No s\'ha pogut publicar el comentari a GitHub.' });
  }
});

// Número orientatiu que tindria el següent tiquet, perquè el formulari el
// pugui mostrar mentre s'omple (el número real l'assigna GitHub en crear-lo).
app.get('/api/tickets/next-number', (_req, res) => {
  const numbers = ticketsStore.list().map((t) => t.number).filter((n) => typeof n === 'number');
  const next = numbers.length ? Math.max(...numbers) + 1 : 1;
  res.json({ next });
});

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

// Verifica si el token d'administració desat al navegador encara és vàlid,
// per poder mostrar una pantalla d'inici de sessió abans de carregar l'admin.
app.get('/api/admin/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// --- Gestió (CRUD) de repositoris connectats, protegida per ADMIN_TOKEN ---
app.get('/api/admin/repos', requireAdmin, (_req, res) => {
  res.json(reposStore.list());
});

// Historial de tiquets creats (només lectura), per accedir-hi ràpidament des de l'admin.
app.get('/api/admin/tickets', requireAdmin, (_req, res) => {
  res.json(ticketsStore.list());
});

// Últims esdeveniments (creació de tiquets, canvis d'estat i prioritat),
// per a la columna d'activitat recent de l'admin.
app.get('/api/admin/activity', requireAdmin, (_req, res) => {
  res.json(activityStore.list().slice(0, 200));
});

// Canvia l'estat i/o la prioritat d'un tiquet, sincronitzant-ho primer amb la
// incidència de GitHub (tanca/reobre segons l'estat, actualitza l'etiqueta de
// prioritat). Si la sincronització amb GitHub falla, no es desa el canvi local.
app.patch('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
  const { status, priority } = req.body || {};
  const patch = {};
  if (status !== undefined) {
    if (!TICKET_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estat no vàlid.' });
    }
    patch.status = status;
  }
  if (priority !== undefined) {
    if (!PRIORITY_LABELS[priority]) {
      return res.status(400).json({ error: 'Prioritat no vàlida.' });
    }
    patch.priority = priority;
  }
  if (!Object.keys(patch).length) {
    return res.status(400).json({ error: 'Cal indicar status o priority.' });
  }
  if (!GITHUB_ADMIN_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat GITHUB_ADMIN_TOKEN (revisa .env).' });
  }

  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) {
    return res.status(502).json({ error: 'Aquest tiquet no està enllaçat amb cap incidència de GitHub.' });
  }

  try {
    await syncTicketToGithub(ghIssue, patch);
  } catch (err) {
    console.error('Error sincronitzant tiquet amb GitHub:', err);
    return res.status(502).json({ error: err.message || 'No s\'ha pogut sincronitzar amb GitHub.' });
  }

  // Marca quan el tiquet ha entrat (o ha sortit) de l'estat acabat/cancel·lat,
  // per poder-lo eliminar sol al cap de AUTO_DELETE_DAYS.
  if (patch.status !== undefined) {
    const isClosed = patch.status === 'acabat' || patch.status === 'cancelat';
    patch.closedAt = isClosed ? new Date().toISOString() : null;
  }

  const updated = ticketsStore.update(req.params.id, patch);

  const now = new Date().toISOString();
  if (patch.status !== undefined && patch.status !== ticket.status) {
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      type: 'status',
      from: ticket.status || 'no_comencat',
      to: patch.status,
      at: now
    });
  }
  if (patch.priority !== undefined && patch.priority !== ticket.priority) {
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      type: 'priority',
      from: ticket.priority || null,
      to: patch.priority,
      at: now
    });
  }

  res.json(updated);
});

// Elimina un tiquet: primer intenta eliminar la incidència de GitHub (requereix
// que el token tingui permisos d'administrador del repositori); si GitHub ho
// rebutja, no s'elimina res (ni GitHub ni l'historial local).
app.delete('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (ghIssue) {
    if (!GITHUB_ADMIN_TOKEN) {
      return res.status(500).json({ error: 'El servidor no té configurat GITHUB_ADMIN_TOKEN (revisa .env).' });
    }
    try {
      await deleteGithubIssue(ghIssue);
    } catch (err) {
      return res.status(502).json({ error: err.message || 'No s\'ha pogut eliminar la incidència a GitHub.' });
    }
  }

  const ok = ticketsStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Tiquet no trobat.' });
  activityStore.add({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    ticketNumber: ticket.number,
    ticketTitle: ticket.title,
    type: 'deleted',
    by: 'admin',
    at: new Date().toISOString()
  });
  res.status(204).end();
});

// Retorna en directe els comentaris de la issue de GitHub, perquè es puguin
// veure des del modal de detall del tiquet sense sortir del portal.
app.get('/api/admin/tickets/:id/comments', requireAdmin, async (req, res) => {
  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) return res.json([]);
  if (!GITHUB_ADMIN_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat GITHUB_ADMIN_TOKEN (revisa .env).' });
  }

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${ghIssue.owner}/${ghIssue.repo}/issues/${ghIssue.issueNumber}/comments`,
      { headers: ghHeaders() }
    );
    if (!ghResponse.ok) {
      throw new Error(`Error ${ghResponse.status}`);
    }
    const comments = await ghResponse.json();
    res.json(comments.map((c) => ({
      author: extractPublicCommentAuthor(c.body) || c.user?.login || 'Desconegut',
      avatarUrl: c.user?.avatar_url || null,
      body: stripPublicCommentAuthor(c.body),
      url: c.html_url,
      createdAt: c.created_at
    })));
  } catch (err) {
    console.error('Error llegint comentaris de GitHub:', err);
    res.status(502).json({ error: 'No s\'han pogut carregar els comentaris de GitHub.' });
  }
});

// Afegeix un comentari a la issue de GitHub des del modal de detall del tiquet.
app.post('/api/admin/tickets/:id/comments', requireAdmin, async (req, res) => {
  const { body } = req.body || {};
  if (!body || !body.trim()) {
    return res.status(400).json({ error: 'Cal escriure un comentari.' });
  }

  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) {
    return res.status(502).json({ error: 'Aquest tiquet no està enllaçat amb cap incidència de GitHub.' });
  }
  if (!GITHUB_ADMIN_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat GITHUB_ADMIN_TOKEN (revisa .env).' });
  }

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${ghIssue.owner}/${ghIssue.repo}/issues/${ghIssue.issueNumber}/comments`,
      {
        method: 'POST',
        headers: { ...ghHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() })
      }
    );
    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error('Error creant comentari a GitHub:', ghResponse.status, errText);
      throw new Error();
    }
    const comment = await ghResponse.json();
    res.status(201).json({
      author: comment.user?.login || 'Desconegut',
      avatarUrl: comment.user?.avatar_url || null,
      body: comment.body || '',
      url: comment.html_url,
      createdAt: comment.created_at
    });
  } catch (err) {
    res.status(502).json({ error: 'No s\'ha pogut publicar el comentari a GitHub.' });
  }
});

// Llista els repositoris de GitHub als quals el GITHUB_TOKEN té accés
// (propis, com a col·laborador, o d'organitzacions), perquè l'admin
// pugui triar-los d'un desplegable en lloc d'escriure'ls a mà.
app.get('/api/admin/github-repos', requireAdmin, async (_req, res) => {
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té GITHUB_TOKEN configurat (revisa .env).' });
  }
  try {
    const repos = [];
    for (let page = 1; page <= 5; page++) {
      const ghResponse = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&affiliation=owner,collaborator,organization_member&sort=full_name`,
        {
          headers: {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        }
      );
      if (!ghResponse.ok) {
        const errText = await ghResponse.text();
        console.error('Error llistant repositoris de GitHub:', ghResponse.status, errText);
        return res.status(502).json({ error: 'No s\'han pogut llistar els repositoris de GitHub.' });
      }
      const data = await ghResponse.json();
      repos.push(...data.map((r) => ({ owner: r.owner.login, repo: r.name, fullName: r.full_name })));
      if (data.length < 100) break;
    }
    res.json(repos);
  } catch (err) {
    console.error('Error connectant amb GitHub:', err);
    res.status(500).json({ error: 'No s\'ha pogut connectar amb GitHub.' });
  }
});

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

app.post('/api/admin/repos', requireAdmin, async (req, res) => {
  const { label, owner, repo, description, projectUrl } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const urlCheck = normalizeProjectUrl(projectUrl);
  if (!urlCheck.ok) return res.status(400).json({ error: urlCheck.error });
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const entry = reposStore.create({
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || '',
    projectUrl: urlCheck.value
  });
  res.status(201).json(entry);
});

app.put('/api/admin/repos/:id', requireAdmin, async (req, res) => {
  const { label, owner, repo, description, projectUrl } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const urlCheck = normalizeProjectUrl(projectUrl);
  if (!urlCheck.ok) return res.status(400).json({ error: urlCheck.error });
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const updated = reposStore.update(req.params.id, {
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || '',
    projectUrl: urlCheck.value
  });
  if (!updated) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.json(updated);
});

app.delete('/api/admin/repos/:id', requireAdmin, (req, res) => {
  const ok = reposStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.status(204).end();
});

app.post('/api/tickets', ticketLimiter, screenshotUpload.array('screenshots', MAX_SCREENSHOTS), async (req, res) => {
  const {
    description,
    category,
    priority,
    reporterName,
    reporterEmail,
    department,
    repoId,
    website // camp honeypot, ha d'arribar buit
  } = req.body || {};

  // Honeypot anti-bots: si el camp ocult té contingut, fingim èxit i no fem res.
  if (website) {
    return res.status(201).json({ ok: true, number: null, url: null });
  }

  if (!description || !description.trim()) {
    return res.status(400).json({ error: 'Cal explicar la incidència.' });
  }

  // El formulari no demana un títol; se'n genera un a partir de la primera
  // línia de la descripció (GitHub requereix un títol per crear la issue).
  const TITLE_MAX_LENGTH = 80;
  const firstLine = description.trim().split('\n')[0].trim();
  const title = firstLine.length > TITLE_MAX_LENGTH
    ? firstLine.slice(0, TITLE_MAX_LENGTH - 1).trim() + '…'
    : firstLine;

  const targetRepo = reposStore.list().find((r) => r.id === repoId);
  if (!targetRepo) {
    return res.status(400).json({ error: 'Cal triar un repositori vàlid.' });
  }

  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a GitHub (revisa .env).' });
  }

  const labels = [];
  if (CATEGORY_LABELS[category]) labels.push(CATEGORY_LABELS[category]);
  if (PRIORITY_LABELS[priority]) labels.push(PRIORITY_LABELS[priority]);

  const files = req.files || [];
  const uploadResults = await Promise.all(
    files.map((file) => uploadScreenshotToGithub(targetRepo.owner, targetRepo.repo, file))
  );
  const screenshotUrls = uploadResults.filter(Boolean);
  const failedUploads = files.length - screenshotUrls.length;

  const issueBody = [
    `**Projecte:** ${targetRepo.label}`,
    `**Reportat per:** ${reporterName?.trim() || 'Anònim'}${reporterEmail?.trim() ? ` (${reporterEmail.trim()})` : ''}`,
    department?.trim() ? `**Departament:** ${DEPARTMENT_LABELS[department.trim()] || department.trim()}` : null,
    `**Prioritat:** ${PRIORITY_TEXT[priority] || 'no especificada'}`,
    `**Enviat des del portal de tiquets:** ${formatDateCa(new Date())}`,
    '',
    '---',
    '',
    description.trim(),
    screenshotUrls.length ? '\n---\n\n**Captures adjuntades:**\n' : null,
    ...screenshotUrls.map((url) => `![captura](${url})`),
    failedUploads > 0 ? `\n_${failedUploads} captura(es) no s'han pogut pujar._` : null
  ].filter(Boolean).join('\n');

  try {
    const ghResponse = await fetch(
      `https://api.github.com/repos/${targetRepo.owner}/${targetRepo.repo}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: title.trim(), body: issueBody, labels })
      }
    );

    if (!ghResponse.ok) {
      const errText = await ghResponse.text();
      console.error('Error de GitHub:', ghResponse.status, errText);
      return res.status(502).json({ error: 'No s\'ha pogut crear la incidència a GitHub.' });
    }

    const issue = await ghResponse.json();
    notifyByEmail({ title: title.trim(), url: issue.html_url, number: issue.number, repoLabel: targetRepo.label });
    const newTicketId = crypto.randomUUID();
    ticketsStore.add({
      id: newTicketId,
      number: issue.number,
      url: issue.html_url,
      title: title.trim(),
      description: description.trim(),
      repoLabel: targetRepo.label,
      priority: priority || null,
      category: category || null,
      department: department?.trim() || null,
      reporterName: reporterName?.trim() || null,
      reporterEmail: reporterEmail?.trim() || null,
      screenshotUrls,
      status: 'no_comencat',
      createdAt: new Date().toISOString()
    });
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: newTicketId,
      ticketNumber: issue.number,
      ticketTitle: title.trim(),
      type: 'created',
      reporterName: reporterName?.trim() || null,
      at: new Date().toISOString()
    });
    return res.status(201).json({ ok: true, number: issue.number, url: issue.html_url });
  } catch (err) {
    console.error('Error inesperat:', err);
    return res.status(500).json({ error: 'Error intern del servidor.' });
  }
});

// Tradueix els errors de multer (captures adjuntades) a missatges en català.
app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `Cada captura ha de pesar com a màxim ${MAX_SCREENSHOT_SIZE / (1024 * 1024)} MB.` });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ error: `Com a màxim es poden adjuntar ${MAX_SCREENSHOTS} captures.` });
    }
    return res.status(400).json({ error: 'No s\'han pogut processar els fitxers adjunts.' });
  }
  if (err && err.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ error: 'Només es poden adjuntar imatges (PNG, JPG, WEBP o GIF).' });
  }
  next(err);
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Portal de tiquets escoltant a http://localhost:${PORT}`);
});
