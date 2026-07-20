require('dotenv').config();
const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const reposStore = require('./repos.store');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!GITHUB_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn GITHUB_TOKEN. " +
    'Copia .env.example a .env i emplena-la abans de rebre tiquets reals.'
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

// Edita aquests mapes per adaptar les categories/prioritats de la teva empresa.
// Si una etiqueta no existeix al repositori, GitHub la crea automàticament (sense color personalitzat).
const CATEGORY_LABELS = {
  bug: 'tipus: error',
  funcionalitat: 'tipus: petició',
  suport: 'tipus: suport tècnic',
  acces: 'tipus: accés i permisos',
  altres: 'tipus: altres'
};

const PRIORITY_LABELS = {
  baixa: 'prioritat: baixa',
  mitjana: 'prioritat: mitjana',
  alta: 'prioritat: alta',
  critica: 'prioritat: crítica'
};

app.get('/api/repos', (_req, res) => {
  res.json(reposStore.list().map(({ id, label }) => ({ id, label })));
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

// --- Gestió (CRUD) de repositoris connectats, protegida per ADMIN_TOKEN ---
app.get('/api/admin/repos', requireAdmin, (_req, res) => {
  res.json(reposStore.list());
});

app.post('/api/admin/repos', requireAdmin, async (req, res) => {
  const { label, owner, repo } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const entry = reposStore.create({ label: label.trim(), owner: owner.trim(), repo: repo.trim() });
  res.status(201).json(entry);
});

app.put('/api/admin/repos/:id', requireAdmin, async (req, res) => {
  const { label, owner, repo } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const updated = reposStore.update(req.params.id, { label: label.trim(), owner: owner.trim(), repo: repo.trim() });
  if (!updated) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.json(updated);
});

app.delete('/api/admin/repos/:id', requireAdmin, (req, res) => {
  const ok = reposStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.status(204).end();
});

app.post('/api/tickets', ticketLimiter, async (req, res) => {
  const {
    title,
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

  if (!title || !title.trim() || !description || !description.trim()) {
    return res.status(400).json({ error: 'El títol i la descripció són obligatoris.' });
  }

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

  const issueBody = [
    `**Reportat per:** ${reporterName?.trim() || 'Anònim'}${reporterEmail?.trim() ? ` (${reporterEmail.trim()})` : ''}`,
    department?.trim() ? `**Departament:** ${department.trim()}` : null,
    `**Prioritat:** ${priority || 'no especificada'}`,
    `**Enviat des del portal de tiquets:** ${new Date().toISOString()}`,
    '',
    '---',
    '',
    description.trim()
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
    return res.status(201).json({ ok: true, number: issue.number, url: issue.html_url });
  } catch (err) {
    console.error('Error inesperat:', err);
    return res.status(500).json({ error: 'Error intern del servidor.' });
  }
});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Portal de tiquets escoltant a http://localhost:${PORT}`);
});
