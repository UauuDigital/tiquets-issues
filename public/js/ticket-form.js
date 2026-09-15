const authGate = document.getElementById('authGate');
const authGateMessage = document.getElementById('authGateMessage');
const authGateLink = document.getElementById('authGateLink');
const pageHead = document.getElementById('pageHead');
const headerLoginLink = document.getElementById('headerLoginLink');
const headerAccountLink = document.getElementById('headerAccountLink');
const adminLink = document.getElementById('adminLink');
const ticketBlock = document.querySelector('.ticket');

let cachedAccessToken = null;

// La icona nomes es mostra si l'email de la sessio activa es a
// window.ADMIN_EMAILS (exposat per /js/supabase-config.js a partir de
// ADMIN_NOTIFY_EMAILS). Nomes es un ajut de navegacio: l'accés real a
// /admin.html el protegeix require-admin.js (sessio de Supabase +
// digital@uauu.cat), no aquesta comprovació.
function syncAdminLink(usuari) {
  if (!adminLink) return;
  const adminEmails = window.ADMIN_EMAILS || [];
  const isAdmin = usuari && adminEmails.includes((usuari.email || '').toLowerCase());
  adminLink.hidden = !isAdmin;
}

let currentUsuari = null;

function renderAuthGateTexts() {
  if (authGate.hidden) return;
  if (currentUsuari === 'not-approved') {
    authGateMessage.textContent = I18N.t('authGate.notApproved');
    authGateLink.textContent = I18N.t('authGate.requestAccess');
  } else {
    authGateMessage.textContent = I18N.t('authGate.noSession');
    authGateLink.textContent = I18N.t('nav.login');
  }
}

function renderHeaderLoginLink() {
  if (!headerLoginLink || !currentUsuari || currentUsuari === 'not-approved') return;
  headerLoginLink.textContent = I18N.t('nav.logoutWith', { name: currentUsuari.nom });
}

async function syncAuthGate() {
  const session = await AuthSession.getSession();
  if (!session) {
    cachedAccessToken = null;
    currentUsuari = null;
    authGate.hidden = false;
    ticketBlock.hidden = true;
    if (pageHead) pageHead.hidden = true;
    renderAuthGateTexts();
    authGateLink.href = 'login.html';
    syncAdminLink(null);
    if (headerAccountLink) headerAccountLink.hidden = true;
    return;
  }

  const usuari = await AuthSession.getUsuari();
  if (!usuari || !usuari.actiu) {
    cachedAccessToken = null;
    currentUsuari = 'not-approved';
    authGate.hidden = false;
    ticketBlock.hidden = true;
    if (pageHead) pageHead.hidden = true;
    renderAuthGateTexts();
    authGateLink.href = 'registre.html';
    syncAdminLink(null);
    if (headerAccountLink) headerAccountLink.hidden = true;
    return;
  }

  cachedAccessToken = session.access_token;
  currentUsuari = usuari;
  authGate.hidden = true;
  ticketBlock.hidden = false;
  if (pageHead) pageHead.hidden = false;
  if (headerAccountLink) headerAccountLink.hidden = false;
  if (reporterNameInput) {
    reporterNameInput.value = usuari.nom || '';
    syncReporter();
  }
  if (reporterEmailInput) {
    reporterEmailInput.value = usuari.email || '';
  }
  if (headerLoginLink) {
    renderHeaderLoginLink();
    headerLoginLink.href = '#';
    headerLoginLink.onclick = (e) => {
      e.preventDefault();
      if (window.confirm(I18N.t('nav.logoutConfirm'))) AuthSession.signOut();
    };
  }
  syncAdminLink(usuari);
}

AuthSession.onChange(() => syncAuthGate());
syncAuthGate();

document.addEventListener('i18n:change', () => {
  renderAuthGateTexts();
  renderHeaderLoginLink();
});

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

const reporterNameInput = document.getElementById('reporterName');

const categorySelect = document.getElementById('category');
const prioritySlider = document.getElementById('priority-slider');
const priorityRange = document.getElementById('priority-range');
const priorityBubble = document.getElementById('priority-bubble');
const priorityTicks = document.querySelectorAll('#priority-ticks span');
const repoSelect = document.getElementById('repoId');
const projectDescription = document.getElementById('project-description');

const PRIORITY_LEVELS = ['baixa', 'mitjana', 'alta', 'critica'];

const repoCustomSelect = enhanceSelect(repoSelect);
const categoryCustomSelect = enhanceSelect(categorySelect);
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
      repoSelect.innerHTML = `<option value="" disabled selected>${I18N.t('form.noProjects')}</option>`;
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
    repoSelect.innerHTML = `<option value="" disabled selected>${I18N.t('form.errorLoadingProjects')}</option>`;
  } finally {
    repoCustomSelect.refresh();
    syncProjectDescription();
    loadNextTicketNumber();
  }
}
loadRepos();

// El primer dígit del número identifica sempre el repositori (numberPrefix
// a repos.json); es destaca en negreta perquè es distingeixi del número
// real de la issue de GitHub.
function ticketNumberHtml(number) {
  const str = String(number);
  return `<b>${str.charAt(0)}</b><span style="font-weight:400">${str.slice(1)}</span>`;
}

async function loadNextTicketNumber() {
  if (!repoSelect.value) return;
  try {
    const res = await fetch(`/api/tickets/next-number?repoId=${encodeURIComponent(repoSelect.value)}`);
    const data = await res.json();
    if (data.next) {
      stubNumber.innerHTML = '#' + ticketNumberHtml(data.next);
      stubNumber.title = I18N.t('stub.numberHint');
    }
  } catch (err) {
    // Si falla, es queda el placeholder per defecte ("— — —").
  }
}
repoSelect.addEventListener('change', loadNextTicketNumber);

function priorityText(level) { return I18N.t(`priority.${level}`); }
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
  syncStubField(stubReporter, reporterNameInput.value, I18N.t('stub.anonymous'));
}
reporterNameInput.addEventListener('input', syncReporter);
syncReporter();

function syncPriority() {
  const level = PRIORITY_LEVELS[Number(priorityRange.value)];
  const pct = Number(priorityRange.value) / (PRIORITY_LEVELS.length - 1);

  prioritySlider.dataset.level = level;
  priorityBubble.textContent = priorityText(level);

  const trackWidth = priorityRange.offsetWidth;
  const bubbleWidth = priorityBubble.offsetWidth;
  const rawLeft = pct * trackWidth;
  const clampedLeft = Math.min(Math.max(rawLeft, bubbleWidth / 2), trackWidth - bubbleWidth / 2);
  priorityBubble.style.left = clampedLeft + 'px';

  priorityTicks.forEach((tick) => {
    tick.classList.toggle('active', tick.dataset.value === level);
  });

  stubPriorityText.textContent = priorityText(level);
  stubPriorityIcon.innerHTML = PRIORITY_ICONS[level];
  stubPriority.dataset.level = level;
}
priorityRange.addEventListener('input', syncPriority);
syncPriority();

document.addEventListener('i18n:change', () => {
  categoryCustomSelect.refresh();
  repoCustomSelect.refresh();
  syncStub();
  syncPriority();
  syncReporter();
  if (stubNumber.title) stubNumber.title = I18N.t('stub.numberHint');
});

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
  submitBtnText.textContent = I18N.t('form.submitting');
  submitBtnMobile.disabled = true;
  submitBtnTextMobile.textContent = I18N.t('form.submitting');

  const formData = new FormData();
  formData.append('description', form.description.value);
  formData.append('category', form.category.value);
  formData.append('repoId', form.repoId.value);
  formData.append('priority', PRIORITY_LEVELS[Number(priorityRange.value)] || 'baixa');
  formData.append('reporterName', form.reporterName.value);
  formData.append('reporterEmail', form.reporterEmail.value);
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
      stubNumber.innerHTML = '#' + ticketNumberHtml(data.number);
      confirmText.textContent = I18N.t('confirm.textWithNumber', { number: data.number });
      issueLink.href = data.url;
      issueLink.textContent = I18N.t('confirm.viewIssue');
      issueLink.style.display = 'inline-block';
    } else {
      confirmText.textContent = I18N.t('confirm.defaultText');
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
    submitBtnText.textContent = I18N.t('form.submit');
    submitBtnMobile.disabled = false;
    submitBtnTextMobile.textContent = I18N.t('form.submit');
  }
});

againBtn.addEventListener('click', () => {
  form.reset();
  if (currentUsuari && currentUsuari !== 'not-approved') {
    reporterNameInput.value = currentUsuari.nom || '';
    reporterEmailInput.value = currentUsuari.email || '';
  }
  loadNextTicketNumber();
  syncStub();
  syncPriority();
  syncDescriptionStub();
  syncReporter();
  clearAllFieldErrors();
  selectedScreenshots = [];
  screenshotsList.innerHTML = '';
  screenshotsStatus.hidden = false;
  formError.textContent = '';
  formError.classList.remove('error');
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
