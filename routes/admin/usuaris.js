const express = require('express');

const requireAdmin = require('../../middleware/require-admin');
const { ADMIN_EMAIL } = requireAdmin;
const { supabaseAdmin, tiquets } = require('../../lib/supabase');
const { sendRejectedEmail, sendSetPasswordEmail } = require('../../lib/resend');

const router = express.Router();

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');

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

// Llista els usuaris que tenen accés al portal de tiquets.
router.get('/api/admin/usuaris', requireAdmin, async (_req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { data, error } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('id, email, nom, actiu, creat_el')
    .order('creat_el', { ascending: true });
  if (error) {
    console.error('Error llistant usuaris:', error);
    return res.status(500).json({ error: 'No s\'han pogut carregar els usuaris.' });
  }
  res.json(data);
});

// Revoca o restaura l'accés d'un usuari (actiu: true/false).
router.patch('/api/admin/usuaris/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { actiu } = req.body || {};
  if (typeof actiu !== 'boolean') {
    return res.status(400).json({ error: 'Cal indicar actiu (true/false).' });
  }

  const { data: usuariActual } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('email')
    .eq('id', req.params.id)
    .maybeSingle();
  if (usuariActual && usuariActual.email?.toLowerCase() === ADMIN_EMAIL && !actiu) {
    return res.status(400).json({ error: 'No es pot revocar l\'accés del compte d\'administració.' });
  }

  const { data, error } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .update({ actiu })
    .eq('id', req.params.id)
    .select('id, email, nom, actiu, creat_el')
    .maybeSingle();
  if (error) {
    console.error('Error actualitzant usuari:', error);
    return res.status(500).json({ error: 'No s\'ha pogut actualitzar l\'usuari.' });
  }
  if (!data) return res.status(404).json({ error: 'Usuari no trobat.' });
  res.json(data);
});

// Elimina definitivament un usuari (de tiquets.usuaris i de Supabase Auth).
// Nomes es pot eliminar un usuari amb l'acces ja revocat, per evitar
// esborrar per error algu amb acces actiu.
router.delete('/api/admin/usuaris/:id', requireAdmin, async (req, res) => {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'El servidor no té configurat l\'accés a Supabase (revisa .env).' });
  }
  const { data: usuari } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('id, actiu, email')
    .eq('id', req.params.id)
    .maybeSingle();

  if (!usuari) return res.status(404).json({ error: 'Usuari no trobat.' });
  if (usuari.email?.toLowerCase() === ADMIN_EMAIL) {
    return res.status(400).json({ error: 'No es pot eliminar el compte d\'administració.' });
  }
  if (usuari.actiu) {
    return res.status(400).json({ error: 'Cal revocar l\'accés abans d\'eliminar l\'usuari.' });
  }

  const { error: deleteError } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .delete()
    .eq('id', req.params.id);
  if (deleteError) {
    console.error('Error eliminant usuari de tiquets.usuaris:', deleteError);
    return res.status(500).json({ error: 'No s\'ha pogut eliminar l\'usuari.' });
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);
  if (authDeleteError) {
    console.error('Error eliminant usuari de Supabase Auth:', authDeleteError);
    return res.status(500).json({ error: 'L\'usuari s\'ha eliminat del portal, però no s\'ha pogut eliminar el seu compte d\'accés. Contacta amb suport.' });
  }

  res.json({ ok: true });
});

// Accepta una sol·licitud: crea l'usuari a Supabase Auth (sense contrasenya),
// genera un enllaç d'invitació i el desa a tiquets.usuaris. L'enllaç s'envia
// amb un correu propi via Resend (no el correu natiu de Supabase), perquè
// segueixi la mateixa estètica que la resta de correus del sistema.
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

  // generateLink({type:'invite'}) crea l'usuari a Supabase Auth (sense
  // contrasenya) i retorna l'enllaç en una sola crida — no cal (ni es pot)
  // fer createUser() abans, perquè 'invite' fallaria en trobar l'usuari ja creat.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'invite',
    email: solicitud.email
  });
  if (linkError) {
    console.error('Error creant usuari / generant enllaç d\'invitació:', linkError);
    return res.status(500).json({ error: 'No s\'ha pogut crear l\'usuari.' });
  }

  const { error: insertError } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .insert({ id: linkData.user.id, email: solicitud.email, nom: solicitud.nom, actiu: true });
  if (insertError) {
    console.error('Error inserint a usuaris:', insertError);
    return res.status(500).json({ error: 'No s\'ha pogut desar l\'usuari.' });
  }

  // No enviem linkData.properties.action_link directament: és un enllaç de
  // Supabase d'un sol ús que un escàner de seguretat del correu (p. ex.
  // Microsoft Defender Safe Links) pot "prefetchar" i consumir abans que
  // l'usuari el cliqui de veritat. En comptes d'això, enviem un enllaç cap a
  // la nostra pròpia pàgina amb el token_hash, que només es verifica quan
  // l'usuari interactua realment amb el formulari (crear-contrasenya-form.js).
  if (linkData?.properties?.hashed_token) {
    const actionLink = `${PUBLIC_BASE_URL}/crear-contrasenya.html?token_hash=${encodeURIComponent(linkData.properties.hashed_token)}&type=invite`;
    await sendSetPasswordEmail({ to: solicitud.email, nom: solicitud.nom, actionLink });
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
