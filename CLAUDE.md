# CLAUDE.md - tiquets-issues (github-ticket-portal)

## 1. Descripció del projecte
Portal intern de tiquets que crea issues de GitHub automàticament.

## 2. Stack tècnic
- **Backend:** Node.js + Express (`server.js` com a punt d'entrada).
- **Altres dependències:** dotenv, express-rate-limit, @supabase/supabase-js, resend, multer, ws. (`nodemailer` continua instal·lat per `lib/mailer.js`, la via SMTP opcional que no s'utilitza en producció — vegeu la secció 5.)
- **Frontend:** servit des de `/public`, sense build step (HTML/CSS/JS servits directament).
- **Autenticació d'usuaris del portal:** Supabase Auth (correu + contrasenya), amb aprovació manual d'accés per part d'un administrador.

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
│   ├── login.html         # Login per correu+contrasenya (usuaris i, amb correu "admin", accés d'administració)
│   ├── crear-contrasenya.html # Estableix la contrasenya (des de l'enllaç d'invitació o de recuperació)
│   ├── compte.html        # "El meu compte": canvi de contrasenya amb sessió activa
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

### Accés d'usuaris al portal (Supabase Auth, correu + contrasenya)
- L'accés al formulari de tiquets requereix sessió: **registre.html** (sol·licitud amb nom+email) → correu de verificació via Resend (`routes/auth.js`, `lib/resend.js`) → un administrador aprova/rebutja la sol·licitud des de **solicituds-admin.html** (protegit per `ADMIN_TOKEN`, no per Supabase Auth) → en aprovar-la, `routes/admin.js` crida `supabaseAdmin.auth.admin.createUser()` (sense contrasenya) i `supabaseAdmin.auth.admin.generateLink({type:'invite'})`, i envia l'enllaç amb un correu propi (`sendSetPasswordEmail`, via Resend — **no** el correu natiu de Supabase) perquè l'usuari creï la seva contrasenya a **crear-contrasenya.html**. També insereix una fila a `tiquets.usuaris` (`actiu: true`).
- Un cop té contrasenya, l'usuari inicia sessió a **login.html** amb correu+contrasenya (`signInWithPassword`), gestionat pel client de `public/js/supabase-client.js` i els helpers de `public/js/auth-session.js`.
- Recuperació de contrasenya: des de login.html ("Has oblidat la contrasenya?") → `POST /api/auth/recuperar-contrasenya` → `generateLink({type:'recovery'})` + `sendPasswordRecoveryEmail` (Resend) → mateixa pàgina **crear-contrasenya.html**. La resposta d'aquest endpoint és sempre genèrica (no revela si el correu existeix).
- Canvi de contrasenya amb sessió activa: **compte.html**, exigeix reintroduir la contrasenya actual (re-autenticació silenciosa amb `signInWithPassword` abans de `updateUser`).
- Totes les taules pròpies viuen a l'esquema `tiquets` de Supabase (mai `public`), compartit amb l'app "compras". Cal tenir l'esquema `tiquets` a "Exposed schemas" perquè les consultes des del navegador (protegides per RLS) funcionin.
- Al Dashboard de Supabase (Authentication → Settings) la longitud mínima de contrasenya s'ha de pujar a 8 (el validador del client ja exigeix 8, però el mínim per defecte de Supabase és 6).

### Login d'administració (compte `digital@uauu.cat`, sense `ADMIN_TOKEN`)
- Ja no existeix `ADMIN_TOKEN`: l'administrador és un usuari normal del portal (compte real de Supabase Auth, `digital@uauu.cat`, amb la seva pròpia contrasenya), aprovat com qualsevol altre (`registre.html` + `solicituds-admin.html`, o creat directament pel propi admin). Inicia sessió des de **login.html** igual que tothom.
- `/admin.html`, `/tickets-admin.html` i `/solicituds-admin.html` es protegeixen amb `public/js/admin-auth.js`: comprova la sessió activa de Supabase i que el correu sigui exactament `digital@uauu.cat`; si no, redirigeix a `login.html`. Mentre hi ha sessió vàlida, desa l'access token a `window.adminAccessToken` perquè `admin.js`, `solicituds-admin.js` i `tickets-admin/state.js` l'enviïn com a `Authorization: Bearer` a les crides `/api/admin/*`.
- La protecció real al backend és `middleware/require-admin.js`: exigeix `Authorization: Bearer <access_token>` de Supabase i que el correu de l'usuari sigui `digital@uauu.cat` (constant al mateix fitxer). Ja no hi ha cap token compartit — l'accés d'admin està lligat a aquest únic compte de Supabase Auth.
- La icona d'administració que es mostra al portal (`index.html`, `adminLink`) apareix si el correu de la sessió activa és a `ADMIN_NOTIFY_EMAILS` (`window.ADMIN_EMAILS`) — és només un ajut de navegació (mostra/amaga la icona), no dona per si sol accés a l'admin.
- Com que és el mateix compte per a tot, entrar amb `digital@uauu.cat` dona accés tant al portal de tiquets com a l'administració, sense tancar cap sessió en passar de l'un a l'altre.
- El servidor de producció (Servatica) té el seu **propi `.env`**, gestionat des del panell "Setup Node.js App" → cal actualitzar-lo (i reiniciar l'app) allà si es canvia el token, no n'hi ha prou amb canviar el `.env` local.

### Notificacions de tiquets nous
- **No s'envia cap correu des del portal per avisar d'un tiquet nou.** Es va provar SMTP (Microsoft 365) i després Resend per a aquest cas concret, però es va descartar: el tenant de M365 de UAUU té l'autenticació SMTP bàsica desactivada per política ("SmtpClientAuthentication is disabled for the Tenant"), i Resend en mode de proves només permet enviar a l'adreça del compte registrat (calia verificar el domini `uauu.cat`, que es va decidir evitar en aquell moment). *Nota: Resend es va acabar activant més endavant, però només per als correus del sistema d'accés d'usuaris (verificació de registre, avís de sol·licituds pendents, rebuig) — no per a l'avís de tiquets nous, que continua sense correu.*
- **Solució adoptada per a l'avís de tiquets nous:** notificacions natives de GitHub. Cal tenir en compte que **GitHub mai notifica al mateix compte que crea la issue**. Per això les issues es creen amb el token d'un compte diferent (`UauuBot`, afegit com a col·laborador als repositoris), i el compte `UauuDigital` és qui les vigila (Watch → All Activity) i rep l'avís per correu/web.
- El `GITHUB_TOKEN` de l'`.env` ha de ser sempre d'un compte **diferent** del compte que fa Watch als repositoris, o mai arribaran notificacions.
- Token actual: classic PAT (`ghp_...`) del compte `UauuBot`, scope `public_repo`. Es va provar amb un token fine-grained però l'opció "Only select repositories" no apareixia per a un compte sense repositoris propis; el classic amb `public_repo` és la solució que funciona.
- Hi ha també una via SMTP opcional i independent (`lib/mailer.js`, `notifyByEmail`) que envia un correu addicional si s'omplen `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`NOTIFY_EMAIL` a `.env`. Actualment buides en producció, per tant no s'hi envia res; es deixa documentada per si es reactiva.
- **Si algun dia es vol substituir (o complementar) l'avís de GitHub per un correu propi via Resend** (per exemple perquè algú sense compte de GitHub necessiti rebre l'avís): el domini `uauu.cat` ja està verificat a Resend i `RESEND_API_KEY`/`ADMIN_NOTIFY_EMAILS` ja existeixen a `.env`, així que només caldria afegir una funció tipus `sendTicketNotificationEmail` a `lib/resend.js` i cridar-la des de `routes/tickets.js` en crear la issue (substituint o afegint-se a la crida a `notifyByEmail`). Cal recordar afegir també `RESEND_FROM_EMAIL` amb una adreça del domini verificat (p. ex. `tiquets@uauu.cat`) si encara no hi és a l'entorn de Servatica. Aquesta via es va arribar a implementar i provar puntualment (2026-09-08) però es va revertir perquè la notificació de GitHub ja era suficient.

### Captures de pantalla dels tiquets
- Les captures es pengen sempre a un repositori de GitHub dedicat i fix (`SCREENSHOTS_REPO_OWNER`/`SCREENSHOTS_REPO_NAME` a `.env`, actualment `UauuDigital/tiquet-assets`), **no** al repositori del projecte a qui pertany el tiquet. Abans es pujaven al repo del propi projecte, cosa que feia que obrir un tiquet contra `tiquets-issues` (o qualsevol altre repo clonat en local) generés un commit directe al `main` i obligués a fer `git pull`.
- `UauuBot` ha de ser col·laborador amb permís d'escriptura d'aquest repositori d'adjunts, igual que ho és de la resta de repositoris de projectes.
- En eliminar un tiquet (manualment des de `tickets-admin.html` o automàticament al cap de 14 dies via `lib/auto-delete.js`), també s'esborren les seves captures del repositori d'adjunts (`deleteScreenshotFromGithub` a `lib/github-api.js`).

### Categories i prioritat del formulari
- Categories disponibles (`public/index.html` i `CATEGORY_LABELS` a `lib/labels.js`): Error/no funciona, Petició de funcionalitat, Accés i permisos, Altres. (S'ha eliminat "Suport tècnic".)
- La prioritat es tria amb un lliscador (slider), no amb xips de botó — canvi fet perquè l'usuari ho volia més "dinàmic".
