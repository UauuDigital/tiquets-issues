async function loadTickets() {
  ticketsError.style.display = 'none';
  try {
    const res = await fetch('/api/tickets');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    allTickets = (await res.json()).map((t) => ({ ...t, urgencyScore: computeUrgencyScore(t) }));
    renderFilteredTickets();
  } catch (err) {
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
    zonesBoard.innerHTML = '';
    ticketsEmptyMsg.style.display = 'none';
    ticketsNoResultsMsg.style.display = 'none';
  }
}

// Comprova si un tiquet compleix els filtres actius. skipStatus/skipPriority
// permeten ignorar aquell filtre concret, per calcular els comptadors dels
// xips (el comptador d'un xip no s'ha de veure afectat pel propi xip actiu).
function ticketMatchesFilters(t, { skipStatus = false, skipPriority = false } = {}) {
  const query = ticketSearchQuery.trim().toLowerCase().replace(/^#/, '');
  if (query && ![t.title, t.repoLabel, t.reporterName, t.number ? `#${t.number}` : '']
    .some((field) => (field || '').toLowerCase().replace(/^#/, '').includes(query))) return false;
  const authorQuery = ticketAuthorQuery.trim().toLowerCase();
  if (authorQuery && !(t.reporterName || '').toLowerCase().includes(authorQuery)) return false;
  if (ticketProjectQuery && t.repoLabel !== ticketProjectQuery) return false;
  if (!skipStatus && ticketStatusQuery && (t.status || 'no_comencat') !== ticketStatusQuery) return false;
  if (!skipPriority && ticketPriorityQuery && t.priority !== ticketPriorityQuery) return false;
  return true;
}

function getFilteredSortedTickets() {
  const result = allTickets.filter((t) => ticketMatchesFilters(t));
  return [...result].sort((a, b) => {
    const statusDiff = (STATUS_ORDER[b.status || 'no_comencat'] || 0) - (STATUS_ORDER[a.status || 'no_comencat'] || 0);
    if (statusDiff !== 0) return statusDiff;
    return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
  });
}

function renderProjectFilterOptions() {
  const projects = [...new Set(allTickets.map((t) => t.repoLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const previousValue = ticketProjectFilter.value;
  ticketProjectFilter.innerHTML = '<option value="">Tots els projectes</option>' +
    projects.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join('');
  if (projects.includes(previousValue)) ticketProjectFilter.value = previousValue;
}

// Omple els desplegables de suggeriments dels buscadors amb els números
// de tiquet i els noms d'autor que hi ha realment, perquè es puguin
// triar en lloc d'haver-los d'escriure sencers.
function renderSearchSuggestions() {
  const numbers = [...new Set(allTickets.map((t) => t.number).filter(Boolean))].sort((a, b) => b - a);
  ticketSearchSuggest.innerHTML = numbers.map((n) => `<option value="#${n}"></option>`).join('');
  const authors = [...new Set(allTickets.map((t) => t.reporterName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  ticketAuthorSuggest.innerHTML = authors.map((a) => `<option value="${escapeHtml(a)}"></option>`).join('');
}

function renderStatusChips() {
  const matching = allTickets.filter((t) => ticketMatchesFilters(t, { skipStatus: true }));
  const counts = { '': matching.length };
  for (const key of Object.keys(STATUS_LABELS)) counts[key] = 0;
  matching.forEach((t) => {
    const status = t.status || 'no_comencat';
    counts[status] = (counts[status] || 0) + 1;
  });

  const chips = [{ value: '', label: 'Tots' }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))];
  statusChips.innerHTML = chips.map(({ value, label }) => `
    <button type="button" class="status-chip${value === ticketStatusQuery ? ' active' : ''}" data-status-chip="${value}">
      ${label} <span class="chip-count">${counts[value] || 0}</span>
    </button>
  `).join('');

  statusChips.querySelectorAll('[data-status-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ticketStatusQuery = btn.dataset.statusChip;
      renderFilteredTickets();
    });
  });
}

function renderPriorityChips() {
  const matching = allTickets.filter((t) => ticketMatchesFilters(t, { skipPriority: true }));
  const counts = { '': matching.length };
  for (const key of Object.keys(PRIORITY_LABELS_CA)) counts[key] = 0;
  matching.forEach((t) => {
    if (t.priority) counts[t.priority] = (counts[t.priority] || 0) + 1;
  });

  const chips = [{ value: '', label: 'Totes' }, ...Object.entries(PRIORITY_LABELS_CA).map(([value, label]) => ({ value, label }))];
  priorityChips.innerHTML = chips.map(({ value, label }) => `
    <button type="button" class="priority-chip${value === ticketPriorityQuery ? ' active' : ''}" data-priority="${value}" data-priority-chip="${value}">
      ${label} <span class="chip-count">${counts[value] || 0}</span>
    </button>
  `).join('');

  priorityChips.querySelectorAll('[data-priority-chip]').forEach((btn) => {
    btn.addEventListener('click', () => {
      ticketPriorityQuery = btn.dataset.priorityChip;
      renderFilteredTickets();
    });
  });
}

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

function renderFilteredTickets() {
  ticketsEmptyMsg.style.display = allTickets.length ? 'none' : 'block';
  const tickets = getFilteredSortedTickets();
  ticketsNoResultsMsg.style.display = (allTickets.length && !tickets.length) ? 'block' : 'none';
  renderProjectFilterOptions();
  renderSearchSuggestions();
  renderStatusChips();
  renderPriorityChips();
  renderZones(tickets);
  ticketsCount.textContent = allTickets.length
    ? `${tickets.length} de ${allTickets.length} tiquet${allTickets.length === 1 ? '' : 's'}`
    : '';
}

ticketSearchInput.addEventListener('input', () => {
  ticketSearchQuery = ticketSearchInput.value;
  renderFilteredTickets();
});

ticketAuthorSearchInput.addEventListener('input', () => {
  ticketAuthorQuery = ticketAuthorSearchInput.value;
  renderFilteredTickets();
});

ticketProjectFilter.addEventListener('change', () => {
  ticketProjectQuery = ticketProjectFilter.value;
  renderFilteredTickets();
});
