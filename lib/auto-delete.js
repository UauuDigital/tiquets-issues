const crypto = require('crypto');
const ticketsStore = require('../tickets.store');
const activityStore = require('../activity.store');
const { GITHUB_ADMIN_TOKEN, deleteGithubIssue, parseGithubIssueUrl } = require('./github-api');

// Un tiquet acabat o cancel·lat s'elimina sol (GitHub inclòs) al cap d'aquest temps.
const AUTO_DELETE_DAYS = 14;
const AUTO_DELETE_MS = AUTO_DELETE_DAYS * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // comprova cada hora

// Elimina sols (GitHub inclòs) els tiquets que fa AUTO_DELETE_DAYS que estan
// acabats o cancel·lats. Si l'eliminació a GitHub falla, es reintenta a la
// següent passada (el tiquet no es toca fins que GitHub confirma l'eliminació).
async function cleanupExpiredTickets() {
  const expired = ticketsStore.list().filter((t) => {
    if (t.status !== 'acabat' && t.status !== 'cancelat') return false;
    if (!t.closedAt) return false;
    return Date.now() - new Date(t.closedAt).getTime() >= AUTO_DELETE_MS;
  });

  for (const t of expired) {
    try {
      const ghIssue = parseGithubIssueUrl(t.url);
      if (ghIssue && GITHUB_ADMIN_TOKEN) {
        await deleteGithubIssue(ghIssue);
      }
      ticketsStore.remove(t.id);
      activityStore.add({
        id: crypto.randomUUID(),
        ticketId: t.id,
        ticketNumber: t.number,
        ticketTitle: t.title,
        type: 'deleted',
        by: 'auto',
        at: new Date().toISOString()
      });
      console.log(`Tiquet #${t.number} eliminat automàticament (${AUTO_DELETE_DAYS} dies com a ${t.status}).`);
    } catch (err) {
      console.error(`No s'ha pogut eliminar automàticament el tiquet #${t.number}:`, err.message);
    }
  }
}

function startAutoDelete() {
  setInterval(cleanupExpiredTickets, CLEANUP_INTERVAL_MS);
  cleanupExpiredTickets();
}

module.exports = { startAutoDelete };
