const zonesBoard = document.getElementById('zonesBoard');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSearchInput = document.getElementById('ticketSearch');
const ticketAuthorSearchInput = document.getElementById('ticketAuthorSearch');
const ticketProjectFilter = document.getElementById('ticketProjectFilter');
const statusChips = document.getElementById('statusChips');
const priorityChips = document.getElementById('priorityChips');
const ticketsCount = document.getElementById('ticketsCount');

const ticketModal = document.getElementById('ticketModal');
const ticketModalClose = document.getElementById('ticketModalClose');
const modalUrgency = document.getElementById('modalUrgency');
const modalTitle = document.getElementById('modalTitle');
const modalRepo = document.getElementById('modalRepo');
const modalDescription = document.getElementById('modalDescription');
const modalStatusWrap = document.getElementById('modalStatusWrap');
const modalPriority = document.getElementById('modalPriority');
const modalCategory = document.getElementById('modalCategory');
const modalDepartment = document.getElementById('modalDepartment');
const modalReporter = document.getElementById('modalReporter');
const modalEmail = document.getElementById('modalEmail');
const modalDate = document.getElementById('modalDate');
const modalUrgencyValue = document.getElementById('modalUrgencyValue');
const modalGithubLink = document.getElementById('modalGithubLink');
const modalAutoDelete = document.getElementById('modalAutoDelete');
const modalDelete = document.getElementById('modalDelete');
const modalScreenshotsSection = document.getElementById('modalScreenshotsSection');
const modalScreenshots = document.getElementById('modalScreenshots');
const modalComments = document.getElementById('modalComments');
const modalCommentsStatus = document.getElementById('modalCommentsStatus');
const modalCommentForm = document.getElementById('modalCommentForm');
const modalCommentInput = document.getElementById('modalCommentInput');
const modalCommentError = document.getElementById('modalCommentError');
const modalCommentSubmit = document.getElementById('modalCommentSubmit');

let allTickets = [];
let ticketSearchQuery = '';
let ticketStatusQuery = '';
let ticketPriorityQuery = '';
let ticketProjectQuery = '';
let ticketAuthorQuery = '';

const ICON_LINK = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13.5H5.5A3.5 3.5 0 012 10a3.5 3.5 0 013.5-3.5H7M13 6.5h1.5A3.5 3.5 0 0118 10a3.5 3.5 0 01-3.5 3.5H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M8.5 9v5M11.5 9v5M5.5 6l.6 9a1 1 0 001 .9h5.8a1 1 0 001-.9l.6-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

const PRIORITY_LABELS_CA = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };
const CATEGORY_LABELS_CA = { bug: 'Error / no funciona', funcionalitat: 'Petició de funcionalitat', acces: 'Accés i permisos', altres: 'Altres' };
const DEPARTMENT_LABELS_CA = { comercial: 'Comercial', coordinacio: 'Coordinació', cuina: 'Cuina', administracio: 'Administració', digital: 'Digital' };
const PRIORITY_ORDER = { critica: 4, alta: 3, mitjana: 2, baixa: 1 };
const STATUS_ORDER = { comencat: 3, en_espera: 2, no_comencat: 1, acabat: 0, cancelat: 0 };

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
const ZONES = [
  { key: 'max', label: 'Urgència màxima', color: '#0a0a0a', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 100 },
  { key: 'high', label: 'Urgència alta', color: '#dc2626', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 50 && t.urgencyScore < 100 },
  { key: 'medium', label: 'Urgència mitjana', color: '#a16207', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore >= 25 && t.urgencyScore < 50 },
  { key: 'low', label: 'Urgència baixa', color: '#166534', match: (t) => t.status !== 'acabat' && t.status !== 'cancelat' && t.urgencyScore < 25 },
  { key: 'acabat', label: 'Acabat', color: '#2563eb', match: (t) => t.status === 'acabat' },
  { key: 'cancelat', label: 'Cancel·lat', color: '#6b7280', match: (t) => t.status === 'cancelat' }
];

function zoneForTicket(t) {
  return ZONES.find((z) => z.match(t)) || ZONES[ZONES.length - 1];
}

const URGENCY_LEVEL_LABELS_CA = {
  none: 'Cap urgència',
  low: 'Urgència baixa',
  medium: 'Urgència mitjana',
  high: 'Urgència alta',
  max: 'Urgència màxima'
};

// Una icona diferent per nivell (no nomes color), perquè es distingeixin
// encara que algú no percebi bé el color.
// La icona de "baixa" és una rodona amb un punt a dins, i la de "acabat" un tick.
const URGENCY_ICONS = {
  low: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>`,
  medium: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.3v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.4" r="1" fill="currentColor"/></svg>`,
  high: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 6v4.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.8" r="1.1" fill="#fff"/></svg>`,
  max: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.28"/><circle cx="10" cy="10" r="7" fill="currentColor"/><path d="M10 6.3v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14" r="1.1" fill="#fff"/></svg>`,
  acabat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cancelat: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M7.5 7.5l5 5M12.5 7.5l-5 5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
};

const URGENCY_ICON_COLORS = {
  low: '#166534',
  medium: '#a16207',
  high: '#dc2626',
  max: '#0a0a0a',
  acabat: '#2563eb',
  cancelat: '#6b7280'
};

// La icona de cada tiquet sempre coincideix amb la zona on apareix.
function urgencyIconHtml(t) {
  const key = zoneForTicket(t).key;
  return `<span class="urgency-icon" style="color:${URGENCY_ICON_COLORS[key]}">${URGENCY_ICONS[key]}</span>`;
}

function formatTicketDate(iso) {
  try {
    return new Intl.DateTimeFormat('ca-ES', {
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
  if (diffMin < 1) return 'ara mateix';
  if (diffMin < 60) return `fa ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `fa ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'fa 1 dia';
  if (diffDays < 30) return `fa ${diffDays} dies`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return 'fa 1 mes';
  if (diffMonths < 12) return `fa ${diffMonths} mesos`;
  const diffYears = Math.floor(diffDays / 365);
  return diffYears === 1 ? 'fa 1 any' : `fa ${diffYears} anys`;
}

async function loadTickets() {
  ticketsError.style.display = 'none';
  try {
    const res = await fetch('/api/admin/tickets', { headers: authHeaders() });
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
  const query = ticketSearchQuery.trim().toLowerCase();
  if (query && ![t.title, t.description, t.repoLabel, t.reporterName, t.reporterEmail]
    .some((field) => (field || '').toLowerCase().includes(query))) return false;
  const authorQuery = ticketAuthorQuery.trim().toLowerCase();
  if (authorQuery && !(t.reporterName || '').toLowerCase().includes(authorQuery)) return false;
  if (ticketProjectQuery && t.repoLabel !== ticketProjectQuery) return false;
  if (!skipStatus && ticketStatusQuery && (t.status || 'no_comencat') !== ticketStatusQuery) return false;
  if (!skipPriority && ticketPriorityQuery && t.priority !== ticketPriorityQuery) return false;
  return true;
}

function getFilteredSortedTickets() {
  const result = allTickets.filter((t) => ticketMatchesFilters(t));
  // Dins de cada zona d'urgència, primer per estat (Començat > En espera > No començat),
  // i a igual estat, la prioritat més alta primer.
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

function renderFilteredTickets() {
  ticketsEmptyMsg.style.display = allTickets.length ? 'none' : 'block';
  const tickets = getFilteredSortedTickets();
  ticketsNoResultsMsg.style.display = (allTickets.length && !tickets.length) ? 'block' : 'none';
  renderProjectFilterOptions();
  renderStatusChips();
  renderPriorityChips();
  renderZones(tickets);
  ticketsCount.textContent = allTickets.length
    ? `${tickets.length} de ${allTickets.length} tiquet${allTickets.length === 1 ? '' : 's'}`
    : '';
}

document.querySelectorAll('.info-icon').forEach((btn) => {
  btn.addEventListener('click', (e) => e.stopPropagation());
});

ticketProjectFilter.addEventListener('change', () => {
  ticketProjectQuery = ticketProjectFilter.value;
  renderFilteredTickets();
});

ticketSearchInput.addEventListener('input', () => {
  ticketSearchQuery = ticketSearchInput.value;
  renderFilteredTickets();
});

ticketAuthorSearchInput.addEventListener('input', () => {
  ticketAuthorQuery = ticketAuthorSearchInput.value;
  renderFilteredTickets();
});

const STATUS_LABELS = {
  no_comencat: 'No començat',
  comencat: 'Començat',
  en_espera: 'En espera',
  acabat: 'Acabat',
  cancelat: 'Cancel·lat'
};

const STATUS_COLORS = {
  no_comencat: '#4b5563',
  comencat: '#1d4ed8',
  en_espera: '#b45309',
  acabat: '#15803d',
  cancelat: '#b91c1c'
};

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

function statusSelectHtml(t) {
  const status = t.status || 'no_comencat';
  return `
    <select class="status-select" data-status="${status}" data-id="${t.id}">
      ${Object.entries(STATUS_LABELS).map(([value, label]) =>
        `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`
      ).join('')}
    </select>`;
}

function prioritySelectHtml(t) {
  const priority = t.priority || 'baixa';
  return `
    <select class="priority-select" data-priority="${priority}" data-id="${t.id}">
      ${Object.entries(PRIORITY_LABELS_CA).map(([value, label]) =>
        `<option value="${value}"${value === priority ? ' selected' : ''}>${label}</option>`
      ).join('')}
    </select>`;
}

function ticketCardHtml(t) {
  return `
    <div class="ticket-card-frame">
    <article class="ticket-card" data-id="${t.id}" role="button" tabindex="0" style="--card-color:${urgencyColor(t.urgencyScore)};--status-color:${STATUS_COLORS[t.status || 'no_comencat']}">
      <div class="ticket-card-urgency" title="Urgència: ${t.urgencyScore} (dies oberts × pes de prioritat)">
        ${urgencyIconHtml(t)}
        <span class="ticket-card-number">${t.number ? '#' + t.number : ''}</span>
      </div>
      <div class="ticket-card-main">
        <div class="ticket-card-top">
          <p class="ticket-card-desc" title="${escapeHtml(t.title)}">${escapeHtml(t.description || t.title)}</p>
          <div class="ticket-card-actions">
            <a class="icon-btn" href="${t.url}" target="_blank" rel="noopener" title="Obrir a GitHub" aria-label="Obrir a GitHub">${ICON_LINK}</a>
            <button type="button" class="icon-btn danger" data-delete="${t.id}" title="Eliminar tiquet (i la incidència de GitHub)" aria-label="Eliminar tiquet (i la incidència de GitHub)">${ICON_TRASH}</button>
          </div>
        </div>
        <div class="ticket-card-field"><span class="ticket-repo">${escapeHtml(t.repoLabel)}</span></div>
        <div class="ticket-card-field">${prioritySelectHtml(t)}</div>
        <div class="ticket-card-field">${statusSelectHtml(t)}</div>
        <div class="ticket-card-foot">
          <span>${escapeHtml(t.reporterName || 'Anònim')}</span>
          <span title="${escapeHtml(formatTicketDate(t.createdAt))}">${escapeHtml(formatRelativeTime(t.createdAt))}</span>
        </div>
        ${autoDeleteText(t) ? `<p class="ticket-card-autodelete">${escapeHtml(autoDeleteText(t))}</p>` : ''}
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
      if (e.target.closest('select, a, button')) return;
      openTicketModal(t);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('select, a, button')) return;
      e.preventDefault();
      openTicketModal(t);
    });
  });
  zonesBoard.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketStatus(select));
  });
  zonesBoard.querySelectorAll('.priority-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketPriority(select));
  });
  zonesBoard.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTicket(btn.dataset.delete));
  });
}

async function deleteTicket(id) {
  if (!confirm('Segur que vols eliminar aquest tiquet? S\'intentarà eliminar també la incidència de GitHub de manera permanent i irreversible.')) return;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    allTickets = allTickets.filter((t) => t.id !== id);
    if (currentModalTicketId === id) ticketModal.close();
    renderFilteredTickets();
  } catch (err) {
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  }
}

let currentModalTicketId = null;

function populateModal(t) {
  modalUrgency.innerHTML = urgencyIconHtml(t);
  modalTitle.textContent = t.number ? `Tiquet núm. ${t.number}` : 'Tiquet';
  modalRepo.textContent = t.repoLabel;
  modalDescription.textContent = t.description || t.title || '—';
  modalStatusWrap.innerHTML = statusSelectHtml(t);
  modalStatusWrap.querySelector('.status-select').addEventListener('change', (e) => updateTicketStatus(e.target));
  modalPriority.innerHTML = prioritySelectHtml(t);
  modalPriority.querySelector('.priority-select').addEventListener('change', (e) => updateTicketPriority(e.target));
  modalCategory.textContent = CATEGORY_LABELS_CA[t.category] || '—';
  modalDepartment.textContent = DEPARTMENT_LABELS_CA[t.department] || '—';
  modalReporter.textContent = t.reporterName || 'Anònim';
  modalEmail.innerHTML = t.reporterEmail ? `<a href="mailto:${escapeHtml(t.reporterEmail)}">${escapeHtml(t.reporterEmail)}</a>` : '—';
  modalDate.textContent = `${formatRelativeTime(t.createdAt)} (${formatTicketDate(t.createdAt)})`;
  modalUrgencyValue.textContent = URGENCY_LEVEL_LABELS_CA[urgencyLevelKey(t.urgencyScore)];
  modalUrgencyValue.title = `Puntuació: ${t.urgencyScore}`;
  modalGithubLink.href = t.url || '#';
  const autoDeleteMsg = autoDeleteText(t);
  modalAutoDelete.textContent = autoDeleteMsg;
  modalAutoDelete.hidden = !autoDeleteMsg;

  if (t.screenshotUrls && t.screenshotUrls.length) {
    modalScreenshotsSection.hidden = false;
    modalScreenshots.innerHTML = t.screenshotUrls.map((url) => `
      <a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Captura de pantalla" loading="lazy"></a>
    `).join('');
  } else {
    modalScreenshotsSection.hidden = true;
    modalScreenshots.innerHTML = '';
  }
}

function renderCommentEl(c) {
  const div = document.createElement('div');
  div.className = 'modal-comment';
  div.innerHTML = `
    <div class="modal-comment-head">
      ${c.avatarUrl ? `<img src="${c.avatarUrl}" alt="" class="modal-comment-avatar">` : ''}
      <a href="${c.url}" target="_blank" rel="noopener" class="modal-comment-author">${escapeHtml(c.author)}</a>
      <span class="modal-comment-date">${escapeHtml(formatRelativeTime(c.createdAt))}</span>
    </div>
    <div class="modal-comment-body">${escapeHtml(c.body)}</div>
  `;
  return div;
}

// Si el comentari ocupa més de les línies visibles per defecte, hi afegeix
// un botó per desplegar-lo sencer (només es mostra quan cal de veritat).
function setupCommentClamp(commentEl) {
  const body = commentEl.querySelector('.modal-comment-body');
  body.classList.add('clamped');
  if (body.scrollHeight <= body.clientHeight + 1) {
    body.classList.remove('clamped');
    return;
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'modal-comment-toggle';
  toggle.textContent = 'Mostra el comentari sencer';
  toggle.addEventListener('click', () => {
    const stillClamped = body.classList.toggle('clamped');
    toggle.textContent = stillClamped ? 'Mostra el comentari sencer' : 'Mostra menys';
  });
  commentEl.appendChild(toggle);
}

async function loadModalComments(id) {
  modalComments.querySelectorAll('.modal-comment').forEach((el) => el.remove());
  modalCommentsStatus.hidden = false;
  modalCommentsStatus.textContent = 'Carregant…';
  try {
    const res = await fetch(`/api/admin/tickets/${id}/comments`, { headers: authHeaders() });
    if (!res.ok) throw new Error();
    const comments = await res.json();
    if (currentModalTicketId !== id) return;
    if (!comments.length) {
      modalCommentsStatus.textContent = 'Encara no hi ha cap comentari.';
      return;
    }
    modalCommentsStatus.hidden = true;
    comments.forEach((c) => {
      const el = renderCommentEl(c);
      modalComments.appendChild(el);
      setupCommentClamp(el);
    });
  } catch (err) {
    if (currentModalTicketId !== id) return;
    modalCommentsStatus.hidden = false;
    modalCommentsStatus.textContent = 'No s\'han pogut carregar els comentaris.';
  }
}

modalCommentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalCommentError.style.display = 'none';
  const body = modalCommentInput.value.trim();
  if (!body || !currentModalTicketId) return;

  modalCommentSubmit.disabled = true;
  modalCommentSubmit.textContent = 'Publicant…';
  try {
    const res = await fetch(`/api/admin/tickets/${currentModalTicketId}/comments`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ body })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    modalCommentsStatus.hidden = true;
    const newCommentEl = renderCommentEl(data);
    modalComments.appendChild(newCommentEl);
    setupCommentClamp(newCommentEl);
    modalCommentInput.value = '';
  } catch (err) {
    modalCommentError.textContent = err.message;
    modalCommentError.style.display = 'block';
  } finally {
    modalCommentSubmit.disabled = false;
    modalCommentSubmit.textContent = 'Publicar comentari';
  }
});

function openTicketModal(t) {
  currentModalTicketId = t.id;
  populateModal(t);
  ticketModal.showModal();
  loadModalComments(t.id);
}

ticketModalClose.addEventListener('click', () => ticketModal.close());
ticketModal.addEventListener('click', (e) => {
  const rect = ticketModal.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) ticketModal.close();
});
ticketModal.addEventListener('close', () => {
  currentModalTicketId = null;
  modalCommentForm.reset();
  modalCommentError.style.display = 'none';
});
modalDelete.addEventListener('click', () => {
  if (currentModalTicketId) deleteTicket(currentModalTicketId);
});

async function updateTicketStatus(select) {
  const id = select.dataset.id;
  const newStatus = select.value;
  const previousStatus = select.dataset.status;
  select.disabled = true;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    select.dataset.status = newStatus;
    const ticket = allTickets.find((t) => t.id === id);
    if (ticket) {
      ticket.status = newStatus;
      ticket.urgencyScore = computeUrgencyScore(ticket);
      renderFilteredTickets();
      if (currentModalTicketId === id) populateModal(ticket);
      return;
    }
  } catch (err) {
    select.value = previousStatus;
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  } finally {
    select.disabled = false;
  }
}

async function updateTicketPriority(select) {
  const id = select.dataset.id;
  const newPriority = select.value;
  const previousPriority = select.dataset.priority;
  select.disabled = true;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ priority: newPriority })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    select.dataset.priority = newPriority;
    const ticket = allTickets.find((t) => t.id === id);
    if (ticket) {
      ticket.priority = newPriority;
      ticket.urgencyScore = computeUrgencyScore(ticket);
      renderFilteredTickets();
      if (currentModalTicketId === id) populateModal(ticket);
      return;
    }
  } catch (err) {
    select.value = previousPriority;
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  } finally {
    select.disabled = false;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.addEventListener('admin-authenticated', loadTickets);
