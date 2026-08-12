require('dotenv').config();
const express = require('express');
const path = require('path');

const reposStore = require('./repos.store');
const { startAutoDelete } = require('./lib/auto-delete');
const ticketsRouter = require('./routes/tickets');
const adminRouter = require('./routes/admin');
const authRouter = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

if (!process.env.GITHUB_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn GITHUB_TOKEN. " +
    'Copia .env.example a .env i emplena-la abans de rebre tiquets reals.'
  );
}
if (!process.env.GITHUB_ADMIN_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn GITHUB_ADMIN_TOKEN. " +
    'Canviar estat/prioritat o eliminar tiquets des de /tickets-admin.html estarà desactivat.'
  );
}
if (!process.env.ADMIN_TOKEN) {
  console.warn(
    "AVIS: falta la variable d'entorn ADMIN_TOKEN. " +
    "La gestió de repositoris (/admin.html) estarà desactivada fins que la configuris."
  );
}
if (reposStore.list().length === 0) {
  console.warn('AVIS: no hi ha cap repositori configurat. Afegeix-ne des de /admin.html.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(ticketsRouter);
app.use(adminRouter);
app.use(authRouter);

// L'anon key de Supabase és pública per disseny (queda protegida per la
// RLS de cada taula), però no la volem hardcodejada al repositori.
app.get('/js/supabase-config.js', (_req, res) => {
  const adminEmails = (process.env.ADMIN_NOTIFY_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  res.type('application/javascript').send(
    `window.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || '')};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};\n` +
    // Nomes per mostrar/amagar la icona d'administracio al portal; no es
    // cap control de seguretat real (aixo el fa ADMIN_TOKEN al backend).
    `window.ADMIN_EMAILS = ${JSON.stringify(adminEmails)};\n`
  );
});

app.get('/health', (_req, res) => res.json({ ok: true }));

startAutoDelete();

app.listen(PORT, () => {
  console.log(`Portal de tiquets escoltant a http://localhost:${PORT}`);
});
