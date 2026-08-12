const express = require('express');
const crypto = require('crypto');

const reposStore = require('../repos.store');
const ticketsStore = require('../tickets.store');
const activityStore = require('../activity.store');
const requireAdmin = require('../middleware/require-admin');
const { TICKET_STATUSES, PRIORITY_LABELS } = require('../lib/labels');
const { extractPublicCommentAuthor, stripPublicCommentAuthor } = require('../lib/comments');
const {
  GITHUB_TOKEN,
  GITHUB_ADMIN_TOKEN,
  ghHeaders,
  parseGithubIssueUrl,
  syncTicketToGithub,
  deleteGithubIssue,
  verifyGithubRepo,
  normalizeProjectUrl
} = require('../lib/github-api');
const { supabaseAdmin, tiquets } = require('../lib/supabase');
const { sendRejectedEmail } = require('../lib/resend');

const router = express.Router();

// Verifica si el token d'administració desat al navegador encara és vàlid,
// per poder mostrar una pantalla d'inici de sessió abans de carregar l'admin.
router.get('/api/admin/verify', requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// --- Gestió (CRUD) de repositoris connectats, protegida per ADMIN_TOKEN ---
router.get('/api/admin/repos', requireAdmin, (_req, res) => {
  res.json(reposStore.list());
});

// Historial de tiquets creats (només lectura), per accedir-hi ràpidament des de l'admin.
router.get('/api/admin/tickets', requireAdmin, (_req, res) => {
  res.json(ticketsStore.list());
});

// Últims esdeveniments (creació de tiquets, canvis d'estat i prioritat),
// per a la columna d'activitat recent de l'admin.
router.get('/api/admin/activity', requireAdmin, (_req, res) => {
  res.json(activityStore.list().slice(0, 200));
});

// Esborra tot l'historial d'activitat. Exigeix un text de confirmació exacte
// a més del token d'admin, com a segona barrera contra un clic accidental.
router.delete('/api/admin/activity', requireAdmin, (req, res) => {
  const { confirm } = req.body || {};
  if (confirm !== 'ELIMINA') {
    return res.status(400).json({ error: 'Cal confirmar l\'eliminació amb el text exacte.' });
  }
  activityStore.clear();
  res.status(204).end();
});

// Canvia l'estat i/o la prioritat d'un tiquet, sincronitzant-ho primer amb la
// incidència de GitHub (tanca/reobre segons l'estat, actualitza l'etiqueta de
// prioritat). Si la sincronització amb GitHub falla, no es desa el canvi local.
router.patch('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
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
router.delete('/api/admin/tickets/:id', requireAdmin, async (req, res) => {
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
router.get('/api/admin/tickets/:id/comments', requireAdmin, async (req, res) => {
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
      id: c.id,
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
router.post('/api/admin/tickets/:id/comments', requireAdmin, async (req, res) => {
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
    activityStore.add({
      id: crypto.randomUUID(),
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      ticketTitle: ticket.title,
      type: 'comment',
      commentAuthor: comment.user?.login || 'Administrador',
      commentBody: body.trim(),
      by: 'admin',
      at: new Date().toISOString()
    });
    res.status(201).json({
      id: comment.id,
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

// Elimina un comentari de la issue de GitHub des del modal de detall del tiquet.
router.delete('/api/admin/tickets/:id/comments/:commentId', requireAdmin, async (req, res) => {
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
      `https://api.github.com/repos/${ghIssue.owner}/${ghIssue.repo}/issues/comments/${req.params.commentId}`,
      { method: 'DELETE', headers: ghHeaders() }
    );
    if (!ghResponse.ok && ghResponse.status !== 404) {
      const errText = await ghResponse.text();
      console.error('Error eliminant comentari a GitHub:', ghResponse.status, errText);
      throw new Error();
    }
    res.status(204).end();
  } catch (err) {
    res.status(502).json({ error: 'No s\'ha pogut eliminar el comentari a GitHub.' });
  }
});

// Llista els repositoris de GitHub als quals el GITHUB_TOKEN té accés
// (propis, com a col·laborador, o d'organitzacions), perquè l'admin
// pugui triar-los d'un desplegable en lloc d'escriure'ls a mà.
router.get('/api/admin/github-repos', requireAdmin, async (_req, res) => {
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

router.post('/api/admin/repos', requireAdmin, async (req, res) => {
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

router.put('/api/admin/repos/:id', requireAdmin, async (req, res) => {
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

router.delete('/api/admin/repos/:id', requireAdmin, (req, res) => {
  const ok = reposStore.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Repositori no trobat.' });
  res.status(204).end();
});

// NOMÉS PER A PROVES: genera un magic link vàlid sense enviar cap correu
// (Supabase el crea però no l'envia), per poder provar el login mentre el
// mailer per defecte de Supabase està limitat i el SMTP de Resend encara
// no està configurat. Eliminar aquest endpoint abans de publicar-ho de debò.
router.post('/api/admin/dev-magic-link', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const email = (req.body?.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Cal indicar un correu.' });

  const publicBaseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${publicBaseUrl}/login.html` }
  });
  if (error) {
    console.error('Error generant magic link de prova:', error);
    return res.status(500).json({ error: error.message || 'No s\'ha pogut generar l\'enllaç.' });
  }
  res.json({ url: data.properties.action_link });
});

// Llista sol·licituds d'accés verificades i pendents d'aprovar.
router.get('/api/admin/solicituds', requireAdmin, async (_req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { data, error } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .select('id, email, nom, missatge, creat_el')
    .eq('estat', 'pendent')
    .eq('email_verificat', true)
    .order('creat_el', { ascending: true });
  if (error) {
    console.error('Error llistant sol·licituds de registre:', error);
    return res.status(500).json({ error: 'No s\'han pogut carregar les sol·licituds.' });
  }
  res.json(data);
});

// Accepta una sol·licitud: crea l'usuari a Supabase Auth via invitació
// (Supabase envia el propi correu d'invitació) i el desa a tiquets.usuaris.
router.post('/api/admin/solicituds/:id/acceptar', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { data: solicitud } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .select('id, email, nom, estat, email_verificat')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!solicitud) return res.status(404).json({ error: 'Sol·licitud no trobada.' });
  if (solicitud.estat !== 'pendent' || !solicitud.email_verificat) {
    return res.status(400).json({ error: 'Aquesta sol·licitud no es pot acceptar (no està pendent o l\'email no s\'ha verificat).' });
  }

  const { data: invited, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(solicitud.email);
  if (inviteError) {
    console.error('Error invitant usuari a Supabase Auth:', inviteError);
    return res.status(500).json({ error: 'No s\'ha pogut crear l\'usuari.' });
  }

  const { error: insertError } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .insert({ id: invited.user.id, email: solicitud.email, nom: solicitud.nom, actiu: true });
  if (insertError) {
    console.error('Error inserint a usuaris:', insertError);
    return res.status(500).json({ error: 'No s\'ha pogut desar l\'usuari.' });
  }

  await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .update({ estat: 'acceptat' })
    .eq('id', solicitud.id);

  res.json({ ok: true });
});

// Rebutja una sol·licitud.
router.post('/api/admin/solicituds/:id/rebutjar', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { data: solicitud } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .select('id, email, nom, estat')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!solicitud) return res.status(404).json({ error: 'Sol·licitud no trobada.' });
  if (solicitud.estat !== 'pendent') {
    return res.status(400).json({ error: 'Aquesta sol·licitud ja no està pendent.' });
  }

  const { error } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .update({ estat: 'rebutjat' })
    .eq('id', solicitud.id);
  if (error) {
    console.error('Error rebutjant sol·licitud:', error);
    return res.status(500).json({ error: 'No s\'ha pogut rebutjar la sol·licitud.' });
  }

  await sendRejectedEmail({ to: solicitud.email, nom: solicitud.nom });
  res.status(204).end();
});

module.exports = router;
