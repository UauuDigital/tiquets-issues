/**
 * Pantalla de login compartida per a les pàgines d'administració (admin.html,
 * tickets-admin.html). Amaga el contingut fins que el token queda verificat
 * contra el servidor, i n'ofereix el tancament de sessió.
 *
 * Cada pàgina ha d'embolcallar el seu contingut amb:
 *   <div id="adminApp" hidden> ... </div>
 * i incloure un contenidor buit:
 *   <div id="loginScreen" class="login-screen" hidden></div>
 * a sobre.
 */
(function () {
  const appEl = document.getElementById('adminApp');
  const loginEl = document.getElementById('loginScreen');

  loginEl.innerHTML = `
    <div class="login-card">
      <div class="eyebrow"><span class="eyebrow-brand">UAUU</span> · Administració</div>
      <h1>Inicia sessió</h1>
      <p class="subtitle">Introdueix el token d'administració per continuar.</p>
      <p class="error" id="loginError"></p>
      <form id="loginForm">
        <label for="loginToken">Token d'administració</label>
        <input type="password" id="loginToken" placeholder="ADMIN_TOKEN" autocomplete="off" required>
        <button type="submit" id="loginSubmit">Entrar</button>
      </form>
    </div>
  `;

  const loginForm = document.getElementById('loginForm');
  const loginTokenInput = document.getElementById('loginToken');
  const loginSubmit = document.getElementById('loginSubmit');
  const loginError = document.getElementById('loginError');

  function showLogin(message) {
    loginEl.hidden = false;
    appEl.hidden = true;
    if (message) {
      loginError.textContent = message;
      loginError.style.display = 'block';
    }
    loginTokenInput.focus();
  }

  function showApp() {
    loginEl.hidden = true;
    appEl.hidden = false;
    document.dispatchEvent(new CustomEvent('admin-authenticated'));
  }

  async function verifyToken(token) {
    const res = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } });
    return res.ok;
  }

  async function boot() {
    const stored = localStorage.getItem('adminToken');
    if (!stored) {
      showLogin();
      return;
    }
    const valid = await verifyToken(stored);
    if (valid) {
      showApp();
    } else {
      localStorage.removeItem('adminToken');
      showLogin('El token desat ja no és vàlid. Torna a introduir-lo.');
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    const token = loginTokenInput.value.trim();
    if (!token) return;
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Comprovant…';
    try {
      const valid = await verifyToken(token);
      if (!valid) {
        loginError.textContent = 'Token incorrecte.';
        loginError.style.display = 'block';
        return;
      }
      localStorage.setItem('adminToken', token);
      showApp();
    } catch (err) {
      loginError.textContent = 'No s\'ha pogut connectar amb el servidor.';
      loginError.style.display = 'block';
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.textContent = 'Entrar';
    }
  });

  function logout() {
    localStorage.removeItem('adminToken');
    showLogin();
  }
  document.querySelectorAll('[data-logout]').forEach((btn) => btn.addEventListener('click', logout));

  boot();
})();
