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

    const { error } = await window.supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login.html', shouldCreateUser: false }
    });
    if (error) throw error;

    loginForm.style.display = 'none';
    formSuccess.textContent = 'T\'hem enviat un enllaç d\'accés al teu correu. Obre\'l des d\'aquest mateix dispositiu.';
    formSuccess.style.display = 'block';
  } catch (err) {
    const isRateLimited = err && (err.code === 'over_email_send_rate_limit' || err.status === 429);
    formError.textContent = isRateLimited ? ERROR_MESSAGES.loginRateLimited : ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar enllaç d\'accés';
  }
});
