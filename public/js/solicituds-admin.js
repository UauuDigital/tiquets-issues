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
    <div class="card solicitud-card" data-id="${s.id}">
      <div class="solicitud-info">
        <p class="solicitud-name"><strong>${escapeHtml(s.nom)}</strong> — ${escapeHtml(s.email)}</p>
        ${s.missatge ? `<p class="solicitud-message">${escapeHtml(s.missatge)}</p>` : ''}
      </div>
      <div class="solicitud-actions">
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

const usuarisList = document.getElementById('usuarisList');
const usuarisError = document.getElementById('usuarisError');
const usuarisEmptyMsg = document.getElementById('usuarisEmptyMsg');

function usuariCardHtml(u) {
  return `
    <div class="card solicitud-card" data-id="${u.id}">
      <div class="solicitud-info">
        <p class="solicitud-name"><strong>${escapeHtml(u.nom || '(sense nom)')}</strong> — ${escapeHtml(u.email)}</p>
        <p class="solicitud-message">${u.actiu ? 'Accés actiu' : 'Accés revocat'}</p>
      </div>
      <div class="solicitud-actions">
        ${u.actiu
          ? `<button type="button" class="secondary" data-revoke="${u.id}">Revocar accés</button>`
          : `<button type="button" data-restore="${u.id}">Restaurar accés</button>
             <button type="button" class="secondary" data-delete="${u.id}">Eliminar usuari</button>`}
      </div>
    </div>
  `;
}

async function loadUsuaris() {
  usuarisError.style.display = 'none';
  try {
    const res = await fetch('/api/admin/usuaris', { headers: authHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    const usuaris = await res.json();
    usuarisEmptyMsg.style.display = usuaris.length ? 'none' : 'block';
    usuarisList.innerHTML = usuaris.map(usuariCardHtml).join('');
  } catch (err) {
    usuarisError.textContent = err.message;
    usuarisError.style.display = 'block';
  }
}

usuarisList.addEventListener('click', async (e) => {
  const revokeBtn = e.target.closest('[data-revoke]');
  const restoreBtn = e.target.closest('[data-restore]');
  const deleteBtn = e.target.closest('[data-delete]');
  if (!revokeBtn && !restoreBtn && !deleteBtn) return;

  usuarisError.style.display = 'none';

  if (deleteBtn) {
    if (!window.confirm('Segur que vols eliminar definitivament aquest usuari? Aquesta acció no es pot desfer.')) return;
    try {
      const res = await fetch(`/api/admin/usuaris/${deleteBtn.dataset.delete}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Error ${res.status}`);
      }
      loadUsuaris();
    } catch (err) {
      usuarisError.textContent = err.message;
      usuarisError.style.display = 'block';
    }
    return;
  }

  const id = (revokeBtn || restoreBtn).dataset.revoke || (revokeBtn || restoreBtn).dataset.restore;
  const actiu = !!restoreBtn;
  if (revokeBtn && !window.confirm('Segur que vols revocar l\'accés d\'aquest usuari?')) return;

  try {
    const res = await fetch(`/api/admin/usuaris/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ actiu })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    loadUsuaris();
  } catch (err) {
    usuarisError.textContent = err.message;
    usuarisError.style.display = 'block';
  }
});

document.addEventListener('admin-authenticated', loadSolicituds);
document.addEventListener('admin-authenticated', loadUsuaris);
