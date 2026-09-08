# CLAUDE.md - tiquets-issues (github-ticket-portal)

## 1. Descripció del projecte
Portal intern de tiquets que crea issues de GitHub automàticament.

## 2. Stack tècnic
- **Backend:** Node.js + Express (`server.js` com a punt d'entrada).
- **Altres dependències:** dotenv, express-rate-limit, @supabase/supabase-js, resend, multer, ws. (`nodemailer` continua instal·lat per `lib/mailer.js`, la via SMTP opcional que no s'utilitza en producció — vegeu la secció 5.)
- **Frontend:** servit des de `/public`, sense build step (HTML/CSS/JS servits directament).
- **Autenticació d'usuaris del portal:** Supabase Auth (magic link / OTP, sense contrasenya), amb aprovació manual d'accés per part d'un administrador.

> Pendent de confirmar amb l'usuari si aquest stack és definitiu o si es preveu ampliar-lo.

## 3. Estructura de carpetes
```
/tiquets-issues
├── /public
│   ├── /css              # variables.css + un fitxer per component (importats des de main.css/admin.css/tickets.css)
│   ├── /js
│   │   ├── ticket-form.js, error-messages.js, custom-select.js, admin-auth.js, admin.js
│   │   ├── supabase-client.js, auth-session.js   # sessió Supabase compartida
│   │   ├── login-form.js, registre-form.js, solicituds-admin.js
│   │   ├── /tickets-admin   # mòduls del tauler d'administració (state, urgency, board, modal, activity, main)
│   │   ├── /tickets-view    # mòduls del llistat públic de tiquets (mateixa divisió)
│   │   └── /tickets-shared  # lògica compartida entre els dos taulers (board-core.js)
│   ├── /assets            # favicon.ico (corporatiu, còpia de UAUU/_shared-assets)
│   ├── index.html         # Formulari públic de tiquets
│   ├── tickets.html       # Llistat públic de tiquets
│   ├── tickets-admin.html # Gestió de tiquets (estat, prioritat, comentaris)
│   ├── admin.html         # Gestió de repositoris connectats
│   ├── login.html         # Login per magic link/OTP (Supabase Auth)
│   ├── registre.html      # Sol·licitud d'accés d'un usuari nou
│   ├── solicituds-admin.html # Aprovació/rebuig de sol·licituds d'accés (ADMIN_TOKEN)
│   └── ajuda-acces.html   # Pàgina d'ajuda sobre l'accés
├── /routes
│   ├── tickets.js         # Rutes públiques (/api/tickets, /api/activity, /api/repos)
│   ├── admin.js           # Rutes protegides per ADMIN_TOKEN (/api/admin/*)
│   └── auth.js            # Sol·licitud i verificació de correu d'accés (/api/auth/*)
├── /lib
│   └── github-api.js, labels.js, comments.js, date.js, mailer.js, auto-delete.js, supabase.js, resend.js
├── /middleware
│   └── require-admin.js, require-approved-user.js
├── server.js              # Punt d'entrada de l'aplicació
├── repos.config.js, repos.json, repos.store.js
├── tickets.json, tickets.store.js
├── activity.json, activity.store.js
├── .env                   # Variables d'entorn (NO versionat)
├── .env.example           # Plantilla de variables d'entorn
├── .gitignore
├── package.json
└── README.md
```

`--font-ui: 'Inter', system-ui, 'Segoe UI', sans-serif` definida a `public/css/variables.css` i aplicada a `body` (regla 4 de les regles globals de UAUU). `admin.css` també importa `variables.css` per compartir-la.

## 4. Variables d'entorn
Veure `.env.example` per a la llista actualitzada de variables necessàries.

## 5. Notes específiques del projecte

### Accés d'usuaris al portal (Supabase Auth)
- L'accés al formulari de tiquets requereix sessió: **registre.html** (sol·licitud amb nom+email) → correu de verificació via Resend (`routes/auth.js`, `lib/resend.js`) → un administrador aprova/rebutja la sol·licitud des de **solicituds-admin.html** (protegit per `ADMIN_TOKEN`, no per Supabase Auth) → en aprovar-la, `routes/admin.js` crida `supabaseAdmin.auth.admin.inviteUserByEmail()` (crea l'usuari a Supabase Auth) i insereix una fila a `tiquets.usuaris` (`actiu: true`).
- Un cop aprovat, l'usuari inicia sessió a **login.html** amb un magic link / OTP per correu (sense contrasenya), gestionat pel client de `public/js/supabase-client.js` i els helpers de `public/js/auth-session.js`.
- Totes les taules pròpies viuen a l'esquema `tiquets` de Supabase (mai `public`), compartit amb l'app "compras". Cal tenir l'esquema `tiquets` a "Exposed schemas" perquè les consultes des del navegador (protegides per RLS) funcionin.
- **Aquest sistema és independent del login d'administració (`ADMIN_TOKEN`)** descrit al punt següent: un usuari aprovat pot crear tiquets, però no pot entrar a `/admin.html` ni `/tickets-admin.html` sense el token separat.

### Login d'administració (`ADMIN_TOKEN`)
- `/admin.html`, `/tickets-admin.html` i `/solicituds-admin.html` estan protegits per un token compartit únic (`ADMIN_TOKEN` a `.env`), verificat via `GET /api/admin/verify` amb la capçalera `x-admin-token` (`public/js/admin-auth.js`, `middleware/require-admin.js`). No hi ha usuaris/rols diferenciats en aquesta capa.
- El servidor de producció (Servatica) té el seu **propi `.env`**, gestionat des del panell "Setup Node.js App" → cal actualitzar-lo (i reiniciar l'app) allà si es canvia el token, no n'hi ha prou amb canviar el `.env` local.

### Notificacions de tiquets nous
- **No s'envia cap correu des del portal per avisar d'un tiquet nou.** Es va provar SMTP (Microsoft 365) i després Resend per a aquest cas concret, però es va descartar: el tenant de M365 de UAUU té l'autenticació SMTP bàsica desactivada per política ("SmtpClientAuthentication is disabled for the Tenant"), i Resend en mode de proves només permet enviar a l'adreça del compte registrat (calia verificar el domini `uauu.cat`, que es va decidir evitar en aquell moment). *Nota: Resend es va acabar activant més endavant, però només per als correus del sistema d'accés d'usuaris (verificació de registre, avís de sol·licituds pendents, rebuig) — no per a l'avís de tiquets nous, que continua sense correu.*
- **Solució adoptada per a l'avís de tiquets nous:** notificacions natives de GitHub. Cal tenir en compte que **GitHub mai notifica al mateix compte que crea la issue**. Per això les issues es creen amb el token d'un compte diferent (`UauuBot`, afegit com a col·laborador als repositoris), i el compte `UauuDigital` és qui les vigila (Watch → All Activity) i rep l'avís per correu/web.
- El `GITHUB_TOKEN` de l'`.env` ha de ser sempre d'un compte **diferent** del compte que fa Watch als repositoris, o mai arribaran notificacions.
- Token actual: classic PAT (`ghp_...`) del compte `UauuBot`, scope `public_repo`. Es va provar amb un token fine-grained però l'opció "Only select repositories" no apareixia per a un compte sense repositoris propis; el classic amb `public_repo` és la solució que funciona.
- Hi ha també una via SMTP opcional i independent (`lib/mailer.js`, `notifyByEmail`) que envia un correu addicional si s'omplen `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`NOTIFY_EMAIL` a `.env`. Actualment buides en producció, per tant no s'hi envia res; es deixa documentada per si es reactiva.
- **Si algun dia es vol substituir (o complementar) l'avís de GitHub per un correu propi via Resend** (per exemple perquè algú sense compte de GitHub necessiti rebre l'avís): el domini `uauu.cat` ja està verificat a Resend i `RESEND_API_KEY`/`ADMIN_NOTIFY_EMAILS` ja existeixen a `.env`, així que només caldria afegir una funció tipus `sendTicketNotificationEmail` a `lib/resend.js` i cridar-la des de `routes/tickets.js` en crear la issue (substituint o afegint-se a la crida a `notifyByEmail`). Cal recordar afegir també `RESEND_FROM_EMAIL` amb una adreça del domini verificat (p. ex. `tiquets@uauu.cat`) si encara no hi és a l'entorn de Servatica. Aquesta via es va arribar a implementar i provar puntualment (2026-09-08) però es va revertir perquè la notificació de GitHub ja era suficient.

### Categories i prioritat del formulari
- Categories disponibles (`public/index.html` i `CATEGORY_LABELS` a `lib/labels.js`): Error/no funciona, Petició de funcionalitat, Accés i permisos, Altres. (S'ha eliminat "Suport tècnic".)
- La prioritat es tria amb un lliscador (slider), no amb xips de botó — canvi fet perquè l'usuari ho volia més "dinàmic".
