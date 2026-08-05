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
const reposStore = require('./repos.store');
const ticketsStore = require('./tickets.store');
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

app.get('/api/repos', (_req, res) => {
  res.json(reposStore.list().map(({ id, label, description }) => ({ id, label, description: description || '' })));
});

// Llista pública (sense token) dels tiquets encara oberts, perquè qualsevol
// usuari del portal pugui veure què hi ha en curs sense accedir a l'admin.
app.get('/api/tickets', (_req, res) => {
  const open = ticketsStore.list().filter((t) => {
    const status = t.status || 'no_comencat';
    return status !== 'acabat' && status !== 'cancelat';
  });
  res.json(open.map(({ number, url, title, repoLabel, priority, status, reporterName, createdAt }) => ({
    number, url, title, repoLabel, priority, status: status || 'no_comencat', reporterName, createdAt
  })));
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

// Historial de tiquets creats (només lectura), per accedir-hi ràpidament des de l'admin.
app.get('/api/admin/tickets', requireAdmin, (_req, res) => {
  res.json(ticketsStore.list());
});

// Canvia l'estat d'un tiquet de l'historial.
app.patch('/api/admin/tickets/:id', requireAdmin, (req, res) => {
  const { status } = req.body || {};
  if (!TICKET_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estat no vàlid.' });
  }
  const updated = ticketsStore.updateStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Tiquet no trobat.' });
  res.json(updated);
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

app.post('/api/admin/repos', requireAdmin, async (req, res) => {
  const { label, owner, repo, description } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const entry = reposStore.create({
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || ''
  });
  res.status(201).json(entry);
});

app.put('/api/admin/repos/:id', requireAdmin, async (req, res) => {
  const { label, owner, repo, description } = req.body || {};
  if (!label?.trim() || !owner?.trim() || !repo?.trim()) {
    return res.status(400).json({ error: 'Cal indicar label, owner i repo.' });
  }
  const check = await verifyGithubRepo(owner.trim(), repo.trim());
  if (!check.ok) return res.status(400).json({ error: check.error });

  const updated = reposStore.update(req.params.id, {
    label: label.trim(),
    owner: owner.trim(),
    repo: repo.trim(),
    description: description?.trim() || ''
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
    ticketsStore.add({
      id: crypto.randomUUID(),
      number: issue.number,
      url: issue.html_url,
      title: title.trim(),
      repoLabel: targetRepo.label,
      priority: priority || null,
      reporterName: reporterName?.trim() || null,
      status: 'no_comencat',
      createdAt: new Date().toISOString()
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
