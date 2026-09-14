loadTickets();
loadActivity();

// L'accés directe a la incidència de GitHub només es mostra a
// digital@uauu.cat (l'únic compte d'administració), no a la resta
// d'usuaris del portal que consulten aquesta vista pública de tiquets.
const ADMIN_EMAIL = 'digital@uauu.cat';
let isAdminSession = false;
AuthSession.getSession().then((session) => {
  isAdminSession = !!session && (session.user.email || '').toLowerCase() === ADMIN_EMAIL;
  if (currentModalTicketId) {
    const t = allTickets.find((x) => x.id === currentModalTicketId);
    if (t) populateModal(t);
  }
});

document.addEventListener('i18n:change', () => {
  rebuildLabelMaps();
  rebuildUrgencyLabels();
  if (typeof renderFilteredTickets === 'function') renderFilteredTickets();
  if (currentModalTicketId) {
    const t = allTickets.find((x) => x.id === currentModalTicketId);
    if (t) populateModal(t);
  }
  renderActivity(lastActivityEntries);
});
