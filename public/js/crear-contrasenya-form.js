const setPasswordForm = document.getElementById('setPasswordForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');

// L'enllaç del correu porta el token_hash propi (no l'action_link de
// Supabase, per evitar que un escàner de seguretat del correu el consumeixi
// abans que l'usuari hi cliqui de veritat). Aquí, en carregar la pàgina amb
// JavaScript del navegador real, verifiquem el token i establim la sessió.
const linkParams = new URLSearchParams(window.location.search);
const tokenHash = linkParams.get('token_hash');
const linkType = linkParams.get('type');

async function ensureSessionFromLink() {
  if (tokenHash && linkType) {
    const { error } = await window.supabaseClient.auth.verifyOtp({ token_hash: tokenHash, type: linkType });
    if (error) {
      formError.textContent = ERROR_MESSAGES.invalidResetLink;
      formError.style.display = 'block';
      setPasswordForm.style.display = 'none';
    }
    return;
  }
  // Compatibilitat amb enllaços antics ja enviats abans d'aquest canvi.
  const { data } = await window.supabaseClient.auth.getSession();
  if (!data.session) {
    formError.textContent = ERROR_MESSAGES.invalidResetLink;
    formError.style.display = 'block';
    setPasswordForm.style.display = 'none';
  }
}
ensureSessionFromLink();

setPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const password = setPasswordForm.password.value;
  const passwordRepeat = setPasswordForm.passwordRepeat.value;

  if (password.length < 8) {
    formError.textContent = ERROR_MESSAGES.passwordTooShort;
    formError.style.display = 'block';
    return;
  }
  if (password !== passwordRepeat) {
    formError.textContent = ERROR_MESSAGES.passwordsDontMatch;
    formError.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Desant…';
  try {
    const { error } = await window.supabaseClient.auth.updateUser({ password });
    if (error) throw error;
    formSuccess.textContent = 'Contrasenya creada. Redirigint…';
    formSuccess.style.display = 'block';
    setPasswordForm.style.display = 'none';
    setTimeout(() => { window.location.href = 'index.html'; }, 1200);
  } catch (err) {
    formError.textContent = ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Desar contrasenya';
  }
});
