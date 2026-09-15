const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const multer = require('multer');

const reposStore = require('../repos.store');
const ticketsStore = require('../tickets.store');
const activityStore = require('../activity.store');
const { formatDateCa } = require('../lib/date');
const { notifyByEmail } = require('../lib/mailer');
const { CATEGORY_LABELS, PRIORITY_LABELS, PRIORITY_TEXT } = require('../lib/labels');
const { publicCommentAuthorLine, extractPublicCommentAuthor, stripPublicCommentAuthor } = require('../lib/comments');
const { GITHUB_TOKEN, ghPublicHeaders, parseGithubIssueUrl, uploadScreenshotToGithub } = require('../lib/github-api');
const requireApprovedUser = require('../middleware/require-approved-user');

const router = express.Router();

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

router.get('/api/repos', (_req, res) => {
  res.json(reposStore.list().map(({ id, label, description }) => ({ id, label, description: description || '' })));
});

// Llista de tots els tiquets, per a qualsevol usuari del portal amb sessió
// aprovada (sense accedir a l'admin). No s'hi inclou el correu de qui
// reporta (reporterEmail), per privacitat.
router.get('/api/tickets', requireApprovedUser, (_req, res) => {
  res.json(ticketsStore.list().map(({
    id, number, url, title, description, repoLabel, priority, status, category, reporterName, screenshotUrls, createdAt
  }) => ({
    id, number, url, title, description, repoLabel, priority, status: status || 'no_comencat', category, reporterName, screenshotUrls: screenshotUrls || [], createdAt
  })));
});

// Últims esdeveniments (creació de tiquets, canvis d'estat i prioritat),
// visibles a qualsevol usuari del portal amb sessió aprovada, per a la
// columna d'activitat recent de tickets.html.
router.get('/api/activity', requireApprovedUser, (_req, res) => {
  // Els comentaris només es mostren a l'historial de l'admin, no al públic.
  res.json(activityStore.list().filter((e) => e.type !== 'comment').slice(0, 40));
});

// Comentaris d'un tiquet, visibles a qualsevol usuari del portal amb sessió
// aprovada. Fa servir GITHUB_TOKEN (no l'admin) perquè és una lectura del bot.
router.get('/api/tickets/:id/comments', requireApprovedUser, async (req, res) => {
  const ticket = ticketsStore.list().find((t) => t.id === req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Tiquet no trobat.' });

  const ghIssue = parseGithubIssueUrl(ticket.url);
  if (!ghIssue) return res.json([]);
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN no configurat: no es poden llegir els comentaris de GitHub.');
    return res.status(500).json({ error: 'No s\'han pogut carregar els comentaris ara mateix. Torna-ho a provar més tard.' });
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

// Deixa un comentari com a usuari amb sessió aprovada. Com que es publica
// amb el compte del bot, el nom de qui l'escriu es desa dins el propi text
// del comentari perquè es pugui mostrar igualment a la llista. El nom i el
// correu es prenen sempre de tiquets.usuaris (no del client) perquè l'usuari
// no els pugui suplantar.
router.post('/api/tickets/:id/comments', commentLimiter, requireApprovedUser, async (req, res) => {
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
  if (!GITHUB_TOKEN) {
    console.error('GITHUB_TOKEN no configurat: no es pot publicar el comentari a GitHub.');
    return res.status(500).json({ error: 'No s\'ha pogut publicar el comentari ara mateix. Torna-ho a provar més tard.' });
  }

  const cleanAuthor = (req.usuari.nom || '').trim().slice(0, 80) || 'Anònim';
  const cleanEmail = (req.usuari.email || '').trim().slice(0, 120);
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
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      type: 'comment',
      commentAuthor: cleanAuthor,
      commentBody: body.trim(),
      by: 'user',
      at: new Date().toISOString()
    });
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
// El número final és "prefix del repositori" + "número real de la issue",
// per evitar que tiquets de repositoris diferents comparteixin número.
router.get('/api/tickets/next-number', (req, res) => {
  const { repoId } = req.query;
  if (!repoId) {
    return res.json({ next: null });
  }
  const targetRepo = reposStore.list().find((r) => r.id === repoId);
  if (!targetRepo || !targetRepo.numberPrefix) {
    return res.json({ next: null });
  }
  const prefix = String(targetRepo.numberPrefix);
  const rawNumbers = ticketsStore
    .list()
    .filter((t) => t.repoId === repoId || (!t.repoId && t.repoLabel === targetRepo.label))
    .map((t) => String(t.number))
    .filter((s) => s.startsWith(prefix))
    .map((s) => parseInt(s.slice(prefix.length), 10))
    .filter((n) => Number.isInteger(n));
  const nextRaw = rawNumbers.length ? Math.max(...rawNumbers) + 1 : 1;
  const next = Number(`${prefix}${nextRaw}`);
  res.json({ next });
});

router.post('/api/tickets', ticketLimiter, requireApprovedUser, screenshotUpload.array('screenshots', MAX_SCREENSHOTS), async (req, res) => {
  const {
    description,
    category,
    priority,
    repoId,
    website // camp honeypot, ha d'arribar buit
  } = req.body || {};

  // El nom i el correu de qui reporta es prenen sempre de tiquets.usuaris
  // (no del client, encara que el formulari els mostri) perquè l'usuari no
  // pugui suplantar-ne un altre.
  const reporterName = req.usuari.nom || '';
  const reporterEmail = req.usuari.email || '';

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

  // Es pugen d'una en una (no amb Promise.all): pujades concurrents a la
  // Contents API de GitHub competeixen pel mateix cap de branca i sovint
  // provoquen un conflicte 409 a totes menys una, fent que desaparegui
  // silenciosament més d'una captura.
  const files = req.files || [];
  const uploadResults = [];
  for (const file of files) {
    uploadResults.push(await uploadScreenshotToGithub(file));
  }
  const screenshotUrls = uploadResults.filter(Boolean);
  const failedUploads = files.length - screenshotUrls.length;

  const issueBody = [
    `**Projecte:** ${targetRepo.label}`,
    `**Reportat per:** ${reporterName?.trim() || 'Anònim'}${reporterEmail?.trim() ? ` (${reporterEmail.trim()})` : ''}`,
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
    const displayNumber = targetRepo.numberPrefix
      ? Number(`${targetRepo.numberPrefix}${issue.number}`)
      : issue.number;
    notifyByEmail({ title: title.trim(), url: issue.html_url, number: displayNumber, repoLabel: targetRepo.label });
    const newTicketId = crypto.randomUUID();
    ticketsStore.add({
      id: newTicketId,
      number: displayNumber,
      url: issue.html_url,
      title: title.trim(),
      description: description.trim(),
      repoId: targetRepo.id,
      repoLabel: targetRepo.label,
      priority: priority || null,
      category: category || null,
      reporterName: reporterName?.trim() || null,
      reporterEmail: reporterEmail?.trim() || null,
      screenshotUrls,
      status: 'no_comencat',
      createdAt: new Date().toISOString()
    });
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: newTicketId,
      ticketNumber: displayNumber,
      ticketTitle: title.trim(),
      type: 'created',
      reporterName: reporterName?.trim() || null,
      at: new Date().toISOString()
    });
    return res.status(201).json({ ok: true, number: displayNumber, url: issue.html_url });
  } catch (err) {
    console.error('Error inesperat:', err);
    return res.status(500).json({ error: 'Error intern del servidor.' });
  }
});

// Tradueix els errors de multer (captures adjuntades) a missatges en català.
router.use((err, _req, res, next) => {
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

module.exports = router;
