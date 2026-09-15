// La lògica d'urgència compartida (computeUrgencyScore, colors, zones,
// icones, formatRelativeTime...) viu a tickets-shared/board-core.js, que
// aquesta pàgina carrega abans que aquest fitxer. Aquí només queda el que
// és exclusiu del tauler d'administració: l'avís de quan un tiquet acabat
// o cancel·lat s'eliminarà sol.

// Un tiquet acabat o cancel·lat s'elimina sol (GitHub inclòs) al cap d'aquest temps.
const AUTO_DELETE_DAYS = 14;
const AUTO_DELETE_MS = AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;

function autoDeleteText(t) {
  if ((t.status !== 'acabat' && t.status !== 'cancelat') || !t.closedAt) return '';
  const msLeft = new Date(t.closedAt).getTime() + AUTO_DELETE_MS - Date.now();
  const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
  if (daysLeft <= 0) return "S'eliminarà molt aviat";
  if (daysLeft === 1) return "S'eliminarà d'aquí 1 dia";
  return `S'eliminarà d'aquí ${daysLeft} dies`;
}
