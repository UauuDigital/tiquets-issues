// Llavor inicial dels repositoris connectats: només s'usa la primera vegada
// que arrenca el servidor per crear repos.json (que és el que es fa servir
// realment, i es pot gestionar en calent des de /admin.html).
// "id" és el valor intern que s'envia des del formulari.
// "label" és el nom que veu l'usuari al desplegable.
// "owner" i "repo" identifiquen el repositori de GitHub (org/usuari + nom).
module.exports = [
  { id: 'tiquets-issues', label: 'Tiquets i incidències', owner: 'UauuDigital', repo: 'tiquets-issues' }
];
