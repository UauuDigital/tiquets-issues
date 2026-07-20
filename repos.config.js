// Llista de repositoris on es poden crear tiquets.
// "id" és el valor intern que s'envia des del formulari (no cal tocar-lo un cop en producció).
// "label" és el nom que veu l'usuari al desplegable.
// "owner" i "repo" identifiquen el repositori de GitHub (org/usuari + nom).
module.exports = [
  { id: 'tiquets-issues', label: 'Tiquets i incidències', owner: 'UauuDigital', repo: 'tiquets-issues' }
];
