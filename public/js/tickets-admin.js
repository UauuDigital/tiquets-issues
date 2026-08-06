const ticketsBody = document.getElementById('ticketsBody');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSortableHeaders = document.querySelectorAll('#ticketsTable th[data-sort]');
const ticketSearchInput = document.getElementById('ticketSearch');
const statusChips = document.getElementById('statusChips');
const priorityChips = document.getElementById('priorityChips');
const ticketsCount = document.getElementById('ticketsCount');

const ticketModal = document.getElementById('ticketModal');
const ticketModalClose = document.getElementById('ticketModalClose');
const modalUrgency = document.getElementById('modalUrgency');
const modalTitle = document.getElementById('modalTitle');
const modalRepo = document.getElementById('modalRepo');
const modalStatusWrap = document.getElementById('modalStatusWrap');
const modalPriority = document.getElementById('modalPriority');
const modalReporter = document.getElementById('modalReporter');
const modalDate = document.getElementById('modalDate');
const modalUrgencyValue = document.getElementById('modalUrgencyValue');
const modalGithubLink = document.getElementById('modalGithubLink');
const modalDelete = document.getElementById('modalDelete');

let allTickets = [];
let ticketSearchQuery = '';
let ticketStatusQuery = '';
let ticketPriorityQuery = '';
let ticketSortState = { key: 'urgencyScore', dir: 'desc' };

const ICON_LINK = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13.5H5.5A3.5 3.5 0 012 10a3.5 3.5 0 013.5-3.5H7M13 6.5h1.5A3.5 3.5 0 0118 10a3.5 3.5 0 01-3.5 3.5H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M8.5 9v5M11.5 9v5M5.5 6l.6 9a1 1 0 001 .9h5.8a1 1 0 001-.9l.6-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

const PRIORITY_LABELS_CA = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };
const PRIORITY_ORDER = { critica: 4, alta: 3, mitjana: 2, baixa: 1 };

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

function urgencyBackground(score, alpha = 0.2) {
  const [r, g, b] = urgencyColorRgb(score);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function urgencyLevelKey(score) {
  if (score <= 0) return 'none';
  if (score < 25) return 'low';
  if (score < 50) return 'medium';
  if (score < 100) return 'high';
  return 'max';
}

// Una icona diferent per nivell (no nomes color), perquè es distingeixin
// encara que algú no percebi bé el color.
const URGENCY_ICONS = {
  none: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 10.2l2.3 2.3 4.7-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  low: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.6" fill="currentColor"/></svg>`,
  medium: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="7.3" stroke="currentColor" stroke-width="1.5"/><path d="M10 6.3v4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.4" r="1" fill="currentColor"/></svg>`,
  high: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8" fill="currentColor"/><path d="M10 6v4.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="13.8" r="1.1" fill="#fff"/></svg>`,
  max: `<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor" opacity="0.28"/><circle cx="10" cy="10" r="7" fill="currentColor"/><path d="M10 6.3v4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="10" cy="14" r="1.1" fill="#fff"/></svg>`
};

const URGENCY_ICON_COLORS = {
  none: '#16a34a',
  low: '#ca8a04',
  medium: '#ea580c',
  high: '#dc2626',
  max: '#0a0a0a'
};

function urgencyIconHtml(score) {
  const level = urgencyLevelKey(score);
  return `<span class="urgency-icon" style="color:${URGENCY_ICON_COLORS[level]}">${URGENCY_ICONS[level]}</span>`;
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
    ticketsBody.innerHTML = '';
    ticketsEmptyMsg.style.display = 'none';
    ticketsNoResultsMsg.style.display = 'none';
  }
}

function getFilteredSortedTickets() {
  const query = ticketSearchQuery.trim().toLowerCase();
  let result = allTickets;
  if (query) {
    result = result.filter((t) =>
      [t.title, t.description, t.repoLabel, t.reporterName, t.reporterEmail]
        .some((field) => (field || '').toLowerCase().includes(query))
    );
  }
  if (ticketStatusQuery) {
    result = result.filter((t) => (t.status || 'no_comencat') === ticketStatusQuery);
  }
  if (ticketPriorityQuery) {
    result = result.filter((t) => t.priority === ticketPriorityQuery);
  }
  if (ticketSortState.key) {
    const { key, dir } = ticketSortState;
    const numeric = key === 'urgencyScore';
    result = [...result].sort((a, b) => {
      if (numeric) {
        const av = a[key] || 0;
        const bv = b[key] || 0;
        if (av !== bv) return dir === 'asc' ? av - bv : bv - av;
        // Desempat per prioritat: a igual urgència, primer la prioritat més alta.
        return (PRIORITY_ORDER[b.priority] || 0) - (PRIORITY_ORDER[a.priority] || 0);
      }
      const av = (a[key] || '').toString().toLowerCase();
      const bv = (b[key] || '').toString().toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return result;
}

function updateTicketSortArrows() {
  ticketSortableHeaders.forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.sort === ticketSortState.key) {
      arrow.textContent = ticketSortState.dir === 'asc' ? '▲' : '▼';
    } else {
      arrow.textContent = '';
    }
  });
}

function renderFilteredTickets() {
  ticketsEmptyMsg.style.display = allTickets.length ? 'none' : 'block';
  const tickets = getFilteredSortedTickets();
  ticketsNoResultsMsg.style.display = (allTickets.length && !tickets.length) ? 'block' : 'none';
  updateTicketSortArrows();
  renderStatusChips();
  renderPriorityChips();
  renderTickets(tickets);
  ticketsCount.textContent = allTickets.length
    ? `${tickets.length} de ${allTickets.length} tiquet${allTickets.length === 1 ? '' : 's'}`
    : '';
}

document.querySelectorAll('.info-icon').forEach((btn) => {
  btn.addEventListener('click', (e) => e.stopPropagation());
});

ticketSortableHeaders.forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (ticketSortState.key === key) {
      ticketSortState.dir = ticketSortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      ticketSortState = { key, dir: 'asc' };
    }
    renderFilteredTickets();
  });
});

ticketSearchInput.addEventListener('input', () => {
  ticketSearchQuery = ticketSearchInput.value;
  renderFilteredTickets();
});

const STATUS_LABELS = {
  no_comencat: 'No començat',
  comencat: 'Començat',
  en_espera: 'En espera',
  acabat: 'Acabat',
  cancelat: 'Cancel·lat'
};

function renderStatusChips() {
  const counts = { '': allTickets.length };
  for (const key of Object.keys(STATUS_LABELS)) counts[key] = 0;
  allTickets.forEach((t) => {
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
  const counts = { '': allTickets.length };
  for (const key of Object.keys(PRIORITY_LABELS_CA)) counts[key] = 0;
  allTickets.forEach((t) => {
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

function renderTickets(tickets) {
  ticketsBody.innerHTML = '';
  for (const t of tickets) {
    const tr = document.createElement('tr');
    tr.style.setProperty('--row-color', urgencyColor(t.urgencyScore));
    tr.style.setProperty('--row-bg', urgencyBackground(t.urgencyScore));
    tr.style.setProperty('--row-bg-hover', urgencyBackground(t.urgencyScore, 0.38));
    tr.innerHTML = `
      <td>
        <span class="urgency-score" title="Urgència: ${t.urgencyScore} (dies oberts × pes de prioritat)">${urgencyIconHtml(t.urgencyScore)}</span>
      </td>
      <td title="${escapeHtml(formatTicketDate(t.createdAt))}">${escapeHtml(formatRelativeTime(t.createdAt))}</td>
      <td class="cell-ticket" title="${escapeHtml(t.title)}">
        <div class="ticket-desc">${escapeHtml(t.description || t.title)}</div>
        <div class="ticket-repo">${escapeHtml(t.repoLabel)}</div>
      </td>
      <td class="cell-email">${t.reporterEmail ? `<a href="mailto:${escapeHtml(t.reporterEmail)}">${escapeHtml(t.reporterEmail)}</a>` : '—'}</td>
      <td>${prioritySelectHtml(t)}</td>
      <td>${escapeHtml(t.reporterName || 'Anònim')}</td>
      <td>${statusSelectHtml(t)}</td>
      <td class="actions">
        <div class="actions-inner">
          <a class="icon-btn" href="${t.url}" target="_blank" rel="noopener" title="Obrir a GitHub" aria-label="Obrir a GitHub">${ICON_LINK}</a>
          <button type="button" class="icon-btn danger" data-delete="${t.id}" title="Eliminar tiquet (i la incidència de GitHub)" aria-label="Eliminar tiquet (i la incidència de GitHub)">${ICON_TRASH}</button>
        </div>
      </td>`;
    tr.addEventListener('click', (e) => {
      if (e.target.closest('select, a, button')) return;
      openTicketModal(t);
    });
    ticketsBody.appendChild(tr);
  }
  ticketsBody.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketStatus(select));
  });
  ticketsBody.querySelectorAll('.priority-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketPriority(select));
  });
  ticketsBody.querySelectorAll('[data-delete]').forEach((btn) => {
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
  modalUrgency.innerHTML = urgencyIconHtml(t.urgencyScore);
  modalTitle.textContent = t.title;
  modalRepo.textContent = t.repoLabel;
  modalStatusWrap.innerHTML = statusSelectHtml(t);
  modalStatusWrap.querySelector('.status-select').addEventListener('change', (e) => updateTicketStatus(e.target));
  modalPriority.innerHTML = prioritySelectHtml(t);
  modalPriority.querySelector('.priority-select').addEventListener('change', (e) => updateTicketPriority(e.target));
  modalReporter.textContent = t.reporterName || 'Anònim';
  modalDate.textContent = `${formatRelativeTime(t.createdAt)} (${formatTicketDate(t.createdAt)})`;
  modalUrgencyValue.textContent = t.urgencyScore;
  modalGithubLink.href = t.url || '#';
}

function openTicketModal(t) {
  currentModalTicketId = t.id;
  populateModal(t);
  ticketModal.showModal();
}

ticketModalClose.addEventListener('click', () => ticketModal.close());
ticketModal.addEventListener('click', (e) => {
  const rect = ticketModal.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) ticketModal.close();
});
ticketModal.addEventListener('close', () => { currentModalTicketId = null; });
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
