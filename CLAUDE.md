# CLAUDE.md - tiquets-issues (github-ticket-portal)

## 1. Descripció del projecte
Portal intern de tiquets que crea issues de GitHub automàticament.

## 2. Stack tècnic
- **Backend:** Node.js + Express (`server.js` com a punt d'entrada).
- **Altres dependències:** dotenv, express-rate-limit, nodemailer.
- **Frontend:** servit des de `/public`.

> Pendent de confirmar amb l'usuari si aquest stack és definitiu o si es preveu ampliar-lo.

## 3. Estructura de carpetes
```
/tiquets-issues
├── /public
│   ├── /css           # variables.css, layout.css, ticket.css, form.css, main.css (importa la resta), admin.css
│   ├── /js            # ticket-form.js, admin.js
│   ├── /assets        # favicon.ico (corporatiu, còpia de UAUU/_shared-assets)
│   ├── index.html     # Formulari públic de tiquets
│   └── admin.html     # Gestió de repositoris connectats
├── server.js          # Punt d'entrada de l'aplicació
├── repos.config.js     # Configuració de repositoris
├── repos.json          # Dades de repositoris
├── repos.store.js       # Gestió/emmagatzematge de repositoris
├── .env                # Variables d'entorn (NO versionat)
├── .env.example        # Plantilla de variables d'entorn
├── .gitignore
├── package.json
└── README.md
```

`--font-ui: 'Inter', system-ui, 'Segoe UI', sans-serif` definida a `public/css/variables.css` i aplicada a `body` (regla 4 de les regles globals de UAUU). `admin.css` també importa `variables.css` per compartir-la.

## 4. Variables d'entorn
Veure `.env.example` per a la llista actualitzada de variables necessàries.

## 5. Notes específiques del projecte

### Notificacions de tiquets nous
- **No s'envia cap correu des del portal.** Es va provar SMTP (Microsoft 365) i després Resend, però es va descartar: el tenant de M365 de UAUU té l'autenticació SMTP bàsica desactivada per política ("SmtpClientAuthentication is disabled for the Tenant"), i Resend en mode de proves només permet enviar a l'adreça del compte registrat (calia verificar el domini `uauu.cat`, que es va decidir evitar).
- **Solució adoptada:** notificacions natives de GitHub. Cal tenir en compte que **GitHub mai notifica al mateix compte que crea la issue**. Per això les issues es creen amb el token d'un compte diferent (`UauuBot`, afegit com a col·laborador als repositoris), i el compte `UauuDigital` és qui les vigila (Watch → All Activity) i rep l'avís per correu/web.
- El `GITHUB_TOKEN` de l'`.env` ha de ser sempre d'un compte **diferent** del compte que fa Watch als repositoris, o mai arribaran notificacions.
- Token actual: classic PAT (`ghp_...`) del compte `UauuBot`, scope `public_repo`. Es va provar amb un token fine-grained però l'opció "Only select repositories" no apareixia per a un compte sense repositoris propis; el classic amb `public_repo` és la solució que funciona.

### Categories i prioritat del formulari
- Categories disponibles (`public/index.html` i `CATEGORY_LABELS` a `server.js`): Error/no funciona, Petició de funcionalitat, Accés i permisos, Altres. (S'ha eliminat "Suport tècnic".)
- La prioritat es tria amb un lliscador (slider), no amb xips de botó — canvi fet perquè l'usuari ho volia més "dinàmic".
