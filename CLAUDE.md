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
├── /public            # Frontend servit per Express
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

## 4. Variables d'entorn
Veure `.env.example` per a la llista actualitzada de variables necessàries.

## 5. Notes específiques del projecte
(Afegir aquí decisions o particularitats d'aquest projecte a mesura que sorgeixin.)
