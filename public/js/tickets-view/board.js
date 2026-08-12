initBoardCore({
  fetchUrl: '/api/tickets',
  searchFields: (t) => [t.title, t.repoLabel, t.reporterName, t.number ? `#${t.number}` : '']
});

function ticketCardHtml(t) {
  return `
    <div class="ticket-card-frame">
    <article class="ticket-card" data-id="${t.id}" role="button" tabindex="0" aria-label="Obre el tiquet ${t.number ? '#' + t.number : ''}: ${escapeHtml(t.description || '')}" style="--card-color:${urgencyColor(t.urgencyScore)};--status-color:${STATUS_COLORS[t.status || 'no_comencat']}">
      <div class="ticket-card-urgency" title="Urgència: ${t.urgencyScore} (dies oberts × pes de prioritat)">
        ${urgencyIconHtml(t)}
        <span class="ticket-card-number">${t.number ? '#' + t.number : ''}</span>
      </div>
      <div class="ticket-card-main">
        <div class="ticket-card-top">
          <p class="ticket-card-desc" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</p>
        </div>
        <div class="ticket-card-field"><span class="ticket-repo">${escapeHtml(t.repoLabel)}</span></div>
        <div class="ticket-card-field"><span class="priority-tag" data-priority="${t.priority || ''}">${escapeHtml(PRIORITY_LABELS_CA[t.priority] || t.priority || '—')}</span></div>
        <div class="ticket-card-field"><span class="status-badge" data-status="${t.status || 'no_comencat'}">${escapeHtml(STATUS_LABELS[t.status] || 'No començat')}</span></div>
        <div class="ticket-card-foot">
          <span>${escapeHtml(t.reporterName || 'Anònim')}</span>
          <span title="${escapeHtml(formatTicketDate(t.createdAt))}">${escapeHtml(formatRelativeTime(t.createdAt))}</span>
        </div>
      </div>
    </article>
    </div>`;
}

function renderZones(tickets) {
  const byZone = {};
  for (const z of ZONES) byZone[z.key] = [];
  for (const t of tickets) byZone[zoneForTicket(t).key].push(t);

  zonesBoard.innerHTML = ZONES.map((z) => `
    <section class="urgency-zone${byZone[z.key].length ? '' : ' urgency-zone-empty'}" style="--zone-color:${z.color}">
      <header class="urgency-zone-head">
        <span class="urgency-zone-dot"></span>
        <h3>${z.label}</h3>
        <span class="urgency-zone-count">${byZone[z.key].length}</span>
      </header>
      <div class="urgency-zone-cards">
        ${byZone[z.key].length
          ? byZone[z.key].map(ticketCardHtml).join('')
          : '<p class="urgency-zone-empty-msg">Cap tiquet en aquesta zona.</p>'}
      </div>
    </section>
  `).join('');

  zonesBoard.querySelectorAll('.ticket-card').forEach((card) => {
    const t = tickets.find((x) => x.id === card.dataset.id);
    card.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      openTicketModal(t);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('a, button')) return;
      e.preventDefault();
      openTicketModal(t);
    });
  });
}
