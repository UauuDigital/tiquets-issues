# Accés controlat a la creació de tiquets (registre + aprovació + magic link) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permetre que qualsevol persona amb el link vegi el portal de tiquets, però que només treballadors aprovats per un admin (via Supabase Auth amb magic link, sense contrasenyes) puguin crear tiquets nous.

**Architecture:** S'afegeix Supabase (Postgres + Auth) com a nou servei extern, gestionat amb `@supabase/supabase-js`. El projecte de Supabase **ja existeix i és compartit amb una altra app ("compras")**: totes les taules d'aquest projecte viuen sota un esquema propi, `tiquets`, per no col·lidir amb l'altra app. El navegador mai escriu directament a `tiquets.solicituds_registre` ni `tiquets.usuaris`: totes les operacions sensibles (crear sol·licitud, aprovar/rebutjar, crear l'usuari a `auth.users`) passen pel backend Express amb la **service role key**. El navegador només fa dues coses amb Supabase directament: (1) `signInWithOtp` per demanar el magic link, i (2) llegir la seva pròpia fila a `tiquets.usuaris` un cop ha iniciat sessió (permès per una única política RLS `auth.uid() = id`). **La creació de tiquets no canvia de lloc**: continua sent exactament com ara (POST a `routes/tickets.js` → GitHub Issue, `tickets.json` com a còpia local). No es crea cap taula `issues` a Postgres — aquesta app ja té el seu propi sistema de tiquets via GitHub, i duplicar-lo a Postgres seria una regressió (es perdria la integració amb GitHub, les captures de pantalla, el tauler d'administració actual i l'historial d'activitat). L'aprovació de sol·licituds es protegeix reutilitzant el `requireAdmin`/`ADMIN_TOKEN` que ja existeix al projecte (el mateix que ja protegeix `admin.html` i `tickets-admin.html`), en lloc de crear un segon sistema d'"admin" dins de Supabase.

**Tech Stack:** Supabase (Postgres amb esquema `tiquets`, Auth, pg_cron), `@supabase/supabase-js` (backend, amb service role key; frontend, via CDN `<script>` sense build step), Resend com a SMTP personalitzat de Supabase Auth (per als correus de magic link i invitació) i com a API pròpia per als correus que enviem nosaltres (verificació d'email, notificació a l'admin, rebuig), Express (existent), `express-rate-limit` (existent).

## Global Constraints

- Comentaris de codi i missatges d'usuari sempre en català, seguint el to ja existent al projecte (vegeu `public/js/error-messages.js`, `public/js/admin-auth.js`).
- `kebab-case` per a tots els fitxers nous.
- Cap error tècnic en cru al frontend: tot error visible ha de passar per un missatge traduït (patró `ERROR_MESSAGES` existent a `public/js/error-messages.js`).
- **Totes** les consultes a Supabase des del backend fan servir l'esquema `tiquets` explícitament: `supabaseAdmin.schema('tiquets').from('...')`. Mai `public` (és de l'altra app).
- No es crea cap taula `issues`/`tickets` a Postgres: els tiquets continuen creant-se via GitHub Issues (`routes/tickets.js`), sense canvis en aquest flux excepte l'afegit d'un middleware d'autenticació.
- Aprovació de sol·licituds = `ADMIN_TOKEN`/`requireAdmin` existents. No es crea cap rol `admin` dins de `tiquets.usuaris`.
- RLS: activada a `tiquets.usuaris` amb una única política de lectura de la pròpia fila (`auth.uid() = id`). La taula `tiquets.solicituds_registre` NO té cap política d'accés per `anon`/`authenticated`: només el service role (backend) hi opera.
- Aquest projecte no té cap framework de tests. Cada tasca es verifica amb comandes `curl`/`node -e` manuals descrites al pas de verificació, no amb `npm test`.
- Les claus `SUPABASE_SERVICE_ROLE_KEY` i `RESEND_API_KEY` són secrets: només a `.env` (mai commitejades) i `.env.example` només en documenta el nom. En producció (Servatica/Plesk) es configuren al panell "Variables de entorno personalizadas" del Node.js app, no a `.env`.

---

## Fase 0 — Configuració manual (no és codi)

Aquesta fase **l'has de fer tu** perquè requereix entrar en panells web amb el teu propi compte. Jo no hi tinc accés. Un cop tinguis les dades, me les passes i continuo amb la Tasca 1.

- [ ] **Pas 1: Confirmar el projecte de Supabase existent i el nom de l'esquema**
  - Ja tens un projecte amb l'app "compras". Anota'm: **Project URL** (`https://xxxx.supabase.co`), **anon public key**, i **service_role key** (Settings → API).
  - Confirma que l'esquema `tiquets` (diferent de `public`, que és de "compras") és el nom que vols fer servir.

- [ ] **Pas 2: Exposar l'esquema `tiquets` a l'API**
  - Settings → API → **Exposed schemas** → afegeix `tiquets` a la llista (per defecte només `public` hi és). Sense això, el navegador (amb l'anon key) no pot llegir `tiquets.usuaris` encara que la RLS ho permeti.

- [ ] **Pas 3: Activar `pg_cron`** (si no ho està ja per a "compras")
  - Database → Extensions → cerca `pg_cron` → Enable.

- [ ] **Pas 4: Crear compte a Resend i configurar-lo com a SMTP de Supabase Auth**
  - Crea un compte a [resend.com](https://resend.com) (pla Free) i verifica un domini (o fes servir el de proves `resend.dev` només per a desenvolupament).
  - A Resend, genera unes credencials SMTP (Resend → SMTP): et donaran un host, port, usuari i contrasenya SMTP (diferents de l'API key).
  - A Supabase: **Authentication → Settings → SMTP Settings** → activa "Enable Custom SMTP" i omple-hi les credencials de Resend. Això és imprescindible: el correu per defecte de Supabase està limitat a ~3-4 emails/hora i el magic link no funcionaria de manera fiable sense això.
  - **Authentication → Email Templates → Invite user**: tradueix la plantilla al català (és l'email que rebrà un usuari quan l'acceptis). **Authentication → Email Templates → Magic Link**: tradueix-la també.
  - Anota'm a més: l'**API key** de Resend (per a les crides directes des del nostre codi: verificació d'email i rebuig) i l'adreça `from` verificada.

- [ ] **Pas 5: Decidir qui rep les notificacions d'aprovació**
  - Dona'm la llista de correus dels admins que han de rebre l'avís quan algú sol·licita accés (poden ser més d'un, separats per comes).

- [ ] **Pas 6: Passar-me les dades**
  - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFY_EMAILS`, i la `PUBLIC_BASE_URL` (p. ex. `http://localhost:3000` en local, o el domini de Servatica quan ho despleguem).

---

### Task 1: Migració SQL inicial (esquema `tiquets`, taules, RLS, pg_cron)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: `tiquets.solicituds_registre`, `tiquets.usuaris`, `tiquets.heartbeat`, usades per totes les tasques posteriors (backend i frontend).

- [ ] **Step 1: Escriure la migració**

```sql
-- supabase/migrations/0001_init.sql
-- Executar al SQL Editor de Supabase (Database -> SQL Editor) del projecte
-- compartit amb "compras". Totes les taules viuen a l'esquema `tiquets`,
-- separat de `public` (que es de l'altra app).

create schema if not exists tiquets;
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- Sol·licituds de registre pendents d'aprovacio. Cap policy RLS per a
-- anon/authenticated: nomes el service role (backend Express) hi opera.
create table if not exists tiquets.solicituds_registre (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nom text not null,
  missatge text,
  email_verificat boolean not null default false,
  token_verificacio text,
  token_expira timestamptz,
  estat text not null default 'pendent' check (estat in ('pendent', 'acceptat', 'rebutjat')),
  creat_el timestamptz not null default now()
);
create index if not exists solicituds_registre_email_idx on tiquets.solicituds_registre (email);
create index if not exists solicituds_registre_token_idx on tiquets.solicituds_registre (token_verificacio);
alter table tiquets.solicituds_registre enable row level security;

-- Usuaris aprovats. id = auth.users.id (auth es sempre a nivell de
-- projecte, no d'esquema). Una unica policy: cadascu pot llegir la seva
-- propia fila (el backend, amb service role, la salta i pot llegir/
-- escriure qualsevol fila).
create table if not exists tiquets.usuaris (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nom text not null,
  actiu boolean not null default true,
  creat_el timestamptz not null default now()
);
alter table tiquets.usuaris enable row level security;
create policy "usuaris_select_own_row"
  on tiquets.usuaris for select
  using (auth.uid() = id);

-- Registre de "pings" perque pg_cron generi activitat i Supabase Free no
-- pausi el projecte per inactivitat. Dimecres se n'insereix un, diumenge
-- s'elimina el que ja te mes d'un dia.
create table if not exists tiquets.heartbeat (
  id uuid primary key default gen_random_uuid(),
  creat_el timestamptz not null default now()
);

select cron.schedule(
  'tiquets-heartbeat-crea',
  '0 6 * * 3',
  $$ insert into tiquets.heartbeat default values; $$
);

select cron.schedule(
  'tiquets-heartbeat-neteja',
  '0 6 * * 0',
  $$ delete from tiquets.heartbeat where creat_el < now() - interval '1 day'; $$
);
```

- [ ] **Step 2: Executar-la al SQL Editor de Supabase**

Copia tot el contingut del fitxer al SQL Editor del projecte i executa'l.

- [ ] **Step 3: Verificar**

```sql
select table_name from information_schema.tables
where table_schema = 'tiquets';

select jobname, schedule from cron.job where jobname like 'tiquets-%';
```

Esperat: les 3 taules (`solicituds_registre`, `usuaris`, `heartbeat`) apareixen; `cron.job` mostra `tiquets-heartbeat-crea` i `tiquets-heartbeat-neteja`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_init.sql
git commit -m "Millora: Afegeix la migracio inicial de Supabase (esquema tiquets: solicituds, usuaris, heartbeat)"
```

---

### Task 2: Dependències i variables d'entorn

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Modify: `.env` (local, no versionat — el fas tu amb les dades de la Fase 0)

**Interfaces:**
- Produces: paquet `@supabase/supabase-js` disponible per a `lib/supabase.js` (Task 3); paquet `resend` disponible per a `lib/resend.js` (Task 4).

- [ ] **Step 1: Instal·lar les dependències**

```bash
npm install @supabase/supabase-js resend
```

- [ ] **Step 2: Afegir les variables noves a `.env.example`**

Afegeix al final del fitxer existent:

```
# --- Acces controlat (Supabase Auth + Resend) ---
# Projecte de Supabase compartit amb l'app "compras". Totes les nostres
# taules viuen a l'esquema `tiquets` (mai a `public`).
SUPABASE_URL=
SUPABASE_ANON_KEY=
# Secret: mai s'envia al navegador. Salta la RLS: nomes el backend l'ha de fer servir.
SUPABASE_SERVICE_ROLE_KEY=

# Clau d'API de Resend (resend.com) per als correus que enviem nosaltres
# (verificacio d'email, notificacio a l'admin, rebuig). Els correus de
# magic link i d'invitacio els envia Supabase directament, configurat amb
# SMTP de Resend des del propi panell de Supabase (Fase 0).
RESEND_API_KEY=
# Adreça remitent verificada a Resend.
RESEND_FROM_EMAIL=

# Adreces (separades per comes) que reben la notificacio de sol·licituds
# noves pendents d'aprovar.
ADMIN_NOTIFY_EMAILS=

# URL publica on esta desplegat el portal (sense / final), usada per
# construir els enllaços dels correus que enviem nosaltres.
PUBLIC_BASE_URL=http://localhost:3000
```

- [ ] **Step 3: Omplir `.env` local amb les dades reals de la Fase 0**

(Aquest pas el fas tu directament sobre `.env`, que no es versiona. En producció a Servatica, les mateixes variables es configuren al panell "Variables de entorno personalizadas" de l'app Node.js de Plesk.)

- [ ] **Step 4: Verificar**

```bash
node -e "require('dotenv').config(); console.log(!!process.env.SUPABASE_URL, !!process.env.SUPABASE_SERVICE_ROLE_KEY, !!process.env.RESEND_API_KEY)"
```

Esperat: `true true true`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Millora: Afegeix les dependencies i variables d'entorn per a Supabase i Resend"
```

---

### Task 3: Client Supabase del backend (service role, esquema `tiquets`)

**Files:**
- Create: `lib/supabase.js`

**Interfaces:**
- Consumes: `process.env.SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY` (Task 2).
- Produces: `supabaseAdmin` (client amb permisos de service role), `tiquets(client)` (helper que retorna `client.schema('tiquets')`), `getUserFromAccessToken(accessToken)` — funcions usades per `middleware/require-approved-user.js` (Task 6), `routes/auth.js` (Task 5) i `routes/admin.js` (Task 7).

- [ ] **Step 1: Escriure el client**

```javascript
// lib/supabase.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    "AVIS: falten SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY. " +
    "El registre, l'aprovacio d'usuaris i la proteccio de /api/tickets estaran desactivats."
  );
}

// Client amb la service role key: salta la RLS. Nomes s'ha de fer servir
// des del backend, mai exposar aquesta clau al navegador.
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
  : null;

// Aquest projecte de Supabase es compartit amb una altra app ("compras");
// totes les nostres taules viuen sota l'esquema `tiquets`, mai `public`.
function tiquets(client) {
  return client.schema('tiquets');
}

// Verifica un access token de sessio (enviat pel navegador) i retorna
// l'usuari de Supabase Auth, o null si no es valid.
async function getUserFromAccessToken(accessToken) {
  if (!supabaseAdmin || !accessToken) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) return null;
  return data.user;
}

module.exports = { supabaseAdmin, tiquets, getUserFromAccessToken };
```

- [ ] **Step 2: Verificar**

```bash
node -e "require('dotenv').config(); const { supabaseAdmin, tiquets } = require('./lib/supabase'); tiquets(supabaseAdmin).from('usuaris').select('id').limit(1).then(r => console.log('ok', r.error || r.data))"
```

Esperat: `ok []` (taula buida, sense error).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.js
git commit -m "Millora: Afegeix el client de Supabase (service role, esquema tiquets) del backend"
```

---

### Task 4: Enviament d'emails amb Resend (verificació i rebuig)

**Files:**
- Create: `lib/resend.js`

**Interfaces:**
- Consumes: `process.env.RESEND_API_KEY`, `process.env.RESEND_FROM_EMAIL`, `process.env.ADMIN_NOTIFY_EMAILS`, `process.env.PUBLIC_BASE_URL`.
- Produces: `sendVerificationEmail({ to, nom, token })`, `sendAdminNotificationEmail({ nom, email, missatge })`, `sendRejectedEmail({ to, nom })` — usades per `routes/auth.js` (Task 5) i `routes/admin.js` (Task 7). *Nota:* el correu d'acceptació NO es fa des d'aquí — el genera Supabase mateix (`inviteUserByEmail`, Task 7), enviat pel SMTP de Resend configurat a la Fase 0.

- [ ] **Step 1: Escriure el mòdul**

```javascript
// lib/resend.js
const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.RESEND_FROM_EMAIL;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
const ADMIN_NOTIFY_EMAILS = (process.env.ADMIN_NOTIFY_EMAILS || '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);

if (!RESEND_API_KEY || !FROM) {
  console.warn(
    "AVIS: falten RESEND_API_KEY o RESEND_FROM_EMAIL. " +
    "No s'enviaran els correus de verificacio, rebuig ni notificacio a l'admin."
  );
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

async function send({ to, subject, html }) {
  if (!resend) return;
  try {
    await resend.emails.send({ from: FROM, to, subject, html });
  } catch (err) {
    console.error('Error enviant correu amb Resend:', err);
  }
}

async function sendVerificationEmail({ to, nom, token }) {
  const url = `${PUBLIC_BASE_URL}/api/auth/verificar-email?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: 'Confirma el teu correu — Portal de tiquets UAUU',
    html: `
      <p>Hola ${nom},</p>
      <p>Hem rebut la teva sol·licitud d'accés al portal de tiquets. Confirma que aquest és el teu correu:</p>
      <p><a href="${url}">Confirmar el meu correu</a></p>
      <p>Un cop confirmat, un administrador revisarà la sol·licitud.</p>
    `
  });
}

async function sendAdminNotificationEmail({ nom, email, missatge }) {
  if (!ADMIN_NOTIFY_EMAILS.length) return;
  const url = `${PUBLIC_BASE_URL}/solicituds-admin.html`;
  await send({
    to: ADMIN_NOTIFY_EMAILS,
    subject: `Nova sol·licitud d'accés: ${nom}`,
    html: `
      <p>${nom} (${email}) ha sol·licitat accés al portal de tiquets.</p>
      <p><strong>Missatge:</strong> ${missatge || '—'}</p>
      <p><a href="${url}">Revisar sol·licituds pendents</a></p>
    `
  });
}

async function sendRejectedEmail({ to, nom }) {
  await send({
    to,
    subject: 'Sobre la teva sol·licitud d\'accés — Portal de tiquets UAUU',
    html: `
      <p>Hola ${nom},</p>
      <p>De moment no podem donar-te accés al portal de tiquets. Si creus que és un error, contacta amb l'equip digital.</p>
    `
  });
}

module.exports = { sendVerificationEmail, sendAdminNotificationEmail, sendRejectedEmail };
```

- [ ] **Step 2: Verificar**

```bash
node -e "require('dotenv').config(); require('./lib/resend').sendVerificationEmail({ to: 'TU_CORREU_DE_PROVA@exemple.com', nom: 'Prova', token: 'test-token' }).then(() => console.log('enviat'))"
```

Esperat: rebre el correu (o, si `RESEND_API_KEY` encara no és vàlida, un avís controlat a consola, no un crash).

- [ ] **Step 3: Commit**

```bash
git add lib/resend.js
git commit -m "Millora: Afegeix l'enviament d'emails de verificacio i rebuig amb Resend"
```

---

### Task 5: Rutes públiques de sol·licitud i verificació

**Files:**
- Create: `routes/auth.js`
- Modify: `server.js` (muntar el router nou)

**Interfaces:**
- Consumes: `supabaseAdmin`, `tiquets()` (Task 3), `sendVerificationEmail`/`sendAdminNotificationEmail` (Task 4).
- Produces: `POST /api/auth/solicituds`, `GET /api/auth/verificar-email`. Muntat des de `server.js`.

- [ ] **Step 1: Escriure el router**

```javascript
// routes/auth.js
const express = require('express');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

const { supabaseAdmin, tiquets } = require('../lib/supabase');
const { sendVerificationEmail, sendAdminNotificationEmail } = require('../lib/resend');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hores

// Evita abus del formulari de sol·licitud: max 5 per IP cada hora.
const solicitudLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Massa sol·licituds des d\'aquesta connexió. Torna-ho a provar més tard.' }
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
```

- [ ] **Step 2: Muntar el router a `server.js`**

A `server.js`, afegeix l'import junt amb la resta de routers (prop de la línia `const adminRouter = require('./routes/admin');`):

```javascript
const authRouter = require('./routes/auth');
```

I munta'l junt amb els altres (`app.use(ticketsRouter); app.use(adminRouter);`):

```javascript
app.use(authRouter);
```

- [ ] **Step 3: Verificar**

Amb el servidor arrencat (`npm run dev`):

```bash
curl -s -X POST http://localhost:3000/api/auth/solicituds -H "Content-Type: application/json" -d "{\"email\":\"prova@exemple.com\",\"nom\":\"Prova\",\"missatge\":\"test\"}"
```

Esperat: `{"ok":true}` i una fila nova a `tiquets.solicituds_registre` (comprovable al Table Editor de Supabase, seleccionant l'esquema `tiquets` al desplegable) amb `email_verificat = false`.

- [ ] **Step 4: Commit**

```bash
git add routes/auth.js server.js
git commit -m "Millora: Afegeix les rutes publiques de sol·licitud i verificacio d'email"
```

---

### Task 6: Middleware d'autenticació i protecció de `POST /api/tickets`

**Files:**
- Create: `middleware/require-approved-user.js`
- Modify: `routes/tickets.js:198` (la línia de la ruta `router.post('/api/tickets', ...)`)

**Interfaces:**
- Consumes: `getUserFromAccessToken`, `supabaseAdmin`, `tiquets()` (Task 3).
- Produces: middleware `requireApprovedUser`, que afegeix `req.userId` a la petició quan és vàlida.

- [ ] **Step 1: Escriure el middleware**

```javascript
// middleware/require-approved-user.js
const { getUserFromAccessToken, supabaseAdmin, tiquets } = require('../lib/supabase');

async function requireApprovedUser(req, res, next) {
  const authHeader = req.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: 'Cal iniciar sessió per crear un tiquet.' });
  }

  const user = await getUserFromAccessToken(accessToken);
  if (!user) {
    return res.status(401).json({ error: 'La sessió no és vàlida. Torna a iniciar sessió.' });
  }

  const { data: usuari, error } = await tiquets(supabaseAdmin)
    .from('usuaris')
    .select('actiu')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error comprovant usuari aprovat:', error);
    return res.status(500).json({ error: 'No s\'ha pogut comprovar el teu accés.' });
  }
  if (!usuari || !usuari.actiu) {
    return res.status(403).json({ error: 'El teu compte encara no té accés aprovat per crear tiquets.' });
  }

  req.userId = user.id;
  next();
}

module.exports = requireApprovedUser;
```

- [ ] **Step 2: Aplicar-lo a la ruta de creació de tiquets**

A `routes/tickets.js`, afegeix l'import junt amb la resta (prop de la línia `const { GITHUB_TOKEN, ghPublicHeaders, ... } = require('../lib/github-api');`):

```javascript
const requireApprovedUser = require('../middleware/require-approved-user');
```

I insereix el middleware a la ruta de creació (línia actual, aproximadament `routes/tickets.js:198`):

```javascript
router.post('/api/tickets', ticketLimiter, requireApprovedUser, screenshotUpload.array('screenshots', MAX_SCREENSHOTS), async (req, res) => {
```

(Nota: `requireApprovedUser` va **abans** de `screenshotUpload`, perquè no val la pena processar fitxers pujats si l'usuari no té accés. La resta de la funció —creació de la GitHub Issue, `tickets.json`, `activity.json`— es queda exactament igual que ara.)

- [ ] **Step 3: Verificar**

```bash
curl -s -X POST http://localhost:3000/api/tickets -F "description=prova" -F "repoId=algun-repo"
```

Esperat: `401` amb `{"error":"Cal iniciar sessió per crear un tiquet."}`.

- [ ] **Step 4: Commit**

```bash
git add middleware/require-approved-user.js routes/tickets.js
git commit -m "Millora: Exigeix sessio aprovada de Supabase per crear tiquets"
```

---

### Task 7: Panell d'aprovació — endpoints d'admin (reutilitzant `ADMIN_TOKEN`)

**Files:**
- Modify: `routes/admin.js` (afegir al final, abans de `module.exports = router;`)

**Interfaces:**
- Consumes: `supabaseAdmin`, `tiquets()` (Task 3), `sendRejectedEmail` (Task 4), `requireAdmin` (ja importat a `routes/admin.js`, és el mateix `ADMIN_TOKEN` de sempre — no es crea cap rol nou).
- Produces: `GET /api/admin/solicituds`, `POST /api/admin/solicituds/:id/acceptar`, `POST /api/admin/solicituds/:id/rebutjar`.

- [ ] **Step 1: Afegir l'import a `routes/admin.js`**

Junt amb la resta d'imports de `routes/admin.js`:

```javascript
const { supabaseAdmin, tiquets } = require('../lib/supabase');
const { sendRejectedEmail } = require('../lib/resend');
```

- [ ] **Step 2: Afegir les rutes, abans de `module.exports = router;`**

```javascript
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

// Accepta una sol·licitud: crea l'usuari a Supabase Auth via invitacio
// (Supabase envia el propi correu d'invitacio, amb el SMTP de Resend
// configurat a la Fase 0) i el desa a tiquets.usuaris.
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
```

- [ ] **Step 3: Verificar**

```bash
curl -s http://localhost:3000/api/admin/solicituds -H "x-admin-token: EL_TEU_ADMIN_TOKEN"
```

Esperat: array JSON amb la sol·licitud de prova creada a la Task 5, un cop `email_verificat=true` (fent clic a l'enllaç del correu, o actualitzant-ho directament des del Table Editor per provar sense esperar).

- [ ] **Step 4: Commit**

```bash
git add routes/admin.js
git commit -m "Millora: Afegeix els endpoints d'admin per aprovar o rebutjar sol·licituds d'acces"
```

---

### Task 8: Configuració pública de Supabase per al navegador

**Files:**
- Modify: `server.js` (afegir una ruta nova)

**Interfaces:**
- Produces: `GET /js/supabase-config.js`, servit dinàmicament amb `SUPABASE_URL` i `SUPABASE_ANON_KEY` (ambdues públiques per disseny: l'anon key és segura d'exposar, protegida per RLS).

- [ ] **Step 1: Afegir la ruta a `server.js`**

Abans de `app.get('/health', ...)`, afegeix:

```javascript
// L'anon key de Supabase és pública per disseny (queda protegida per la
// RLS de cada taula), però no la volem hardcodejada al repositori.
app.get('/js/supabase-config.js', (_req, res) => {
  res.type('application/javascript').send(
    `window.SUPABASE_URL = ${JSON.stringify(process.env.SUPABASE_URL || '')};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.SUPABASE_ANON_KEY || '')};\n`
  );
});
```

- [ ] **Step 2: Verificar**

```bash
curl -s http://localhost:3000/js/supabase-config.js
```

Esperat: dues línies `window.SUPABASE_URL = "..."` i `window.SUPABASE_ANON_KEY = "..."` amb els valors reals de `.env`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "Millora: Serveix la configuracio publica de Supabase per al navegador"
```

---

### Task 9: Helpers de sessió compartits al frontend (esquema `tiquets`)

**Files:**
- Create: `public/js/supabase-client.js`
- Create: `public/js/auth-session.js`

**Interfaces:**
- Consumes: `window.supabase` (UMD global carregat via CDN, vegeu Task 10), `window.SUPABASE_URL`/`window.SUPABASE_ANON_KEY` (Task 8).
- Produces: `window.supabaseClient` (instància), i a `auth-session.js`: `AuthSession.getSession()`, `AuthSession.getAccessToken()`, `AuthSession.getUsuari()`, `AuthSession.onChange(callback)`, `AuthSession.signOut()`, usats per `login-form.js`, `ticket-form.js` i `index.html` (Tasques 11, 13).

- [ ] **Step 1: Escriure `public/js/supabase-client.js`**

```javascript
// Crea el client de Supabase compartit per a totes les pàgines públiques.
// Requereix que la pàgina hagi carregat abans, en aquest ordre:
//   1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
//   2. <script src="/js/supabase-config.js"></script>
//   3. <script src="js/supabase-client.js"></script>
window.supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
```

- [ ] **Step 2: Escriure `public/js/auth-session.js`**

```javascript
// Helpers de sessió compartits, per damunt de window.supabaseClient
// (carregat abans per public/js/supabase-client.js).
window.AuthSession = (function () {
  async function getSession() {
    const { data } = await window.supabaseClient.auth.getSession();
    return data.session || null;
  }

  async function getAccessToken() {
    const session = await getSession();
    return session ? session.access_token : null;
  }

  // Retorna la fila de tiquets.usuaris de l'usuari actual (o null si
  // encara no ha estat aprovat). Nomes funciona amb sessio activa: la RLS
  // permet llegir unicament la propia fila. Requereix que l'esquema
  // `tiquets` estigui afegit a "Exposed schemas" a Supabase (Fase 0).
  async function getUsuari() {
    const session = await getSession();
    if (!session) return null;
    const { data } = await window.supabaseClient
      .schema('tiquets')
      .from('usuaris')
      .select('id, nom, email, actiu')
      .eq('id', session.user.id)
      .maybeSingle();
    return data || null;
  }

  function onChange(callback) {
    window.supabaseClient.auth.onAuthStateChange((_event, session) => callback(session));
  }

  async function signOut() {
    await window.supabaseClient.auth.signOut();
  }

  return { getSession, getAccessToken, getUsuari, onChange, signOut };
})();
```

- [ ] **Step 3: Verificar**

Obre qualsevol pàgina que carregui aquests tres scripts (es fa a la Task 10) amb les eines de desenvolupament del navegador i executa a la consola:

```javascript
AuthSession.getSession().then(console.log)
```

Esperat: `null` (sense haver iniciat sessió encara).

- [ ] **Step 4: Commit**

```bash
git add public/js/supabase-client.js public/js/auth-session.js
git commit -m "Millora: Afegeix els helpers de sessio de Supabase compartits al frontend"
```

---

### Task 10: Pàgina de registre (`registre.html`)

**Files:**
- Create: `public/registre.html`
- Create: `public/js/registre-form.js`
- Create: `public/css/auth.css`

**Interfaces:**
- Consumes: `POST /api/auth/solicituds` (Task 5), `public/js/error-messages.js` (existent).
- Produces: pàgina accessible a `/registre.html`, enllaçada des de `index.html` i `login.html` (Tasques 11 i 13).

- [ ] **Step 1: Escriure `public/css/auth.css`**

```css
@import url("variables.css");

body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at 15% 10%, var(--bg-glow) 0%, transparent 45%),
    var(--bg);
  font-family: var(--font-ui);
  color: var(--ink);
  padding: 20px;
}

.auth-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem;
  max-width: 400px;
  width: 100%;
}

.auth-card .eyebrow {
  font-family: var(--mono);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.auth-card .eyebrow-brand {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff;
  background: var(--brand);
  padding: 3px 7px;
  border-radius: 5px;
}

.auth-card h1 { font-size: 1.2rem; margin: 0.5rem 0 0.25rem; }
.auth-card .subtitle { color: var(--ink-soft); margin: 0 0 1.25rem; font-size: 0.9rem; }

.auth-card label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.25rem; }
.auth-card input, .auth-card textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--input-border);
  border-radius: 6px;
  font-size: 0.95rem;
  margin-bottom: 0.9rem;
  font-family: var(--font-ui);
  background: var(--card);
  color: var(--ink);
}
.auth-card textarea { resize: vertical; min-height: 4.5rem; }

.auth-card button {
  width: 100%;
  background: var(--action);
  color: #fff;
  border: none;
  padding: 0.6rem 1.1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: var(--font-ui);
  cursor: pointer;
  transition: background-color 0.15s ease;
}
.auth-card button:hover { background-color: var(--action-hover); }
.auth-card button:disabled { opacity: 0.6; cursor: progress; }

.auth-card .error { color: #dc2626; font-size: 0.85rem; margin-bottom: 0.75rem; display: none; }
.auth-card .success { color: var(--success); font-size: 0.85rem; margin-bottom: 0.75rem; display: none; }

.auth-card .auth-back-link {
  display: block;
  text-align: center;
  margin-top: 1rem;
  font-size: 0.85rem;
  color: var(--ink-soft);
  text-decoration: none;
}
.auth-card .auth-back-link:hover { color: var(--ink); text-decoration: underline; }
```

- [ ] **Step 2: Escriure `public/registre.html`**

```html
<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sol·licitar accés — Portal de tiquets</title>
<link rel="icon" href="assets/favicon.ico">
<link rel="stylesheet" href="css/auth.css">
</head>
<body>
<div class="auth-card">
  <div class="eyebrow"><span class="eyebrow-brand">UAUU</span> · Portal de tiquets</div>
  <h1>Sol·licitar accés</h1>
  <p class="subtitle">Per crear tiquets cal que un administrador aprovi el teu accés. Emplena aquest formulari i rebràs un correu de confirmació.</p>

  <p class="error" id="formError"></p>
  <p class="success" id="formSuccess"></p>

  <form id="registreForm">
    <label for="nom">Nom</label>
    <input type="text" id="nom" name="nom" autocomplete="name" required>

    <label for="email">Correu</label>
    <input type="email" id="email" name="email" autocomplete="email" required>

    <label for="missatge">Per què vols accés? <span style="font-weight:400">(opcional)</span></label>
    <textarea id="missatge" name="missatge"></textarea>

    <button type="submit" id="submitBtn">Sol·licitar accés</button>
  </form>

  <a href="login.html" class="auth-back-link">Ja tens accés? Inicia sessió</a>
</div>

<script src="js/error-messages.js" defer></script>
<script src="js/registre-form.js" defer></script>
</body>
</html>
```

- [ ] **Step 3: Escriure `public/js/registre-form.js`**

```javascript
const registreForm = document.getElementById('registreForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');

// Si venim del clic al link de verificacio del correu (Task 5:
// GET /api/auth/verificar-email redirigeix aqui amb ?verificat=ok|error).
const verificatParam = new URLSearchParams(window.location.search).get('verificat');
if (verificatParam === 'ok') {
  registreForm.style.display = 'none';
  formSuccess.textContent = 'Correu confirmat. Un administrador revisarà la teva sol·licitud i rebràs un email quan estigui aprovada.';
  formSuccess.style.display = 'block';
} else if (verificatParam === 'error') {
  formError.textContent = 'L\'enllaç de confirmació no és vàlid o ha caducat. Torna a enviar la sol·licitud.';
  formError.style.display = 'block';
}

registreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const nom = registreForm.nom.value.trim();
  const email = registreForm.email.value.trim();
  const missatge = registreForm.missatge.value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviant…';
  try {
    const res = await fetch('/api/auth/solicituds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, missatge })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ERROR_MESSAGES.submitFailed);

    registreForm.style.display = 'none';
    formSuccess.textContent = 'T\'hem enviat un correu de confirmació. Revisa la safata d\'entrada (i la de correu brossa).';
    formSuccess.style.display = 'block';
  } catch (err) {
    formError.textContent = err.message || ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sol·licitar accés';
  }
});
```

- [ ] **Step 4: Verificar**

Amb el servidor arrencat, obre `http://localhost:3000/registre.html`, emplena el formulari i envia'l. Esperat: missatge d'èxit "T'hem enviat un correu..." i, si `RESEND_API_KEY` és vàlida, arribada del correu de verificació.

- [ ] **Step 5: Commit**

```bash
git add public/registre.html public/js/registre-form.js public/css/auth.css
git commit -m "Millora: Afegeix la pagina de sol·licitud d'acces (registre.html)"
```

---

### Task 11: Pàgina de login amb magic link (`login.html`)

**Files:**
- Create: `public/login.html`
- Create: `public/js/login-form.js`

**Interfaces:**
- Consumes: `window.supabaseClient` (Task 9), `AuthSession` (Task 9).
- Produces: pàgina `/login.html`, enllaçada des de `index.html` (Task 13).

- [ ] **Step 1: Escriure `public/login.html`**

```html
<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Inicia sessió — Portal de tiquets</title>
<link rel="icon" href="assets/favicon.ico">
<link rel="stylesheet" href="css/auth.css">
</head>
<body>
<div class="auth-card">
  <div class="eyebrow"><span class="eyebrow-brand">UAUU</span> · Portal de tiquets</div>
  <h1>Inicia sessió</h1>
  <p class="subtitle" id="loginSubtitle">Introdueix el teu correu i et enviarem un enllaç per entrar (sense contrasenya).</p>

  <p class="error" id="formError"></p>
  <p class="success" id="formSuccess"></p>

  <form id="loginForm">
    <label for="email">Correu</label>
    <input type="email" id="email" name="email" autocomplete="email" required>
    <button type="submit" id="submitBtn">Enviar enllaç d'accés</button>
  </form>

  <p id="signedInStatus" style="display:none; font-size:0.9rem; color:var(--ink-soft);"></p>

  <a href="registre.html" class="auth-back-link">Encara no tens accés? Sol·licita'l</a>
  <a href="index.html" class="auth-back-link">← Tornar al portal</a>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="/js/supabase-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth-session.js"></script>
<script src="js/error-messages.js" defer></script>
<script src="js/login-form.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Escriure `public/js/login-form.js`**

```javascript
const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const signedInStatus = document.getElementById('signedInStatus');

async function handleExistingSession() {
  const session = await AuthSession.getSession();
  if (!session) return;

  const usuari = await AuthSession.getUsuari();
  if (usuari && usuari.actiu) {
    window.location.href = 'index.html';
    return;
  }

  loginForm.style.display = 'none';
  signedInStatus.style.display = 'block';
  if (usuari && !usuari.actiu) {
    signedInStatus.textContent = `Sessió iniciada com a ${session.user.email}, però el teu accés ha estat desactivat.`;
  } else {
    signedInStatus.textContent = `Sessió iniciada com a ${session.user.email}, però encara no tens accés aprovat. Sol·licita'l si no ho has fet abans.`;
  }
}

AuthSession.onChange(() => handleExistingSession());
handleExistingSession();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const email = loginForm.email.value.trim();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviant…';
  try {
    const { error } = await window.supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login.html' }
    });
    if (error) throw error;

    loginForm.style.display = 'none';
    formSuccess.textContent = 'T\'hem enviat un enllaç d\'accés al teu correu. Obre\'l des d\'aquest mateix dispositiu.';
    formSuccess.style.display = 'block';
  } catch (err) {
    formError.textContent = ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar enllaç d\'accés';
  }
});
```

- [ ] **Step 3: Verificar**

Obre `http://localhost:3000/login.html`, introdueix un correu d'un usuari ja aprovat (Task 7) i envia. Esperat: "T'hem enviat un enllaç d'accés...". En clicar l'enllaç del correu, tornes a `login.html` amb sessió activa i ets redirigit automàticament a `index.html`.

- [ ] **Step 4: Commit**

```bash
git add public/login.html public/js/login-form.js
git commit -m "Millora: Afegeix la pagina de login amb magic link (login.html)"
```

---

### Task 12: Panell d'aprovació de sol·licituds (`solicituds-admin.html`)

**Files:**
- Create: `public/solicituds-admin.html`
- Create: `public/js/solicituds-admin.js`
- Modify: `public/admin.html` (afegir enllaç de navegació)

**Interfaces:**
- Consumes: patró `admin-auth.js` existent (login amb `ADMIN_TOKEN`), `GET/POST /api/admin/solicituds*` (Task 7).
- Produces: pàgina `/solicituds-admin.html`.

- [ ] **Step 1: Escriure `public/solicituds-admin.html`**

Segueix exactament el mateix patró que `public/admin.html` (mateix `<div id="loginScreen">` + `<div id="adminApp" hidden>` que consumeix `admin-auth.js`):

```html
<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sol·licituds d'accés — Administració</title>
<link rel="icon" href="assets/favicon.ico">
<link rel="stylesheet" href="css/admin.css">
</head>
<body>
<div id="loginScreen" class="login-screen" hidden></div>

<main class="wrap" id="adminApp" hidden>
  <div class="eyebrow">
    <span class="eyebrow-brand">UAUU</span>
    <nav class="crumb-trail">
      <a class="crumb-step" href="index.html"><span class="crumb-label">Portal</span></a>
      <span class="crumb-sep">›</span>
      <a class="crumb-step" href="admin.html"><span class="crumb-label">Repositoris</span></a>
      <span class="crumb-sep">›</span>
      <span class="crumb-step eyebrow-current"><span class="crumb-label">Sol·licituds</span></span>
    </nav>
    <button type="button" class="logout-link" data-logout><span class="logout-text">Tancar sessió</span></button>
  </div>
  <h1>Sol·licituds d'accés</h1>
  <p class="subtitle">Persones que han demanat poder crear tiquets. Només es mostren les que ja han confirmat el seu correu.</p>

  <p class="error" id="solicitudsError"></p>
  <p class="empty" id="solicitudsEmptyMsg" style="display:none;">No hi ha cap sol·licitud pendent.</p>

  <div id="solicitudsList"></div>
</main>

<script src="js/admin-auth.js" defer></script>
<script src="js/solicituds-admin.js" defer></script>
</body>
</html>
```

- [ ] **Step 2: Escriure `public/js/solicituds-admin.js`**

```javascript
const solicitudsList = document.getElementById('solicitudsList');
const solicitudsError = document.getElementById('solicitudsError');
const solicitudsEmptyMsg = document.getElementById('solicitudsEmptyMsg');

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function solicitudCardHtml(s) {
  return `
    <div class="card" data-id="${s.id}">
      <p><strong>${escapeHtml(s.nom)}</strong> — ${escapeHtml(s.email)}</p>
      ${s.missatge ? `<p class="muted">${escapeHtml(s.missatge)}</p>` : ''}
      <div class="form-actions">
        <button type="button" data-accept="${s.id}">Acceptar</button>
        <button type="button" class="secondary" data-reject="${s.id}">Rebutjar</button>
      </div>
    </div>
  `;
}

async function loadSolicituds() {
  solicitudsError.style.display = 'none';
  try {
    const res = await fetch('/api/admin/solicituds', { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const solicituds = await res.json();
    solicitudsEmptyMsg.style.display = solicituds.length ? 'none' : 'block';
    solicitudsList.innerHTML = solicituds.map(solicitudCardHtml).join('');
  } catch (err) {
    solicitudsError.textContent = err.message;
    solicitudsError.style.display = 'block';
  }
}

solicitudsList.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('[data-accept]');
  const rejectBtn = e.target.closest('[data-reject]');
  if (!acceptBtn && !rejectBtn) return;

  const id = (acceptBtn || rejectBtn).dataset.accept || (acceptBtn || rejectBtn).dataset.reject;
  const action = acceptBtn ? 'acceptar' : 'rebutjar';
  if (action === 'rebutjar' && !window.confirm('Segur que vols rebutjar aquesta sol·licitud?')) return;

  try {
    const res = await fetch(`/api/admin/solicituds/${id}/${action}`, { method: 'POST', headers: authHeaders() });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    loadSolicituds();
  } catch (err) {
    solicitudsError.textContent = err.message;
    solicitudsError.style.display = 'block';
  }
});

document.addEventListener('admin-authenticated', loadSolicituds);
```

- [ ] **Step 3: Afegir l'enllaç de navegació a `public/admin.html`**

Al `<nav class="crumb-trail">` existent d'`admin.html`, afegeix un pas nou cap a `solicituds-admin.html` seguint el mateix patró que els altres `<a class="crumb-step">` (llegeix primer l'estructura actual del fitxer per mantenir exactament la mateixa marca — icones SVG incloses — abans de fer l'edició).

- [ ] **Step 4: Verificar**

Obre `http://localhost:3000/solicituds-admin.html`, entra amb `ADMIN_TOKEN`. Esperat: es veu la sol·licitud de prova (Task 5) un cop verificat l'email. Clica "Acceptar": comprova a Supabase (Authentication → Users) que s'ha creat l'usuari, i a `tiquets.usuaris` que hi ha la fila amb `actiu = true`.

- [ ] **Step 5: Commit**

```bash
git add public/solicituds-admin.html public/js/solicituds-admin.js public/admin.html
git commit -m "Millora: Afegeix el panell d'aprovacio de sol·licituds d'acces"
```

---

### Task 13: Gate del formulari de tiquets al portal públic

**Files:**
- Modify: `public/index.html`
- Modify: `public/js/ticket-form.js`
- Modify: `public/css/form.css`

**Interfaces:**
- Consumes: `window.supabaseClient`, `AuthSession` (Task 9).
- Produces: el formulari de creació de tiquets només és visible/enviable amb sessió aprovada; sense sessió, es mostra un avís amb enllaç a `login.html`.

- [ ] **Step 1: Carregar els scripts de Supabase a `public/index.html`**

Abans de `<script src="js/error-messages.js" defer></script>` (línia 163), afegeix:

```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script src="/js/supabase-config.js"></script>
<script src="js/supabase-client.js"></script>
<script src="js/auth-session.js"></script>
```

- [ ] **Step 2: Afegir el bloc d'avís de sessió a `public/index.html`**

Just abans de `<div class="ticket">` (línia 22), afegeix:

```html
<div class="auth-gate" id="authGate" hidden>
  <p id="authGateMessage"></p>
  <a href="login.html" class="auth-gate-link" id="authGateLink">Iniciar sessió</a>
</div>
```

- [ ] **Step 3: Afegir els estils de `.auth-gate` a `public/css/form.css`**

```css
.auth-gate {
  background: var(--surface-soft);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem 1.25rem;
  margin-bottom: 1.5rem;
  text-align: center;
}
.auth-gate p { margin: 0 0 0.6rem; color: var(--ink-soft); font-size: 0.9rem; }
.auth-gate-link {
  display: inline-block;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  background: var(--action);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none;
}
.auth-gate-link:hover { background: var(--action-hover); }
```

- [ ] **Step 4: Afegir la lògica de gate a `public/js/ticket-form.js`**

Al principi del fitxer (abans de `const form = document.getElementById('ticket-form');`), afegeix:

```javascript
const authGate = document.getElementById('authGate');
const authGateMessage = document.getElementById('authGateMessage');
const authGateLink = document.getElementById('authGateLink');
const ticketBlock = document.querySelector('.ticket');

let cachedAccessToken = null;

async function syncAuthGate() {
  const session = await AuthSession.getSession();
  if (!session) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'Cal iniciar sessió per crear un tiquet nou.';
    authGateLink.textContent = 'Iniciar sessió';
    authGateLink.href = 'login.html';
    return;
  }

  const usuari = await AuthSession.getUsuari();
  if (!usuari || !usuari.actiu) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'La teva sol·licitud d\'accés encara no ha estat aprovada per un administrador.';
    authGateLink.textContent = 'Sol·licitar accés';
    authGateLink.href = 'registre.html';
    return;
  }

  cachedAccessToken = session.access_token;
  authGate.hidden = true;
  ticketBlock.hidden = false;
}

AuthSession.onChange(() => syncAuthGate());
syncAuthGate();
```

Després, a la funció que fa la crida `fetch('/api/tickets', ...)` (actualment a `public/js/ticket-form.js:287`), afegeix la capçalera d'autorització:

```javascript
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: cachedAccessToken ? { Authorization: `Bearer ${cachedAccessToken}` } : {},
      body: formData
    });
```

- [ ] **Step 5: Verificar**

Sense sessió: obre `http://localhost:3000/`, esperat: es veu l'avís "Cal iniciar sessió..." i el bloc del formulari (`.ticket`) queda amagat. Amb sessió (Task 11): el formulari es veu normal i, en enviar-lo, la petició `POST /api/tickets` inclou la capçalera `Authorization: Bearer ...` (comprovable a la pestanya Network del navegador) i el tiquet es crea correctament, exactament igual que abans (GitHub Issue + `tickets.json`).

- [ ] **Step 6: Commit**

```bash
git add public/index.html public/js/ticket-form.js public/css/form.css
git commit -m "Millora: Restringeix la creacio de tiquets a usuaris amb sessio aprovada"
```

---

### Task 14: Polish — enllaços de navegació i pàgina d'ajuda

**Files:**
- Modify: `public/index.html` (enllaç a `login.html` a la capçalera, amb estat dinàmic)
- Create: `public/ajuda-acces.html`

**Interfaces:**
- Consumes: `AuthSession` (Task 9); reutilitza la lògica ja escrita a `syncAuthGate()` (Task 13).

- [ ] **Step 1: Afegir l'enllaç de login/logout a la capçalera d'`index.html`**

Dins de `<header class="page-head">`, sota l'enllaç existent `<a href="tickets.html" class="tickets-link">Veure tiquets oberts →</a>` (línia 19), afegeix:

```html
<a href="login.html" class="tickets-link" id="headerLoginLink">Iniciar sessió →</a>
```

- [ ] **Step 2: Actualitzar `syncAuthGate()` a `public/js/ticket-form.js` perquè també sincronitzi aquest enllaç**

Amplia la funció escrita a la Task 13 (Step 4) perquè, a cada branca, també actualitzi `headerLoginLink`:

```javascript
const headerLoginLink = document.getElementById('headerLoginLink');

async function syncAuthGate() {
  const session = await AuthSession.getSession();
  if (!session) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'Cal iniciar sessió per crear un tiquet nou.';
    authGateLink.textContent = 'Iniciar sessió';
    authGateLink.href = 'login.html';
    headerLoginLink.textContent = 'Iniciar sessió →';
    headerLoginLink.onclick = null;
    headerLoginLink.href = 'login.html';
    return;
  }

  const usuari = await AuthSession.getUsuari();
  if (!usuari || !usuari.actiu) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'La teva sol·licitud d\'accés encara no ha estat aprovada per un administrador.';
    authGateLink.textContent = 'Sol·licitar accés';
    authGateLink.href = 'registre.html';
    headerLoginLink.textContent = 'Iniciar sessió →';
    headerLoginLink.onclick = null;
    headerLoginLink.href = 'login.html';
    return;
  }

  cachedAccessToken = session.access_token;
  authGate.hidden = true;
  ticketBlock.hidden = false;
  headerLoginLink.textContent = `Tancar sessió (${usuari.nom}) →`;
  headerLoginLink.href = '#';
  headerLoginLink.onclick = (e) => { e.preventDefault(); AuthSession.signOut(); };
}
```

(Aquest bloc **reemplaça** la funció `syncAuthGate` escrita a la Task 13, no se n'afegeix una segona.)

- [ ] **Step 3: Escriure `public/ajuda-acces.html`**

Pàgina estàtica curta (sense JS) que explica als treballadors, en català senzill, els passos per obtenir accés.

```html
<!DOCTYPE html>
<html lang="ca">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Com accedir al portal — Ajuda</title>
<link rel="icon" href="assets/favicon.ico">
<link rel="stylesheet" href="css/auth.css">
</head>
<body>
<div class="auth-card" style="max-width: 480px;">
  <div class="eyebrow"><span class="eyebrow-brand">UAUU</span> · Portal de tiquets</div>
  <h1>Com accedir al portal</h1>
  <p class="subtitle">
    1. Ves a <a href="registre.html">Sol·licitar accés</a> i emplena el formulari amb el teu nom i correu.<br><br>
    2. Rebràs un correu per confirmar que l'adreça és teva. Clica l'enllaç.<br><br>
    3. Un administrador revisarà la sol·licitud. Quan l'aprovi, et arribarà un correu de Supabase amb un enllaç per accedir.<br><br>
    4. A partir d'aquí, ves a <a href="login.html">Iniciar sessió</a>, escriu el teu correu i rebràs un enllaç per entrar — no cal cap contrasenya.
  </p>
  <a href="index.html" class="auth-back-link">← Tornar al portal</a>
</div>
</body>
</html>
```

- [ ] **Step 4: Verificar**

Navega manualment `index.html → registre.html → ajuda-acces.html → login.html` comprovant que tots els enllaços funcionen i que l'estat de sessió a la capçalera d'`index.html` canvia correctament en iniciar/tancar sessió.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/ticket-form.js public/ajuda-acces.html
git commit -m "Millora: Afegeix enllacos de login/registre a la capcalera i una pagina d'ajuda d'acces"
```

---

## Self-Review (fet en escriure el pla)

**Cobertura de l'spec original i de les correccions acordades amb l'usuari:**
- Fase 0 (infraestructura) → Task 1 (SQL, esquema `tiquets`) + Task 2 (deps/env), amb els passos manuals (incloent SMTP personalitzat i "Exposed schemas") documentats per separat.
- Fase 1 (model de dades) → Task 1 (`tiquets.solicituds_registre`, `tiquets.usuaris`, `tiquets.heartbeat`). **Sense taula `issues`**: decisió explícita de l'usuari de mantenir els tiquets a GitHub, tal com ja funciona.
- Fase 2 (sol·licitud + verificació + notificació admin) → Task 5 (rutes), Task 4 (emails), Task 10 (formulari).
- Fase 3 (panell d'aprovació) → Task 7 (endpoints) + Task 12 (UI). **Sense rol `admin` a Supabase**: decisió explícita de l'usuari de reutilitzar `ADMIN_TOKEN`/`requireAdmin`.
- Fase 4 (magic link) → Task 9 (helpers) + Task 11 (login.html), incloent el cas "email no aprovat encara". SMTP personalitzat (Resend) i plantilles en català documentats a la Fase 0.
- Fase 5 (control d'accés a la creació) → Task 6 (middleware backend) + Task 13 (gate frontend), sense tocar res del flux GitHub Issues existent.
- Fase 6 (polish) → Task 14 (ajuda, enllaços) + heartbeat ja cobert a Task 1 + notificació a múltiples admins ja coberta a `ADMIN_NOTIFY_EMAILS` (Task 4/2).

**Placeholders:** cap `TODO`/"handle errors"/"similar to Task N" sense codi — revisat.

**Consistència de tipus/noms:** `tiquets(client)` de `lib/supabase.js` es fa servir amb el mateix nom a `routes/auth.js`, `middleware/require-approved-user.js` i `routes/admin.js`. `getAccessToken`/`getSession`/`getUsuari`/`onChange`/`signOut` a `AuthSession` es fan servir amb els mateixos noms a `login-form.js` i `ticket-form.js`. `requireApprovedUser` exporta una única funció, consistent amb `routes/tickets.js`.

---

Pla actualitzat i desat a `docs/superpowers/plans/2026-08-11-acces-controlat-issues.md`. Segueix pendent la **Fase 0** (la fas tu). Un cop tinguis les dades, dues opcions d'execució:

1. **Subagent-Driven (recomanat)** — despatxo un subagent nou per tasca, reviso entre tasques.
2. **Inline Execution** — executo les tasques en aquesta mateixa sessió, per lots amb punts de control.
