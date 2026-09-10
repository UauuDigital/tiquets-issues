loadTickets();
loadActivity();

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
