const ticketsBody = document.getElementById('ticketsBody');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSortableHeaders = document.querySelectorAll('#ticketsTable th[data-sort]');
const ticketSearchInput = document.getElementById('ticketSearch');
const ticketStatusFilter = document.getElementById('ticketStatusFilter');
const ticketPriorityFilter = document.getElementById('ticketPriorityFilter');

let allTickets = [];
let searchQuery = '';
let statusQuery = '';
let priorityQuery = '';
let sortState = { key: 'createdAt', dir: 'desc' };

const PRIORITY_LABELS_CA = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };
const STATUS_LABELS = {
  no_comencat: 'No començat',
  comencat: 'Començat',
  acabat: 'Acabat',
  cancelat: 'Cancel·lat',
  en_espera: 'En espera'
};

const ICON_EXTERNAL = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8 5H5.5A1.5 1.5 0 004 6.5v8A1.5 1.5 0 005.5 16h8a1.5 1.5 0 001.5-1.5V12M12 4h4v4M9.5 10.5L16 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
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

async function loadTickets() {
  ticketsError.style.display = 'none';
  try {
    const res = await fetch('/api/tickets');
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    allTickets = await res.json();
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
  const query = searchQuery.trim().toLowerCase();
  let result = allTickets;
  if (query) {
    result = result.filter((t) =>
      [t.title, t.repoLabel, t.reporterName]
        .some((field) => (field || '').toLowerCase().includes(query))
    );
  }
  if (statusQuery) {
    result = result.filter((t) => t.status === statusQuery);
  }
  if (priorityQuery) {
    result = result.filter((t) => t.priority === priorityQuery);
  }
  if (sortState.key) {
    const { key, dir } = sortState;
    result = [...result].sort((a, b) => {
      const av = (a[key] || '').toString().toLowerCase();
      const bv = (b[key] || '').toString().toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return result;
}

function updateSortArrows() {
  ticketSortableHeaders.forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.sort === sortState.key) {
      arrow.textContent = sortState.dir === 'asc' ? '▲' : '▼';
    } else {
      arrow.textContent = '';
    }
  });
}

function renderFilteredTickets() {
  ticketsEmptyMsg.style.display = allTickets.length ? 'none' : 'block';
  const tickets = getFilteredSortedTickets();
  ticketsNoResultsMsg.style.display = (allTickets.length && !tickets.length) ? 'block' : 'none';
  updateSortArrows();
  renderTickets(tickets);
}

function renderTickets(tickets) {
  ticketsBody.innerHTML = '';
  for (const t of tickets) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(formatTicketDate(t.createdAt))}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.repoLabel)}</td>
      <td><span class="priority-tag" data-priority="${t.priority || ''}">${escapeHtml(PRIORITY_LABELS_CA[t.priority] || t.priority || '—')}</span></td>
      <td>${escapeHtml(t.reporterName || 'Anònim')}</td>
      <td><span class="status-badge" data-status="${t.status}">${escapeHtml(STATUS_LABELS[t.status] || t.status)}</span></td>
      <td>
        <a class="icon-link" href="${t.url}" target="_blank" rel="noopener" title="Obrir a GitHub" aria-label="Obrir a GitHub">${ICON_EXTERNAL}</a>
      </td>`;
    ticketsBody.appendChild(tr);
  }
}

ticketSortableHeaders.forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, dir: 'asc' };
    }
    renderFilteredTickets();
  });
});

ticketSearchInput.addEventListener('input', () => {
  searchQuery = ticketSearchInput.value;
  renderFilteredTickets();
});
ticketStatusFilter.addEventListener('change', () => {
  statusQuery = ticketStatusFilter.value;
  renderFilteredTickets();
});
ticketPriorityFilter.addEventListener('change', () => {
  priorityQuery = ticketPriorityFilter.value;
  renderFilteredTickets();
});

loadTickets();
