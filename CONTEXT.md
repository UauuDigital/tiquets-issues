## github-ticket-portal (tiquets-issues)

**Propòsit**
Portal intern de UAUU on qualsevol treballador (sense compte de GitHub) obre un tiquet des d'un formulari web, que es converteix automàticament en una issue al repositori de GitHub triat. Inclou un tauler d'administració per gestionar l'estat/prioritat dels tiquets i un sistema d'accés controlat per usuaris.

**Estat**
Desenvolupament/producció activa. Últim commit (`a0bbcd4`, branca `main`): documentació de l'opció de Resend per a l'avís de tiquets nous (2026-09-08). No hi ha indicació de branca de desplegament separada; es desplega des de `main`.

**Stack tècnic**
- Llenguatge/framework: Node.js (≥18) + Express (`server.js`)
- Base de dades: No hi ha BD pròpia per als tiquets (viuen com a issues de GitHub; `tickets.json`/`repos.json`/`activity.json` són còpies locals no versionades). Supabase (PostgreSQL, esquema `tiquets`) només per a l'accés d'usuaris (Auth + taula `tiquets.usuaris`)
- Hosting/desplegament: Servatica (panell "Setup Node.js App"), amb `.env` propi al servidor de producció
- Gestor de paquets: npm

**Punt d'entrada**
`npm start` (executa `node server.js`). Servidor escolta al `PORT` (per defecte 3000). Frontend servit directament des de `/public` (sense build step).

**Interfícies que EXPOSA cap a fora**
- `POST /api/tickets` — crea un tiquet nou (issue de GitHub); rate limit i requereix usuari aprovat (`requireApprovedUser`)
- `GET /api/tickets`, `GET /api/tickets/next-number`, `GET /api/tickets/:id/comments`, `POST /api/tickets/:id/comments` — llistat i comentaris públics de tiquets
- `GET /api/repos`, `GET /api/activity` — llistat públic de repositoris connectats i activitat
- `POST /api/auth/solicituds`, `GET /api/auth/verificar-email` — sol·licitud i verificació d'accés d'usuari
- `/api/admin/*` (routes/admin.js) — gestió completa (tiquets, repos, usuaris, sol·licituds, activitat); protegit per capçalera `x-admin-token` (`ADMIN_TOKEN`), verificat via `GET /api/admin/verify`
- Autenticació d'usuaris del portal (no de l'API): Supabase Auth (magic link/OTP)
- No s'exposen fitxers CSV ni exports per a altres sistemes

**Dependències EXTERNES que aquest projecte CONSUMEIX**
- Projecte de Supabase **compartit amb l'app "compras"** (mateix projecte, esquema `tiquets` propi, aïllat de `public`) — referenciat a `CLAUDE.md` i `.env.example`
- API de GitHub (crea/gestiona issues; requereix comptes `UauuBot` i `UauuDigital` amb rols diferenciats per token)
- Resend (resend.com) — enviament de correus del sistema d'accés (verificació de registre, avís de sol·licituds pendents, rebuig); domini `uauu.cat` ja verificat
- SMTP opcional (Microsoft 365 o altre) via `lib/mailer.js` — actualment inactiu en producció

**Dades compartides**
Projecte Supabase compartit amb l'app "compras" (mateix compte/projecte, esquema `tiquets` separat de `public`). Cap altra base de dades ni bucket compartit identificat.

**Variables d'entorn rellevants per integració**
- `GITHUB_TOKEN`, `GITHUB_ADMIN_TOKEN`
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFY_EMAILS`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL` (opcional, actualment buides)
- `PUBLIC_BASE_URL`
- `ADMIN_TOKEN` (secret propi, no apunta a servei extern, però controla integració amb el tauler admin)

**Pendents/TODOs coneguts relacionats amb integració**
- `CLAUDE.md` documenta que es podria afegir `sendTicketNotificationEmail` a `lib/resend.js` per notificar tiquets nous per correu (via Resend), com a alternativa/complement a les notificacions natives de GitHub. Es va implementar puntualment el 2026-09-08 però es va revertir; caldria tornar a afegir `RESEND_FROM_EMAIL` a l'entorn de Servatica si es reactiva.
- No determinat si hi ha previsió d'ampliar el stack (README/CLAUDE.md ho marquen com "pendent de confirmar amb l'usuari").
