# Portal de tiquets → GitHub Issues

Pàgina web perquè qualsevol treballador (sense compte de GitHub) pugui obrir un
tiquet, i que es converteixi automàticament en un **issue** al repositori que
tu triïs.

```
Formulari (public/index.html) → POST /api/tickets → server.js → API de GitHub → nou issue
```

El token de GitHub només viu al servidor; mai s'envia al navegador.

## 1. Instal·lació

Necessites Node.js 18 o superior.

```bash
npm install
cp .env.example .env
```

## 2. Crear el token de GitHub

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

Emplena també a `.env`:

- `GITHUB_OWNER`: usuari o organització (p. ex. `la-meva-empresa`)
- `GITHUB_REPO`: nom del repositori (p. ex. `tiquets-interns`)

## 3. Executar-ho en local

```bash
npm start
```

Obre [http://localhost:3000](http://localhost:3000). Cada tiquet enviat crea un issue nou al
repositori configurat, amb etiquetes de categoria i prioritat.

## 4. Publicar-ho perquè hi accedeixin els treballadors

Qualsevol servei que executi Node.js funciona. Opcions senzilles:

- **Render / Railway / Fly.io**: connecta el repositori d'aquest projecte,
  defineix les variables d'entorn (`GITHUB_TOKEN`, `GITHUB_OWNER`,
  `GITHUB_REPO`) al panell del servei, i el desplegament és automàtic.
- **Servidor propi / VPS intern**: `npm install && npm start` darrere d'un
  reverse proxy (nginx) amb HTTPS, per exemple a `tiquets.empresa.com`.

No cal exposar cap port de GitHub ni donar accés al repositori als
treballadors: només visiten la teva URL.

## 5. Personalitzar-ho

- **Categories i prioritats**: edita `CATEGORY_LABELS` i `PRIORITY_LABELS` a
  `server.js`. Si l'etiqueta no existeix encara al repositori, GitHub la crea
  sola (sense color personalitzat); si vols colors concrets, crea-les abans a
  *Settings → Labels* del repo.
- **Camps del formulari**: `public/index.html` (secció `<form>`) i el mateix
  nom de camp a `server.js`.
- **Aspecte visual**: tot l'estil és CSS pla dins `public/index.html`, sense
  frameworks — es pot editar directament.

## 6. Notes de seguretat

- El formulari és públic (sense login), així que ja porta un **honeypot**
  anti-bots i un **límit de 10 tiquets per IP cada 15 minuts**. Si hi ha abús,
  considera afegir un CAPTCHA (p. ex. Cloudflare Turnstile) o posar-lo darrere
  de la xarxa interna / VPN de l'empresa.
- El `GITHUB_TOKEN` només ha de tenir accés al repositori de tiquets, mai a
  tota l'organització.
- No es guarda cap dada en una base de dades: cada tiquet només viu com a
  issue de GitHub.

## Estructura de fitxers

```
github-ticket-portal/
├── server.js          # Backend Express: rep el formulari i crida l'API de GitHub
├── public/index.html  # Formulari (frontend)
├── package.json
├── .env.example        # Plantilla de variables d'entorn
└── README.md
```
