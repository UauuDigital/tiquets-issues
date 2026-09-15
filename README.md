# Portal de tiquets → GitHub Issues

Pàgina web perquè qualsevol treballador de UAUU (sense compte de GitHub) pugui
obrir un tiquet, i que es converteixi automàticament en un **issue** al
repositori que un administrador triï. Inclou un tauler d'administració per
gestionar l'estat i la prioritat dels tiquets, una pàgina per
connectar/gestionar els repositoris, i un sistema d'accés controlat per
usuaris (registre amb aprovació manual).

```
Formulari (public/index.html) → POST /api/tickets → routes/tickets.js → API de GitHub → nou issue
```

El token de GitHub només viu al servidor; mai s'envia al navegador.

## Requisits previs

- Node.js 18 o superior
- Un compte de GitHub per crear els tiquets (recomanat: un compte dedicat,
  vegeu la secció de notificacions més avall) i, opcionalment, un altre
  compte propietari dels repositoris per gestionar-los des de l'admin
- Un projecte de Supabase (Auth + base de dades a l'esquema `tiquets`) per a
  l'accés d'usuaris
- Un compte a Resend (resend.com), amb un domini verificat, per als correus
  del sistema d'accés (verificació de registre, avisos, contrasenya)

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
`/admin.html` i es desen a `repos.json`.

### Accés d'administració

No hi ha cap token secret compartit per a l'administració. L'administrador
és un usuari normal del portal —el compte real de Supabase Auth
`digital@uauu.cat`— que inicia sessió des de `/login.html` amb correu i
contrasenya, igual que qualsevol altre usuari. Un cop amb sessió activa amb
aquest correu exacte, `public/js/admin-auth.js` desbloqueja `/admin.html`,
`/tickets-admin.html` i `/solicituds-admin.html`, i el backend
(`middleware/require-admin.js`) verifica cada petició a `/api/admin/*`
comprovant el token de sessió de Supabase i que el correu de l'usuari sigui
`digital@uauu.cat` (constant al mateix fitxer).

Per crear aquest compte per primer cop (si encara no existeix a Supabase
Auth), es pot fer des del propi flux de `registre.html` + aprovació manual,
o directament des del panell de Supabase.

## Execució (dia a dia)

```bash
npm start
```

- Formulari públic (requereix haver iniciat sessió): [http://localhost:3000](http://localhost:3000)
- Login: `http://localhost:3000/login.html`
- Sol·licitud d'accés per a usuaris nous: `http://localhost:3000/registre.html`
- Llistat públic de tiquets: `http://localhost:3000/tickets.html`
- Gestió de tiquets (només `digital@uauu.cat`): `http://localhost:3000/tickets-admin.html`
- Gestió de repositoris (només `digital@uauu.cat`): `http://localhost:3000/admin.html`
- Aprovació de sol·licituds d'accés (només `digital@uauu.cat`): `http://localhost:3000/solicituds-admin.html`

Cada tiquet enviat crea un issue nou al repositori triat, amb etiquetes de
categoria i prioritat.

## Variables d'entorn

Veure `.env.example` per a la llista completa i actualitzada, amb el detall
de cada variable. Resum de les principals:

| Variable | Descripció |
|---|---|
| `GITHUB_TOKEN` | Token del compte que crea les issues i comentaris públics. Ha de ser un compte **diferent** del que fa Watch als repositoris (vegeu "Notificacions" més avall). Permís mínim: `Issues: Read and write` al repo de tiquets. |
| `GITHUB_ADMIN_TOKEN` | Token del compte **propietari real** dels repositoris, usat només des de `/tickets-admin.html` per canviar estat/prioritat i eliminar tiquets (GitHub només permet eliminar issues des del propietari, no des d'un col·laborador). |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Accés al projecte de Supabase (Auth + esquema `tiquets`), compartit amb l'app "compras". |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ADMIN_NOTIFY_EMAILS` | Enviament dels correus del sistema d'accés (verificació, avisos, contrasenya) via Resend. |
| `PUBLIC_BASE_URL` | URL pública del portal, usada per construir els enllaços dels correus. |
| `PORT` | Port on escolta el servidor. Opcional, per defecte `3000`. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `NOTIFY_EMAIL` | Opcionals: via SMTP alternativa i independent per avisar per correu d'un tiquet nou. Actualment **no s'utilitzen** en producció (vegeu "Notificacions" més avall); es deixen documentades per si es reactiven en el futur. |

## Notificacions de tiquets nous

No s'envia cap correu des del portal per avisar d'un tiquet nou (es va
provar SMTP i Resend per a aquest cas concret i es va descartar; vegeu
`CLAUDE.md`). La solució adoptada són les **notificacions natives de
GitHub**: GitHub mai notifica al mateix compte que crea la issue, així que
`GITHUB_TOKEN` ha de ser d'un compte diferent del que fa Watch (→ All
Activity) als repositoris connectats.

Resend sí que s'utilitza, però només per als correus del sistema d'accés
d'usuaris (verificació de registre, avís de sol·licituds pendents, rebuig,
creació/recuperació de contrasenya).

## Deploy

Actualment es desplega a Servatica (panell "Setup Node.js App"), amb un
`.env` propi al servidor de producció que cal actualitzar (i reiniciar
l'app) manualment des del panell si canvia alguna variable.

Qualsevol altre servei que executi Node.js també funcionaria:

- **Render / Railway / Fly.io**: connecta el repositori, defineix les
  variables d'entorn al panell del servei, i el desplegament és automàtic.
- **Servidor propi / VPS intern**: `npm install && npm start` darrere d'un
  reverse proxy (nginx) amb HTTPS.

No cal exposar cap port de GitHub ni donar accés al repositori als
treballadors: només visiten la teva URL.

## Notes de seguretat

- L'accés al formulari i a la resta del portal requereix sessió (Supabase
  Auth), amb aprovació manual de cada sol·licitud d'accés per part de
  l'administrador. El formulari públic de registre inclou un **honeypot**
  anti-bots i límits de freqüència per IP.
- L'administració (`/admin.html`, `/tickets-admin.html`,
  `/solicituds-admin.html` i les rutes `/api/admin/*`) està lligada a un únic
  compte de Supabase Auth (`digital@uauu.cat`), verificat a cada petició pel
  backend — no hi ha cap token compartit.
- `GITHUB_TOKEN` només ha de tenir accés al(s) repositori(s) de tiquets,
  mai a tota l'organització.
- No es guarda cap dada de tiquets en una base de dades: viuen com a issues
  de GitHub; `tickets.json`, `repos.json` i `activity.json` només en són una
  còpia local (no versionada) per a l'admin. Les dades d'usuaris i
  sol·licituds d'accés sí que viuen a Supabase (esquema `tiquets`).

## Estructura del projecte

Vegeu `CLAUDE.md` per a l'estructura completa i detallada de carpetes.
