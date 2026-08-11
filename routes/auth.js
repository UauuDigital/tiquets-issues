const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { supabaseAdmin, tiquets } = require('../lib/supabase');
const { sendVerificationEmail, sendAdminNotificationEmail } = require('../lib/resend');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hores

// Evita abús del formulari de sol·licitud: màxim 5 per IP cada hora.
const solicitudLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Massa sol·licituds enviades des d\'aquesta connexió. Torna-ho a provar més tard.' }
});

router.post('/api/auth/solicituds', solicitudLimiter, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { email, nom, missatge } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanNom = (nom || '').trim();

  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return res.status(400).json({ error: 'Cal indicar un correu vàlid.' });
  }
  if (!cleanNom) {
    return res.status(400).json({ error: 'Cal indicar el teu nom.' });
  }

  const { data: existingUser } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('id')
    .eq('email', cleanEmail)
    .maybeSingle();
  if (existingUser) {
    return res.status(409).json({ error: 'Aquest correu ja té accés. Inicia sessió des de la pantalla de login.' });
  }

  const token = crypto.randomUUID();
  const tokenExpira = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  const { data: existingSolicitud } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .select('id, estat')
    .eq('email', cleanEmail)
    .eq('estat', 'pendent')
    .maybeSingle();

  if (existingSolicitud) {
    const { error } = await tiquets(supabaseAdmin)
      .from('solicituds_registre')
      .update({ nom: cleanNom, missatge: missatge || null, token_verificacio: token, token_expira: tokenExpira, email_verificat: false })
      .eq('id', existingSolicitud.id);
    if (error) {
      console.error('Error actualitzant sol·licitud de registre:', error);
      return res.status(500).json({ error: 'No s\'ha pogut desar la sol·licitud.' });
    }
  } else {
    const { error } = await tiquets(supabaseAdmin)
      .from('solicituds_registre')
      .insert({ email: cleanEmail, nom: cleanNom, missatge: missatge || null, token_verificacio: token, token_expira: tokenExpira });
    if (error) {
      console.error('Error creant sol·licitud de registre:', error);
      return res.status(500).json({ error: 'No s\'ha pogut desar la sol·licitud.' });
    }
  }

  await sendVerificationEmail({ to: cleanEmail, nom: cleanNom, token });
  res.status(201).json({ ok: true });
});

router.get('/api/auth/verificar-email', async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).send('El servidor no té configurat l\'accés a Supabase.');
  }
  const token = req.query.token;
  if (!token) {
    return res.redirect('/registre.html?verificat=error');
  }

  const { data: solicitud } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .select('id, nom, email, token_expira, estat')
    .eq('token_verificacio', token)
    .maybeSingle();

  if (!solicitud || solicitud.estat !== 'pendent' || new Date(solicitud.token_expira) < new Date()) {
    return res.redirect('/registre.html?verificat=error');
  }

  const { error } = await tiquets(supabaseAdmin)
    .from('solicituds_registre')
    .update({ email_verificat: true, token_verificacio: null })
    .eq('id', solicitud.id);
  if (error) {
    console.error('Error verificant sol·licitud de registre:', error);
    return res.redirect('/registre.html?verificat=error');
  }

  await sendAdminNotificationEmail({ nom: solicitud.nom, email: solicitud.email, missatge: null });
  res.redirect('/registre.html?verificat=ok');
});

module.exports = router;
