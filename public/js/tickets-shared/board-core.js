/**
 * Lògica de filtratge/ordenació/render de xips compartida entre el tauler
 * d'administració (tickets-admin) i la vista pública de només lectura
 * (tickets-view). Cada pàgina crida initBoardCore() amb les seves opcions
 * (URL de fetch, capçaleres i camps cercables) abans que main.js invoqui
 * loadTickets(); ticketCardHtml/renderZones es queden a cada board.js
 * perquè la targeta editable (admin) i la de només lectura (view) són
 * comportaments genuïnament diferents, no duplicació accidental.
 */
function initBoardCore({ fetchUrl, headers, searchFields }) {
  window.loadTickets = async function loadTickets() {
    ticketsError.style.display = 'none';
    try {
      const res = await fetch(fetchUrl, headers ? { headers: headers() } : undefined);
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
  };

  // skipStatus/skipPriority permeten ignorar aquell filtre concret, per
  // calcular els comptadors dels xips (el comptador d'un xip no s'ha de
  // veure afectat pel propi xip actiu).
  window.ticketMatchesFilters = function ticketMatchesFilters(t, { skipStatus = false, skipPriority = false } = {}) {
    const query = ticketSearchQuery.trim().toLowerCase().replace(/^#/, '');
    if (query && !searchFields(t).some((field) => (field || '').toLowerCase().replace(/^#/, '').includes(query))) return false;
    const authorQuery = ticketAuthorQuery.trim().toLowerCase();
    if (authorQuery && !(t.reporterName || '').toLowerCase().includes(authorQuery)) return false;
    if (ticketProjectQuery && t.repoLabel !== ticketProjectQuery) return false;
    if (!skipStatus && ticketStatusQuery && (t.status || 'no_comencat') !== ticketStatusQuery) return false;
    if (!skipPriority && ticketPriorityQuery && t.priority !== ticketPriorityQuery) return false;
    return true;
  };

  window.getFilteredSortedTickets = function getFilteredSortedTickets() {
    const result = allTickets.filter((t) => ticketMatchesFilters(t));
    // Dins de cada zona d'urgència, primer per estat (Començat > En espera > No començat),
    // i a igual estat, la prioritat més alta primer.
    return [...result].sort((a, b) => {
      const statusDiff = (STATUS_ORDER[b.status || 'no_comencat'] || 0) - (STATUS_ORDER[a.status || 'no_comencat'] || 0);
      if (statusDiff !== 0) return statusDiff;
      return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
    });
  };

  window.renderProjectFilterOptions = function renderProjectFilterOptions() {
    const projects = [...new Set(allTickets.map((t) => t.repoLabel).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const previousValue = ticketProjectFilter.value;
    ticketProjectFilter.innerHTML = '<option value="">Tots els projectes</option>' +
      projects.map((label) => `<option value="${escapeHtml(label)}">${escapeHtml(label)}</option>`).join('');
    if (projects.includes(previousValue)) ticketProjectFilter.value = previousValue;
  };

  // Omple els desplegables de suggeriments dels buscadors amb els números
  // de tiquet i els noms d'autor que hi ha realment, perquè es puguin
  // triar en lloc d'haver-los d'escriure sencers.
  window.renderSearchSuggestions = function renderSearchSuggestions() {
    const numbers = [...new Set(allTickets.map((t) => t.number).filter(Boolean))].sort((a, b) => b - a);
    ticketSearchSuggest.innerHTML = numbers.map((n) => `<option value="#${n}"></option>`).join('');
    const authors = [...new Set(allTickets.map((t) => t.reporterName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    ticketAuthorSuggest.innerHTML = authors.map((a) => `<option value="${escapeHtml(a)}"></option>`).join('');
  };

  window.renderStatusChips = function renderStatusChips() {
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
  };

  window.renderPriorityChips = function renderPriorityChips() {
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
  };

  window.renderFilteredTickets = function renderFilteredTickets() {
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
  };

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
}
