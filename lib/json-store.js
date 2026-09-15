// Escriptura atòmica per als "stores" en JSON (tickets/repos/activity).
// Escriu a un fitxer temporal i el mou (rename), que al sistema de fitxers
// és atòmic: si el procés es talla a mitja escriptura, el fitxer final mai
// queda a mig escriure ni corromput -- o hi és la versió anterior sencera,
// o hi és la nova sencera.
const fs = require('fs');
const path = require('path');

function saveJsonAtomic(dataFile, data) {
  const tmpFile = path.join(
    path.dirname(dataFile),
    `.${path.basename(dataFile)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmpFile, dataFile);
}

module.exports = { saveJsonAtomic };
