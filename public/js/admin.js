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

tokenInput.value = localStorage.getItem('adminToken') || '';

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem('adminToken', tokenInput.value.trim());
  loadRepos();
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
    const repos = await res.json();
    renderRepos(repos);
  } catch (err) {
    listError.textContent = err.message;
    listError.style.display = 'block';
    reposBody.innerHTML = '';
    emptyMsg.style.display = 'none';
  }
}

function renderRepos(repos) {
  reposBody.innerHTML = '';
  emptyMsg.style.display = repos.length ? 'none' : 'block';
  for (const r of repos) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.label)}</td>
      <td>${escapeHtml(r.owner)}</td>
      <td>${escapeHtml(r.repo)}</td>
      <td>${escapeHtml(r.description || '')}</td>
      <td class="actions">
        <button type="button" class="secondary" data-edit="${r.id}">Editar</button>
        <button type="button" class="danger" data-del="${r.id}">Eliminar</button>
      </td>`;
    reposBody.appendChild(tr);
  }
  reposBody.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => startEdit(repos.find((r) => r.id === btn.dataset.edit)));
  });
  reposBody.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => deleteRepo(btn.dataset.del));
  });
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
  submitBtn.textContent = 'Desar canvis';
  cancelEditBtn.style.display = 'inline-block';
}

cancelEditBtn.addEventListener('click', () => {
  form.reset();
  editingIdInput.value = '';
  submitBtn.textContent = 'Afegir';
  cancelEditBtn.style.display = 'none';
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
