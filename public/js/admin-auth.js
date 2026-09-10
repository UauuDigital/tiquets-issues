/**
 * Comprovació d'accés compartida per a les pàgines d'administració
 * (admin.html, tickets-admin.html, solicituds-admin.html). El login en si es
 * fa des de login.html (correu "digital@uauu.cat" + ADMIN_TOKEN com a contrasenya); aquí
 * només es verifica el token desat i, si no n'hi ha o ja no és vàlid, es
 * redirigeix a login.html.
 *
 * Cada pàgina ha d'embolcallar el seu contingut amb:
 *   <div id="adminApp" hidden> ... </div>
 */
(function () {
  const appEl = document.getElementById('adminApp');

  function goToLogin() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
  }

  async function verifyToken(token) {
    const res = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } });
    return res.ok;
  }

  async function boot() {
    const stored = localStorage.getItem('adminToken');
    if (!stored) {
      goToLogin();
      return;
    }
    const valid = await verifyToken(stored);
    if (!valid) {
      goToLogin();
      return;
    }
    appEl.hidden = false;
    document.dispatchEvent(new CustomEvent('admin-authenticated'));
  }

  function logout() {
    localStorage.removeItem('adminToken');
    window.location.href = 'login.html';
  }
  document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', logout));

  boot();
})();
