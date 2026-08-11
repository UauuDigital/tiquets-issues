# Portal de tiquets → GitHub Issues

Pàgina web perquè qualsevol treballador (sense compte de GitHub) pugui obrir un
tiquet, i que es converteixi automàticament en un **issue** al repositori que
tu triïs. Inclou també un tauler d'administració per gestionar l'estat i la
prioritat dels tiquets, i una pàgina per connectar/gestionar els repositoris.

```
Formulari (public/index.html) → POST /api/tickets → routes/tickets.js → API de GitHub → nou issue
```

El token de GitHub només viu al servidor; mai s'envia al navegador.

## Requisits previs

- Node.js 18 o superior
- Un compte de GitHub per crear els tiquets (recomanat: un compte dedicat,
  vegeu la secció de notificacions més avall) i, opcionalment, un altre
  compte propietari dels repositoris per gestionar-los des de l'admin

## Instal·lació (primer cop)

1. Clona el repositori
2. `npm install`
3. Copia `.env.example` a `.env` i omple els valors reals (vegeu la taula
   de variables d'entorn més avall)

### Crear el token de GitHub (`GITHUB_TOKEN`)

Recomanat: un token **fine-grained** (accés mínim, només al repo de tiquets):

1. Ves a [https://github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
2. **Resource owner**: la teva organització (o el teu usuari)
3. **Repository access**: "Only select repositories" → tria el repo on vols
   que apareguin els tiquets
4. **Permissions → Repository permissions → Issues**: `Read and write`
5. Genera el token i enganxa'l a `.env` com a `GITHUB_TOKEN`

Si l'organització requereix aprovació d'administrador per a tokens
fine-grained, també pots fer servir un token clàssic amb l'scope `repo`
(o `public_repo` si el repositori és públic), encara que dona més permisos
dels estrictament necessaris.

Els repositoris disponibles (nom visible + owner/repo de GitHub) NO es
configuren per variables d'entorn: es gestionen en calent des de
`/admin.html` (protegit per `ADMIN_TOKEN`) i es desen a `repos.json`.

## Execució (dia a dia)

```bash
npm start
```

- Formulari públic: [http://localhost:3000](http://localhost:3000)
- Llistat públic de tiquets: `http://localhost:3000/tickets.html`
- Gestió de tiquets (requereix `GITHUB_ADMIN_TOKEN` + `ADMIN_TOKEN`): `http://localhost:3000/tickets-admin.html`
- Gestió de repositoris (requereix `ADMIN_TOKEN`): `http://localhost:3000/admin.html`

Cada tiquet enviat crea un issue nou al repositori triat, amb etiquetes de
categoria i prioritat.

## Variables d'entorn

| Variable | Descripció |
|---|---|
| `GITHUB_TOKEN` | Token del compte que crea les issues i comentaris públics. Ha de ser un compte **diferent** del que fa Watch als repositoris (vegeu "Notificacions" més avall). Permís mínim: `Issues: Read and write` al repo de tiquets. |
| `GITHUB_ADMIN_TOKEN` | Token del compte **propietari real** dels repositoris, usat només des de `/tickets-admin.html` per canviar estat/prioritat i eliminar tiquets (GitHub només permet eliminar issues des del propietari, no des d'un col·laborador). |
| `ADMIN_TOKEN` | Cadena secreta pròpia (no és un token de GitHub) que protegeix `/admin.html`, `/tickets-admin.html` i les rutes `/api/admin/*`. Sense això, la gestió queda desactivada. |
| `PORT` | Port on escolta el servidor. Opcional, per defecte `3000`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL` | Opcionals: si s'omplen totes cinc, cada tiquet nou envia també un correu. Actualment **no s'utilitzen** en producció (vegeu "Notificacions" més avall); es deixen documentades per si es reactiven en el futur. |

## Notificacions de tiquets nous

No s'envia cap correu des del portal en producció (SMTP i Resend es van
provar i descartar; vegeu `CLAUDE.md`). La solució adoptada són les
**notificacions natives de GitHub**: GitHub mai notifica al mateix compte
que crea la issue, així que `GITHUB_TOKEN` ha de ser d'un compte diferent
del que fa Watch (→ All Activity) als repositoris connectats.

## Deploy

Qualsevol servei que executi Node.js funciona:

- **Render / Railway / Fly.io**: connecta el repositori, defineix les
  variables d'entorn al panell del servei, i el desplegament és automàtic.
- **Servidor propi / VPS intern**: `npm install && npm start` darrere d'un
  reverse proxy (nginx) amb HTTPS.

No cal exposar cap port de GitHub ni donar accés al repositori als
treballadors: només visiten la teva URL.

## Notes de seguretat

- El formulari públic no porta login, així que ja inclou un **honeypot**
  anti-bots i un **límit de 10 tiquets per IP cada 15 minuts** (20
  comentaris per IP cada 15 minuts). Si hi ha abús, considera afegir un
  CAPTCHA o posar-lo darrere de la xarxa interna / VPN de l'empresa.
- `GITHUB_TOKEN` només ha de tenir accés al(s) repositori(s) de tiquets,
  mai a tota l'organització.
- No es guarda cap dada en una base de dades: els tiquets viuen com a
  issues de GitHub; `tickets.json`, `repos.json` i `activity.json` només en
  són una còpia local (no versionada) per a l'admin.

## Estructura del projecte

```
tiquets-issues/
├── public/
│   ├── css/              # variables.css + un fitxer per component (importats des de main.css/admin.css/tickets.css)
│   ├── js/
│   │   ├── ticket-form.js, error-messages.js, custom-select.js, admin-auth.js
│   │   ├── tickets-admin/  # mòduls del tauler d'administració (state, urgency, board, modal, activity, main)
│   │   └── tickets-view/   # mòduls del llistat públic de tiquets (mateixa divisió)
│   ├── assets/            # favicon.ico (corporatiu)
│   ├── index.html         # Formulari públic de tiquets
│   ├── tickets.html        # Llistat públic de tiquets
│   ├── tickets-admin.html  # Gestió de tiquets (estat, prioritat, comentaris)
│   └── admin.html          # Gestió de repositoris connectats
├── routes/
│   ├── tickets.js          # Rutes públiques (/api/tickets, /api/activity, /api/repos)
│   └── admin.js             # Rutes protegides per ADMIN_TOKEN (/api/admin/*)
├── lib/
│   ├── github-api.js, labels.js, comments.js, date.js, mailer.js, auto-delete.js
├── middleware/
│   └── require-admin.js
├── server.js               # Punt d'entrada: setup d'Express i muntatge dels routers
├── repos.config.js, repos.json, repos.store.js
├── tickets.json, tickets.store.js
├── activity.json, activity.store.js
├── .env / .env.example
└── package.json
```
