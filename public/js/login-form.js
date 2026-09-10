const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const signedInStatus = document.getElementById('signedInStatus');
const notRegisteredBox = document.getElementById('notRegisteredBox');
const goToRegistreLink = document.getElementById('goToRegistreLink');
const loginTitle = document.getElementById('loginTitle');
const loginSubtitle = document.getElementById('loginSubtitle');
const registreLink = document.getElementById('registreLink');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');
const recoveryBox = document.getElementById('recoveryBox');
const recoveryForm = document.getElementById('recoveryForm');
const recoverySubmitBtn = document.getElementById('recoverySubmitBtn');

async function handleExistingSession() {
  const session = await AuthSession.getSession();
  if (!session) return;

  const usuari = await AuthSession.getUsuari();
  if (usuari && usuari.actiu) {
    window.location.href = 'index.html';
    return;
  }

  loginForm.style.display = 'none';
  signedInStatus.style.display = 'block';
  if (usuari && !usuari.actiu) {
    signedInStatus.textContent = `Sessió iniciada com a ${session.user.email}, però el teu accés ha estat desactivat.`;
  } else {
    signedInStatus.textContent = `Sessió iniciada com a ${session.user.email}, però encara no tens accés aprovat. Sol·licita'l si no ho has fet abans.`;
  }
}

AuthSession.onChange(() => handleExistingSession());
handleExistingSession();

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const email = loginForm.email.value.trim();
  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviant…';
  try {
    if (email.toLowerCase() === 'digital@uauu.cat') {
      const token = loginForm.password.value;
      const verifyRes = await fetch('/api/admin/verify', { headers: { 'x-admin-token': token } });
      if (!verifyRes.ok) {
        formError.textContent = ERROR_MESSAGES.loginFailed;
        formError.style.display = 'block';
        return;
      }
      localStorage.setItem('adminToken', token);
      window.location.href = 'admin.html';
      return;
    }

    const checkRes = await fetch('/api/auth/check-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const checkData = await checkRes.json().catch(() => ({}));
    if (!checkRes.ok) {
      formError.textContent = checkData.error || ERROR_MESSAGES.submitFailed;
      formError.style.display = 'block';
      return;
    }

    if (!checkData.exists) {
      loginForm.style.display = 'none';
      loginTitle.style.display = 'none';
      loginSubtitle.style.display = 'none';
      registreLink.style.display = 'none';
      goToRegistreLink.href = `registre.html?email=${encodeURIComponent(email)}`;
      notRegisteredBox.style.display = 'block';
      return;
    }

    const password = loginForm.password.value;
    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
    if (error) throw error;

    window.location.href = 'index.html';
  } catch (err) {
    const isRateLimited = err && err.status === 429;
    formError.textContent = isRateLimited ? ERROR_MESSAGES.loginRateLimited : ERROR_MESSAGES.loginFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Inicia sessió';
  }
});

forgotPasswordLink.addEventListener('click', (e) => {
  e.preventDefault();
  loginForm.style.display = 'none';
  forgotPasswordLink.style.display = 'none';
  recoveryBox.style.display = 'block';
  formError.style.display = 'none';
  formSuccess.style.display = 'none';
});

backToLoginLink.addEventListener('click', (e) => {
  e.preventDefault();
  recoveryBox.style.display = 'none';
  loginForm.style.display = 'block';
  forgotPasswordLink.style.display = 'block';
  formSuccess.style.display = 'none';
});

recoveryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';
  recoverySubmitBtn.disabled = true;
  recoverySubmitBtn.textContent = 'Enviant…';
  try {
    await fetch('/api/auth/recuperar-contrasenya', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: recoveryForm.recoveryEmail.value.trim() })
    });
  } catch (err) {
    // Ignorem errors de xarxa: el missatge mostrat és sempre el mateix.
  } finally {
    recoveryBox.style.display = 'none';
    loginForm.style.display = 'block';
    forgotPasswordLink.style.display = 'block';
    formSuccess.textContent = ERROR_MESSAGES.recoveryEmailSent;
    formSuccess.style.display = 'block';
    recoverySubmitBtn.disabled = false;
    recoverySubmitBtn.textContent = 'Enviar enllaç';
  }
});
