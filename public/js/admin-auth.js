/**
 * Comprovació d'accés compartida per a les pàgines d'administració
 * (admin.html, tickets-admin.html, solicituds-admin.html). L'admin és un
 * usuari normal del portal (sessió de Supabase Auth, mateix login.html que
 * tothom): només hi té accés si el correu de la sessió activa és
 * digital@uauu.cat. Cap altra credencial (ADMIN_TOKEN) hi intervé.
 *
 * Cada pàgina ha d'embolcallar el seu contingut amb:
 *   <div id="adminApp" hidden> ... </div>
 */
(function () {
  const appEl = document.getElementById('adminApp');
  const ADMIN_EMAIL = 'digital@uauu.cat';

  async function boot() {
    const session = await AuthSession.getSession();
    const isAdmin = session && (session.user.email || '').toLowerCase() === ADMIN_EMAIL;
    if (!isAdmin) {
      window.location.href = 'login.html';
      return;
    }
    window.adminAccessToken = session.access_token;
    appEl.hidden = false;
    document.dispatchEvent(new CustomEvent('admin-authenticated'));
  }

  function logout() {
    AuthSession.signOut().finally(() => { window.location.href = 'login.html'; });
  }
  document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', logout));

  boot();
})();
