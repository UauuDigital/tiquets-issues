const authGate = document.getElementById('authGate');
const authGateMessage = document.getElementById('authGateMessage');
const authGateLink = document.getElementById('authGateLink');
const headerLoginLink = document.getElementById('headerLoginLink');
const adminLink = document.getElementById('adminLink');
const ticketBlock = document.querySelector('.ticket');

let cachedAccessToken = null;

// La icona nomes es mostra si l'email de la sessio activa es a
// window.ADMIN_EMAILS (exposat per /js/supabase-config.js a partir de
// ADMIN_NOTIFY_EMAILS). Nomes es un ajut de navegacio: l'accés real a
// /admin.html el protegeix ADMIN_TOKEN, no aquesta comprovació.
function syncAdminLink(usuari) {
  if (!adminLink) return;
  const adminEmails = window.ADMIN_EMAILS || [];
  const isAdmin = usuari && adminEmails.includes((usuari.email || '').toLowerCase());
  adminLink.hidden = !isAdmin;
}

async function syncAuthGate() {
  const session = await AuthSession.getSession();
  if (!session) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'Cal iniciar sessió per crear un tiquet nou.';
    authGateLink.textContent = 'Iniciar sessió';
    authGateLink.href = 'login.html';
    if (headerLoginLink) {
      headerLoginLink.textContent = 'Iniciar sessió →';
      headerLoginLink.onclick = null;
      headerLoginLink.href = 'login.html';
    }
    syncAdminLink(null);
    return;
  }

  const usuari = await AuthSession.getUsuari();
  if (!usuari || !usuari.actiu) {
    cachedAccessToken = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    authGateMessage.textContent = 'La teva sol·licitud d\'accés encara no ha estat aprovada per un administrador.';
    authGateLink.textContent = 'Sol·licitar accés';
    authGateLink.href = 'registre.html';
    if (headerLoginLink) {
      headerLoginLink.textContent = 'Iniciar sessió →';
      headerLoginLink.onclick = null;
      headerLoginLink.href = 'login.html';
    }
    syncAdminLink(null);
    return;
  }

  cachedAccessToken = session.access_token;
  authGate.hidden = true;
  ticketBlock.hidden = false;
  if (headerLoginLink) {
    headerLoginLink.textContent = `Tancar sessió (${usuari.nom}) →`;
    headerLoginLink.href = '#';
    headerLoginLink.onclick = (e) => { e.preventDefault(); AuthSession.signOut(); };
  }
  syncAdminLink(usuari);
}

AuthSession.onChange(() => syncAuthGate());
syncAuthGate();

const form = document.getElementById('ticket-form');
const submitBtn = document.getElementById('submit-btn');
const submitBtnText = document.getElementById('submit-btn-text');
const submitBtnMobile = document.getElementById('submit-btn-mobile');
const submitBtnTextMobile = document.getElementById('submit-btn-text-mobile');
const ticketActionsMobile = document.getElementById('ticket-actions-mobile');
const formError = document.getElementById('form-error');
const confirmView = document.getElementById('confirm-view');
const confirmText = document.getElementById('confirm-text');
const issueLink = document.getElementById('issue-link');
const againBtn = document.getElementById('again-btn');

const stubNumber = document.getElementById('stub-number');
const stubCategory = document.getElementById('stub-category');
const stubPriority = document.getElementById('stub-priority');
const stubPriorityText = document.getElementById('stub-priority-text');
const stubPriorityIcon = document.getElementById('stub-priority-icon');
const stubTitle = document.getElementById('stub-title');
const stubReporter = document.getElementById('stub-reporter');

const descriptionInput = document.getElementById('description');
const reporterNameInput = document.getElementById('reporterName');
const reporterEmailInput = document.getElementById('reporterEmail');
const emailSuggestDatalist = document.getElementById('emailSuggest');

const screenshotsInput = document.getElementById('screenshots');
const screenshotsList = document.getElementById('screenshots-list');

const fieldErrors = {
  repoId: document.getElementById('repoId-error'),
  description: document.getElementById('description-error'),
  reporterEmail: document.getElementById('reporterEmail-error'),
  screenshots: document.getElementById('screenshots-error')
};

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

function renderScreenshotsList() {
  screenshotsList.innerHTML = Array.from(screenshotsInput.files)
    .map((file) => `<li>${file.name}</li>`)
    .join('');
}

function validateScreenshots() {
  const files = Array.from(screenshotsInput.files);
  if (files.length > MAX_SCREENSHOTS) {
    fieldErrors.screenshots.textContent = ERROR_MESSAGES.tooManyScreenshots;
    return false;
  }
  if (files.some((file) => !ALLOWED_SCREENSHOT_TYPES.includes(file.type))) {
    fieldErrors.screenshots.textContent = ERROR_MESSAGES.screenshotInvalidType;
    return false;
  }
  if (files.some((file) => file.size > MAX_SCREENSHOT_SIZE)) {
    fieldErrors.screenshots.textContent = ERROR_MESSAGES.screenshotTooLarge;
    return false;
  }
  fieldErrors.screenshots.textContent = '';
  return true;
}
screenshotsInput.addEventListener('change', () => {
  renderScreenshotsList();
  validateScreenshots();
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setFieldError(fieldEl, errorEl, message) {
  errorEl.textContent = message || '';
  fieldEl.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function clearAllFieldErrors() {
  setFieldError(descriptionInput, fieldErrors.description, '');
  setFieldError(reporterEmailInput, fieldErrors.reporterEmail, '');
  fieldErrors.repoId.textContent = '';
  fieldErrors.screenshots.textContent = '';
  repoCustomSelect.setInvalid(false);
}

function validateEmailField() {
  const value = reporterEmailInput.value.trim();
  if (value && !EMAIL_RE.test(value)) {
    setFieldError(reporterEmailInput, fieldErrors.reporterEmail, ERROR_MESSAGES.emailInvalid);
    return false;
  }
  setFieldError(reporterEmailInput, fieldErrors.reporterEmail, '');
  return true;
}
reporterEmailInput.addEventListener('blur', validateEmailField);

const EMAIL_DOMAIN = '@uauu.cat';
reporterEmailInput.addEventListener('input', () => {
  const value = reporterEmailInput.value;
  if (value && !value.includes('@')) {
    emailSuggestDatalist.innerHTML = `<option value="${value}${EMAIL_DOMAIN}"></option>`;
  } else {
    emailSuggestDatalist.innerHTML = '';
  }
});

const categorySelect = document.getElementById('category');
const prioritySlider = document.getElementById('priority-slider');
const priorityRange = document.getElementById('priority-range');
const priorityBubble = document.getElementById('priority-bubble');
const priorityTicks = document.querySelectorAll('#priority-ticks span');
const repoSelect = document.getElementById('repoId');
const projectDescription = document.getElementById('project-description');
const departmentSelect = document.getElementById('department');

const PRIORITY_LEVELS = ['baixa', 'mitjana', 'alta', 'critica'];

const repoCustomSelect = enhanceSelect(repoSelect);
const categoryCustomSelect = enhanceSelect(categorySelect);
const departmentCustomSelect = enhanceSelect(departmentSelect);
repoCustomSelect.describeWith('repoId-error');

let repoDescriptions = {};

function syncProjectDescription() {
  const description = repoDescriptions[repoSelect.value];
  if (description) {
    projectDescription.textContent = description;
    projectDescription.classList.add('visible');
  } else {
    projectDescription.textContent = '';
    projectDescription.classList.remove('visible');
  }
}
repoSelect.addEventListener('change', syncProjectDescription);

async function loadRepos() {
  try {
    const res = await fetch('/api/repos');
    const repos = await res.json();
    repoSelect.innerHTML = '';
    if (!repos.length) {
      repoSelect.innerHTML = '<option value="" disabled selected>No hi ha projectes configurats</option>';
      return;
    }
    repoDescriptions = Object.fromEntries(repos.map((r) => [r.id, r.description || '']));
    repoSelect.innerHTML = repos
      .map((r) => `<option value="${r.id}">${r.label}</option>`)
      .join('');

    const requestedRepo = new URLSearchParams(window.location.search).get('repo');
    if (requestedRepo && repos.some((r) => r.id === requestedRepo)) {
      repoSelect.value = requestedRepo;
    }
  } catch (err) {
    repoSelect.innerHTML = '<option value="" disabled selected>Error carregant projectes</option>';
  } finally {
    repoCustomSelect.refresh();
    syncProjectDescription();
  }
}
loadRepos();

async function loadNextTicketNumber() {
  try {
    const res = await fetch('/api/tickets/next-number');
    const data = await res.json();
    if (data.next) {
      stubNumber.textContent = '#' + data.next;
      stubNumber.title = 'Número orientatiu: GitHub assignarà el número definitiu en crear el tiquet.';
    }
  } catch (err) {
    // Si falla, es queda el placeholder per defecte ("— — —").
  }
}
loadNextTicketNumber();

const PRIORITY_TEXT = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };
const PRIORITY_ICONS = {
  baixa: '<path d="M10 4v11M6 11l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  mitjana: '<path d="M4 8h12M4 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  alta: '<path d="M10 16V5M6 9l4-4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  critica: '<path d="M10 3.5L18 16H2L10 3.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 8.5v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="14" r="0.9" fill="currentColor"/>'
};

function syncStub() {
  stubCategory.textContent = categorySelect.options[categorySelect.selectedIndex].text;
}
categorySelect.addEventListener('change', syncStub);
syncStub();

function syncStubField(el, sourceValue, placeholder) {
  const value = sourceValue.trim();
  if (value) {
    el.textContent = value;
    el.classList.remove('placeholder');
  } else {
    el.textContent = placeholder;
    el.classList.add('placeholder');
  }
}

function syncDescriptionStub() {
  syncStubField(stubTitle, descriptionInput.value, '—');
}
descriptionInput.addEventListener('input', syncDescriptionStub);
syncDescriptionStub();

function syncReporter() {
  syncStubField(stubReporter, reporterNameInput.value, 'Anònim');
}
reporterNameInput.addEventListener('input', syncReporter);
syncReporter();

function syncPriority() {
  const level = PRIORITY_LEVELS[Number(priorityRange.value)];
  const pct = Number(priorityRange.value) / (PRIORITY_LEVELS.length - 1);

  prioritySlider.dataset.level = level;
  priorityBubble.textContent = PRIORITY_TEXT[level];

  const trackWidth = priorityRange.offsetWidth;
  const bubbleWidth = priorityBubble.offsetWidth;
  const rawLeft = pct * trackWidth;
  const clampedLeft = Math.min(Math.max(rawLeft, bubbleWidth / 2), trackWidth - bubbleWidth / 2);
  priorityBubble.style.left = clampedLeft + 'px';

  priorityTicks.forEach((tick) => {
    tick.classList.toggle('active', tick.dataset.value === level);
  });

  stubPriorityText.textContent = PRIORITY_TEXT[level];
  stubPriorityIcon.innerHTML = PRIORITY_ICONS[level];
  stubPriority.dataset.level = level;
}
priorityRange.addEventListener('input', syncPriority);
syncPriority();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.textContent = '';
  formError.classList.remove('error');
  clearAllFieldErrors();

  const payload = {
    description: form.description.value,
    repoId: form.repoId.value
  };

  let firstInvalid = null;

  if (!payload.repoId) {
    fieldErrors.repoId.textContent = ERROR_MESSAGES.repoRequired;
    repoCustomSelect.setInvalid(true);
    firstInvalid = firstInvalid || repoCustomSelect.trigger;
  }
  if (!payload.description.trim()) {
    setFieldError(descriptionInput, fieldErrors.description, ERROR_MESSAGES.descriptionRequired);
    firstInvalid = firstInvalid || descriptionInput;
  }
  if (!validateEmailField()) {
    firstInvalid = firstInvalid || reporterEmailInput;
  }
  if (!validateScreenshots()) {
    firstInvalid = firstInvalid || screenshotsInput;
  }

  if (firstInvalid) {
    firstInvalid.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtnText.textContent = 'Enviant…';
  submitBtnMobile.disabled = true;
  submitBtnTextMobile.textContent = 'Enviant…';

  const formData = new FormData();
  formData.append('description', form.description.value);
  formData.append('category', form.category.value);
  formData.append('repoId', form.repoId.value);
  formData.append('priority', PRIORITY_LEVELS[Number(priorityRange.value)] || 'baixa');
  formData.append('reporterName', form.reporterName.value);
  formData.append('reporterEmail', form.reporterEmail.value);
  formData.append('department', form.department.value);
  formData.append('website', form.website.value); // honeypot
  Array.from(screenshotsInput.files).forEach((file) => formData.append('screenshots', file));

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: cachedAccessToken ? { Authorization: `Bearer ${cachedAccessToken}` } : {},
      body: formData
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || ERROR_MESSAGES.submitFailed);
    }

    if (data.number) {
      stubNumber.textContent = '#' + data.number;
      confirmText.textContent = `L'equip tècnic ja té la incidència número ${data.number}.`;
      issueLink.href = data.url;
      issueLink.textContent = 'Veure la incidència a GitHub ↗';
      issueLink.style.display = 'inline-block';
    } else {
      confirmText.textContent = 'L\'equip tècnic ja té la incidència.';
      issueLink.style.display = 'none';
    }

    form.style.display = 'none';
    ticketActionsMobile.style.display = 'none';
    confirmView.classList.add('visible');
  } catch (err) {
    formError.textContent = err.message || ERROR_MESSAGES.submitFailed;
    formError.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtnText.textContent = 'Enviar tiquet';
    submitBtnMobile.disabled = false;
    submitBtnTextMobile.textContent = 'Enviar tiquet';
  }
});

againBtn.addEventListener('click', () => {
  form.reset();
  loadNextTicketNumber();
  syncStub();
  syncPriority();
  syncDescriptionStub();
  syncReporter();
  clearAllFieldErrors();
  screenshotsList.innerHTML = '';
  formError.textContent = '';
  formError.classList.remove('error');
  departmentCustomSelect.refresh();
  categoryCustomSelect.refresh();
  repoCustomSelect.refresh();
  syncProjectDescription();
  confirmView.classList.remove('visible');
  form.style.display = 'block';
  ticketActionsMobile.style.display = '';
});

// Manté la mossegada circular de la costura mòbil (ticket.css) enganxada
// al final real de .ticket-main, que canvia d'alçada amb els errors,
// la descripció del projecte o la vista de confirmació.
const ticketEl = document.querySelector('.ticket');
const ticketMainEl = document.querySelector('.ticket-main');
if (ticketEl && ticketMainEl && 'ResizeObserver' in window) {
  const updateSeamY = () => {
    ticketEl.style.setProperty('--ticket-seam-y', `${ticketMainEl.offsetHeight}px`);
  };
  new ResizeObserver(updateSeamY).observe(ticketMainEl);
  updateSeamY();
}
