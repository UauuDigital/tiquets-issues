const solicitudsList = document.getElementById('solicitudsList');
const solicitudsError = document.getElementById('solicitudsError');
const solicitudsEmptyMsg = document.getElementById('solicitudsEmptyMsg');

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function solicitudCardHtml(s) {
  return `
    <div class="card" data-id="${s.id}">
      <p><strong>${escapeHtml(s.nom)}</strong> — ${escapeHtml(s.email)}</p>
      ${s.missatge ? `<p class="muted">${escapeHtml(s.missatge)}</p>` : ''}
      <div class="form-actions">
        <button type="button" data-accept="${s.id}">Acceptar</button>
        <button type="button" class="secondary" data-reject="${s.id}">Rebutjar</button>
      </div>
    </div>
  `;
}

async function loadSolicituds() {
  solicitudsError.style.display = 'none';
  try {
    const res = await fetch('/api/admin/solicituds', { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const solicituds = await res.json();
    solicitudsEmptyMsg.style.display = solicituds.length ? 'none' : 'block';
    solicitudsList.innerHTML = solicituds.map(solicitudCardHtml).join('');
  } catch (err) {
    solicitudsError.textContent = err.message;
    solicitudsError.style.display = 'block';
  }
}

solicitudsList.addEventListener('click', async (e) => {
  const acceptBtn = e.target.closest('[data-accept]');
  const rejectBtn = e.target.closest('[data-reject]');
  if (!acceptBtn && !rejectBtn) return;

  const id = (acceptBtn || rejectBtn).dataset.accept || (acceptBtn || rejectBtn).dataset.reject;
  const action = acceptBtn ? 'acceptar' : 'rebutjar';
  if (action === 'rebutjar' && !window.confirm('Segur que vols rebutjar aquesta sol·licitud?')) return;

  try {
    const res = await fetch(`/api/admin/solicituds/${id}/${action}`, { method: 'POST', headers: authHeaders() });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    loadSolicituds();
  } catch (err) {
    solicitudsError.textContent = err.message;
    solicitudsError.style.display = 'block';
  }
});

document.addEventListener('admin-authenticated', loadSolicituds);
