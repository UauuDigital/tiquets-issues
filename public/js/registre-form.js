const registreForm = document.getElementById('registreForm');
const submitBtn = document.getElementById('submitBtn');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');

// Si venim del clic al link de verificacio del correu
// (GET /api/auth/verificar-email redirigeix aqui amb ?verificat=ok|error).
const verificatParam = new URLSearchParams(window.location.search).get('verificat');
if (verificatParam === 'ok') {
  registreForm.style.display = 'none';
  formSuccess.textContent = 'Correu confirmat. Un administrador revisarà la teva sol·licitud i rebràs un email quan estigui aprovada.';
  formSuccess.style.display = 'block';
} else if (verificatParam === 'error') {
  formError.textContent = 'L\'enllaç de confirmació no és vàlid o ha caducat. Torna a enviar la sol·licitud.';
  formError.style.display = 'block';
}

registreForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  const nom = registreForm.nom.value.trim();
  const email = registreForm.email.value.trim();
  const missatge = registreForm.missatge.value.trim();

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviant…';
  try {
    const res = await fetch('/api/auth/solicituds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom, email, missatge })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || ERROR_MESSAGES.submitFailed);

    registreForm.style.display = 'none';
    formSuccess.textContent = 'T\'hem enviat un correu de confirmació. Revisa la safata d\'entrada (i la de correu brossa).';
    formSuccess.style.display = 'block';
  } catch (err) {
    formError.textContent = err.message || ERROR_MESSAGES.submitFailed;
    formError.style.display = 'block';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sol·licitar accés';
  }
});
