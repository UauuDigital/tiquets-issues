const tokenInput = document.getElementById('adminToken');
const saveTokenBtn = document.getElementById('saveToken');
const form = document.getElementById('repoForm');
const formError = document.getElementById('formError');
const listError = document.getElementById('listError');
const reposBody = document.getElementById('reposBody');
const emptyMsg = document.getElementById('emptyMsg');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEdit');
const editingIdInput = document.getElementById('editingId');
const repoSearchInput = document.getElementById('repoSearch');
const noResultsMsg = document.getElementById('noResultsMsg');
const sortableHeaders = document.querySelectorAll('#reposTable th[data-sort]');
const ownerInput = document.getElementById('owner');
const repoInput = document.getElementById('repo');
const reposListDatalist = document.getElementById('reposList');
const ticketsBody = document.getElementById('ticketsBody');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSortableHeaders = document.querySelectorAll('#ticketsTable th[data-sort]');
const ticketSearchInput = document.getElementById('ticketSearch');
const ticketStatusFilter = document.getElementById('ticketStatusFilter');
const ticketPriorityFilter = document.getElementById('ticketPriorityFilter');

let allRepos = [];
let searchQuery = '';
let sortState = { key: null, dir: 'asc' };
let githubRepos = [];

let allTickets = [];
let ticketSearchQuery = '';
let ticketStatusQuery = '';
let ticketPriorityQuery = '';
let ticketSortState = { key: 'createdAt', dir: 'desc' };

const ICON_EDIT = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M13.5 3.5l3 3L7 16H4v-3L13.5 3.5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
const ICON_LINK = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13.5H5.5A3.5 3.5 0 012 10a3.5 3.5 0 013.5-3.5H7M13 6.5h1.5A3.5 3.5 0 0118 10a3.5 3.5 0 01-3.5 3.5H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M8.5 9v5M11.5 9v5M5.5 6l.6 9a1 1 0 001 .9h5.8a1 1 0 001-.9l.6-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CHECK = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.5L8 14.5L16 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

tokenInput.value = localStorage.getItem('adminToken') || '';

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem('adminToken', tokenInput.value.trim());
  loadRepos();
  loadGithubRepos();
  loadTickets();
});

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

async function loadRepos() {
  listError.style.display = 'none';
  try {
    const res = await fetch('/api/admin/repos', { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    allRepos = await res.json();
    updateOwnersDatalist();
    updateRepoDatalist();
    renderFiltered();
  } catch (err) {
    listError.textContent = err.message;
    listError.style.display = 'block';
    reposBody.innerHTML = '';
    emptyMsg.style.display = 'none';
    noResultsMsg.style.display = 'none';
  }
}

async function loadGithubRepos() {
  try {
    const res = await fetch('/api/admin/github-repos', { headers: authHeaders() });
    if (!res.ok) {
      console.warn('No s\'ha pogut carregar la llista de repositoris de GitHub:', res.status);
      return;
    }
    githubRepos = await res.json();
    updateRepoDatalist();
  } catch (err) {
    console.warn('Error carregant repositoris de GitHub:', err);
    // El camp de repositori segueix funcionant com a text lliure encara que això falli.
  }
}

const PRIORITY_LABELS_CA = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };

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
    const res = await fetch('/api/admin/tickets', { headers: authHeaders() });
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
  const query = ticketSearchQuery.trim().toLowerCase();
  let result = allTickets;
  if (query) {
    result = result.filter((t) =>
      [t.title, t.repoLabel, t.reporterName]
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
  renderTickets(tickets);
}

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
ticketStatusFilter.addEventListener('change', () => {
  ticketStatusQuery = ticketStatusFilter.value;
  renderFilteredTickets();
});
ticketPriorityFilter.addEventListener('change', () => {
  ticketPriorityQuery = ticketPriorityFilter.value;
  renderFilteredTickets();
});

const STATUS_LABELS = {
  no_comencat: 'No començat',
  comencat: 'Començat',
  acabat: 'Acabat',
  cancelat: 'Cancel·lat',
  en_espera: 'En espera'
};

function renderTickets(tickets) {
  ticketsBody.innerHTML = '';
  for (const t of tickets) {
    const status = t.status || 'no_comencat';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(formatTicketDate(t.createdAt))}</td>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.repoLabel)}</td>
      <td>${escapeHtml(PRIORITY_LABELS_CA[t.priority] || t.priority || '—')}</td>
      <td>${escapeHtml(t.reporterName || 'Anònim')}</td>
      <td>
        <select class="status-select" data-status="${status}" data-id="${t.id}">
          ${Object.entries(STATUS_LABELS).map(([value, label]) =>
            `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </td>
      <td class="actions">
        <div class="actions-inner">
          <a class="icon-btn" href="${t.url}" target="_blank" rel="noopener" title="Obrir a GitHub" aria-label="Obrir a GitHub">${ICON_LINK}</a>
        </div>
      </td>`;
    ticketsBody.appendChild(tr);
  }
  ticketsBody.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketStatus(select));
  });
}

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
    if (ticket) ticket.status = newStatus;
  } catch (err) {
    select.value = previousStatus;
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  } finally {
    select.disabled = false;
  }
}

const CONNECTED_SUFFIX = ' — connectat';

function isRepoConnected(owner, repo) {
  return allRepos.some(
    (r) => r.owner.toLowerCase() === owner.toLowerCase() && r.repo.toLowerCase() === repo.toLowerCase()
  );
}

function updateRepoDatalist() {
  const ownerValue = ownerInput.value.trim().toLowerCase();
  const matches = ownerValue
    ? githubRepos.filter((r) => r.owner.toLowerCase() === ownerValue)
    : githubRepos;
  const useFullName = !matches.length;
  const list = useFullName ? githubRepos : matches;

  const seen = new Set();
  const optionsHtml = list
    .map((r) => {
      const displayName = useFullName ? r.fullName : r.repo;
      if (seen.has(displayName)) return '';
      seen.add(displayName);
      const connected = isRepoConnected(r.owner, r.repo);
      const value = connected ? `${displayName}${CONNECTED_SUFFIX}` : displayName;
      return `<option value="${escapeHtml(value)}"></option>`;
    })
    .join('');
  reposListDatalist.innerHTML = optionsHtml;
}

// En triar una opció ja marcada com a connectada, netegem el sufix visual
// perquè el valor real del camp continuï sent el nom net del repositori.
repoInput.addEventListener('input', () => {
  if (repoInput.value.endsWith(CONNECTED_SUFFIX)) {
    repoInput.value = repoInput.value.slice(0, -CONNECTED_SUFFIX.length);
  }
});

ownerInput.addEventListener('input', updateRepoDatalist);

function updateOwnersDatalist() {
  const owners = [...new Set(allRepos.map((r) => r.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const datalist = document.getElementById('ownersList');
  datalist.innerHTML = owners.map((o) => `<option value="${escapeHtml(o)}"></option>`).join('');
}

function getFilteredSortedRepos() {
  const query = searchQuery.trim().toLowerCase();
  let result = allRepos;
  if (query) {
    result = result.filter((r) =>
      [r.label, r.owner, r.repo, r.description]
        .some((field) => (field || '').toLowerCase().includes(query))
    );
  }
  if (sortState.key) {
    const { key, dir } = sortState;
    result = [...result].sort((a, b) => {
      const av = (a[key] || '').toLowerCase();
      const bv = (b[key] || '').toLowerCase();
      if (av < bv) return dir === 'asc' ? -1 : 1;
      if (av > bv) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }
  return result;
}

function updateSortArrows() {
  sortableHeaders.forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    if (th.dataset.sort === sortState.key) {
      arrow.textContent = sortState.dir === 'asc' ? '▲' : '▼';
    } else {
      arrow.textContent = '';
    }
  });
}

function renderFiltered() {
  emptyMsg.style.display = allRepos.length ? 'none' : 'block';
  const repos = getFilteredSortedRepos();
  noResultsMsg.style.display = (allRepos.length && !repos.length) ? 'block' : 'none';
  updateSortArrows();
  renderRepos(repos);
}

sortableHeaders.forEach((th) => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, dir: 'asc' };
    }
    renderFiltered();
  });
});

repoSearchInput.addEventListener('input', () => {
  searchQuery = repoSearchInput.value;
  renderFiltered();
});

function renderRepos(repos) {
  reposBody.innerHTML = '';
  for (const r of repos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.label)}</td>
      <td>${escapeHtml(r.owner)}</td>
      <td>${escapeHtml(r.repo)}</td>
      <td>${escapeHtml(r.description || '')}</td>
      <td class="actions">
        <div class="actions-inner">
          <button type="button" class="icon-btn" data-edit="${r.id}" title="Editar" aria-label="Editar">${ICON_EDIT}</button>
          <button type="button" class="icon-btn" data-copy="${r.id}" title="Copiar enllaç" aria-label="Copiar enllaç">${ICON_LINK}</button>
          <button type="button" class="icon-btn danger" data-del="${r.id}" title="Eliminar" aria-label="Eliminar">${ICON_TRASH}</button>
        </div>
      </td>`;
    reposBody.appendChild(tr);
  }
  reposBody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(repos.find((r) => r.id === btn.dataset.edit)));
  });
  reposBody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteRepo(btn.dataset.del));
  });
  reposBody.querySelectorAll('[data-copy]').forEach((btn) => {
    btn.addEventListener('click', () => copyTicketLink(btn.dataset.copy, btn));
  });
}

async function copyTicketLink(repoId, btn) {
  const url = `${window.location.origin}/?repo=${encodeURIComponent(repoId)}`;
  try {
    await navigator.clipboard.writeText(url);
    const original = btn.innerHTML;
    const originalTitle = btn.title;
    btn.innerHTML = ICON_CHECK;
    btn.title = 'Copiat!';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.title = originalTitle;
    }, 1500);
  } catch (err) {
    prompt('Copia aquest enllaç:', url);
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function startEdit(repo) {
  if (!repo) return;
  editingIdInput.value = repo.id;
  document.getElementById('label').value = repo.label;
  document.getElementById('owner').value = repo.owner;
  document.getElementById('repo').value = repo.repo;
  document.getElementById('description').value = repo.description || '';
  updateRepoDatalist();
  submitBtn.textContent = 'Desar canvis';
  cancelEditBtn.style.display = 'inline-block';
}

cancelEditBtn.addEventListener('click', () => {
  form.reset();
  editingIdInput.value = '';
  submitBtn.textContent = 'Afegir';
  cancelEditBtn.style.display = 'none';
  updateRepoDatalist();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  const payload = {
    label: document.getElementById('label').value.trim(),
    owner: document.getElementById('owner').value.trim(),
    repo: document.getElementById('repo').value.trim(),
    description: document.getElementById('description').value.trim()
  };
  const id = editingIdInput.value;
  const url = id ? `/api/admin/repos/${id}` : '/api/admin/repos';
  const method = id ? 'PUT' : 'POST';
  try {
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    form.reset();
    editingIdInput.value = '';
    submitBtn.textContent = 'Afegir';
    cancelEditBtn.style.display = 'none';
    loadRepos();
  } catch (err) {
    formError.textContent = err.message;
    formError.style.display = 'block';
  }
});

async function deleteRepo(id) {
  if (!confirm('Segur que vols eliminar aquest repositori?')) return;
  try {
    const res = await fetch(`/api/admin/repos/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    loadRepos();
  } catch (err) {
    listError.textContent = err.message;
    listError.style.display = 'block';
  }
}

loadRepos();
loadGithubRepos();
loadTickets();
