const loginForm = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const signedInStatus = document.getElementById('signedInStatus');

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
    const { error } = await window.supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + '/login.html' }
    });
    if (error) throw error;

    loginForm.style.display = 'none';
    formSuccess.textContent = 'T\'hem enviat un enllaç d\'accés al teu correu. Obre\'l des d\'aquest mateix dispositiu.';
    formSuccess.style.display = 'block';
  } catch (err) {
    formError.textContent = ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar enllaç d\'accés';
  }
});
