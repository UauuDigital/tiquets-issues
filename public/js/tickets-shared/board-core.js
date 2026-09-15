/**
 * Lògica de filtratge/ordenació/render de xips compartida entre el tauler
 * d'administració (tickets-admin) i la vista pública de només lectura
 * (tickets-view). Cada pàgina crida initBoardCore() amb les seves opcions
 * (URL de fetch, capçaleres i camps cercables) abans que main.js invoqui
 * loadTickets(); ticketCardHtml/renderZones es queden a cada board.js
 * perquè la targeta editable (admin) i la de només lectura (view) són
 * comportaments genuïnament diferents, no duplicació accidental.
 */
// tickets-admin.html no carrega i18n.js (es manté sempre en català); aquest
// ajudant permet que board-core.js sigui compartit sense trencar-se allà.
function boardText(key, fallback, vars) {
  return typeof I18N !== 'undefined' ? I18N.t(key, vars) : fallback;
}

// El primer dígit del número d'un tiquet identifica sempre el repositori
// (veure repos.json → numberPrefix); el destaquem en negreta perquè es
// distingeixi d'un cop d'ull del número real de la issue de GitHub.
function ticketNumberHtml(number) {
  const str = String(number);
  return `<b>${str.charAt(0)}</b><span style="font-weight:400">${str.slice(1)}</span>`;
}

// --- Urgència dels tiquets, compartida entre tickets-admin i tickets-view ---
// (abans duplicada gairebé íntegrament als dos urgency.js; boardText() fa
// que les etiquetes es tradueixin a tickets-view i es mantinguin en català
// fix a tickets-admin, que no carrega i18n.js).

// Setmanes fins arribar a 100 (saturació) segons prioritat.
const PRIORITY_URGENCY_WEEKS_TO_MAX = { baixa: 4, mitjana: 2, alta: 1 };
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// Un tiquet acabat o cancel·lat ja no acumula urgència, encara que faci temps que sigui obert.
// Un tiquet crític és sempre 100 des del primer moment.
function computeUrgencyScore(t) {
  const status = t.status || 'no_comencat';
  if (status === 'acabat' || status === 'cancelat') return 0;
  if (t.priority === 'critica') return 100;
  const weeksOpen = Math.max(0, (Date.now() - new Date(t.createdAt).getTime()) / MS_PER_WEEK);
  const weeksToMax = PRIORITY_URGENCY_WEEKS_TO_MAX[t.priority] || PRIORITY_URGENCY_WEEKS_TO_MAX.baixa;
  return Math.min(100, Math.round((weeksOpen / weeksToMax) * 100));
}

// Gradient continu gris molt clar -> vermell -> negre, segons la urgència.
// Es satura a URGENCY_COLOR_MAX perquè un tiquet molt vell no quedi il·legible.
const URGENCY_COLOR_MAX = 100;
const URGENCY_GRAY = [209, 213, 219];
const URGENCY_RED = [220, 38, 38];
const URGENCY_BLACK = [0, 0, 0];

function mixColorRgb(c1, c2, t) {
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t)
  ];
}

function urgencyColorRgb(score) {
  const t = Math.max(0, Math.min(score, URGENCY_COLOR_MAX)) / URGENCY_COLOR_MAX;
  if (t <= 0.5) return mixColorRgb(URGENCY_GRAY, URGENCY_RED, t / 0.5);
  return mixColorRgb(URGENCY_RED, URGENCY_BLACK, (t - 0.5) / 0.5);
}

function urgencyColor(score) {
  const [r, g, b] = urgencyColorRgb(score);
  return `rgb(${r}, ${g}, ${b})`;
}

function urgencyLevelKey(score) {
  if (score <= 0) return 'none';
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 100) return 'high';
  return 'max';
}

// Zones del tauler, de més a menys urgència. Els tiquets acabats o cancel·lats
// tenen la seva pròpia zona (independent de la urgència), sempre al final.
// label es reomple a rebuildUrgencyLabels() segons l'idioma actiu.
const ZONES = [
  { key: 'max', label: '', color: '#0a0a0a', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 100 },
  { key: 'high', label: '', color: '#dc2626', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 50 && t.urgencyScore < 100 },
  { key: 'medium', label: '', color: '#a16207', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 25 && t.urgencyScore < 50 },
  { key: 'low', label: '', color: '#166534', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore < 25 },
  { key: 'acabat', label: '', color: '#2563eb', match: (t) => t.status === 'acabat' },
  { key: 'cancelat', label: '', color: '#6b7280', match: (t) => t.status === 'cancelat' }
];

function zoneForTicket(t) {
  return ZONES.find((z) => z.match(t)) || ZONES[ZONES.length - 1];
}

function rebuildUrgencyLabels() {
  ZONES.find((z) => z.key === 'max').label = boardText('urgency.max', 'Urgència màxima');
  ZONES.find((z) => z.key === 'high').label = boardText('urgency.high', 'Urgència alta');
  ZONES.find((z) => z.key === 'medium').label = boardText('urgency.medium', 'Urgència mitjana');
  ZONES.find((z) => z.key === 'low').label = boardText('urgency.low', 'Urgència baixa');
  ZONES.find((z) => z.key === 'acabat').label = boardText('urgency.acabat', 'Acabat');
  ZONES.find((z) => z.key === 'cancelat').label = boardText('urgency.cancelat', 'Cancel·lat');
}
rebuildUrgencyLabels();

// Una icona diferent per nivell (no nomes color), perquè es distingeixin
// encara que algú no percebi bé el color.
const URGENCY_ICONS = {
  low: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>`,
  medium: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.3v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.4" r="1" fill="currentColor"/></svg>`,
  high: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 6v4.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.8" r="1.1" fill="#fff"/></svg>`,
  max: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.28"/><circle cx="10" cy="10" r="7" fill="currentColor"/><path d="M10 6.3v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14" r="1.1" fill="#fff"/></svg>`,
  acabat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cancelat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
};

const URGENCY_ICON_COLORS = { low: '#166534', medium: '#a16207', high: '#dc2626', max: '#0a0a0a', acabat: '#2563eb', cancelat: '#6b7280' };

// La icona de cada tiquet sempre coincideix amb la zona on apareix.
function urgencyIconHtml(t) {
  const key = zoneForTicket(t).key;
  return `<span class="urgency-icon" style="color:${URGENCY_ICON_COLORS[key]}">${URGENCY_ICONS[key]}</span>`;
}

// Distintiu d'urgència per al modal: mateixa icona i color que la
// targeta, perquè el nivell es reconegui d'un cop d'ull i no només
// pel text.
function urgencyBadgeHtml(t) {
  const zone = zoneForTicket(t);
  const color = URGENCY_ICON_COLORS[zone.key];
  return `<span class="urgency-badge" style="--urgency-color:${color}">${URGENCY_ICONS[zone.key]}${escapeHtml(zone.label)}</span>`;
}

function formatTicketDate(iso) {
  try {
    const locale = typeof I18N !== 'undefined' ? I18N.getLocale() : 'ca-ES';
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'Europe/Madrid',
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(iso));
  } catch (err) {
    return iso;
  }
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return boardText('time.now', 'ara mateix');
  if (diffMin < 60) return boardText('time.minutesAgo', `fa ${diffMin} min`, { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return boardText('time.hoursAgo', `fa ${diffHours} h`, { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return boardText('time.oneDayAgo', 'fa 1 dia');
  if (diffDays < 30) return boardText('time.daysAgo', `fa ${diffDays} dies`, { n: diffDays });
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return boardText('time.oneMonthAgo', 'fa 1 mes');
  if (diffMonths < 12) return boardText('time.monthsAgo', `fa ${diffMonths} mesos`, { n: diffMonths });
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1
    ? boardText('time.oneYearAgo', 'fa 1 any')
    : boardText('time.yearsAgo', `fa ${diffYears} anys`, { n: diffYears });
}

function initBoardCore({ fetchUrl, headers, searchFields }) {
  window.loadTickets = async function loadTickets() {
    ticketsError.style.display = 'none';
    try {
      let res;
      try {
        res = await fetch(fetchUrl, headers ? { headers: headers() } : undefined);
      } catch (networkErr) {
        throw new Error(boardText('board.networkError', 'No s\'ha pogut connectar amb el servidor. Comprova la teva connexió.'));
      }
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
    ticketProjectFilter.innerHTML = `<option value="">${boardText('tickets.allProjects', 'Tots els projectes')}</option>` +
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

    const chips = [{ value: '', label: boardText('tickets.allStatuses', 'Tots') }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))];
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

    const chips = [{ value: '', label: boardText('tickets.allPriorities', 'Totes') }, ...Object.entries(PRIORITY_LABELS_CA).map(([value, label]) => ({ value, label }))];
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
      ? boardText('tickets.countWithTotal', `${tickets.length} de ${allTickets.length} tiquet${allTickets.length === 1 ? '' : 's'}`, { shown: tickets.length, total: allTickets.length, plural: allTickets.length === 1 ? '' : 's' })
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
