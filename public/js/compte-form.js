const changePasswordForm = document.getElementById('changePasswordForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');

async function guardSession() {
  const session = await AuthSession.getSession();
  if (!session) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}
guardSession();

changePasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const session = await guardSession();
  if (!session) return;

  const current = changePasswordForm.currentPassword.value;
  const next = changePasswordForm.newPassword.value;
  const repeat = changePasswordForm.newPasswordRepeat.value;

  if (next.length < 8) {
    formError.textContent = ERROR_MESSAGES.passwordTooShort;
    formError.style.display = 'block';
    return;
  }
  if (next !== repeat) {
    formError.textContent = ERROR_MESSAGES.passwordsDontMatch;
    formError.style.display = 'block';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Comprovant…';
  try {
    // Reautenticació silenciosa: confirma que l'usuari coneix la contrasenya
    // actual abans de permetre canviar-la.
    const { error: reauthError } = await window.supabaseClient.auth.signInWithPassword({
      email: session.user.email,
      password: current
    });
    if (reauthError) {
      formError.textContent = ERROR_MESSAGES.wrongCurrentPassword;
      formError.style.display = 'block';
      return;
    }

    submitBtn.textContent = 'Desant…';
    const { error: updateError } = await window.supabaseClient.auth.updateUser({ password: next });
    if (updateError) throw updateError;

    formSuccess.textContent = 'Contrasenya actualitzada correctament.';
    formSuccess.style.display = 'block';
    changePasswordForm.reset();
  } catch (err) {
    formError.textContent = ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Canviar contrasenya';
  }
});
