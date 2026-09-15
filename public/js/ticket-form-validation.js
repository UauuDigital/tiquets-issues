// Validació del formulari de tiquets (camps i captures de pantalla).
// Es carrega abans de ticket-form.js, que reutilitza aquestes funcions i
// constants en gestionar l'enviament (comparteixen l'àmbit global de la
// pàgina, com és habitual entre <script> sense type="module").
const descriptionInput = document.getElementById('description');
const reporterEmailInput = document.getElementById('reporterEmail');

const screenshotsInput = document.getElementById('screenshots');
const screenshotsList = document.getElementById('screenshots-list');
const screenshotsBtn = document.getElementById('screenshots-btn');
const screenshotsStatus = document.getElementById('screenshots-status');

const fieldErrors = {
  repoId: document.getElementById('repoId-error'),
  description: document.getElementById('description-error'),
  reporterEmail: document.getElementById('reporterEmail-error'),
  screenshots: document.getElementById('screenshots-error')
};

const MAX_SCREENSHOTS = 3;
const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024;
const ALLOWED_SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

let selectedScreenshots = [];

function syncScreenshotsInput() {
  const dataTransfer = new DataTransfer();
  selectedScreenshots.forEach((file) => dataTransfer.items.add(file));
  screenshotsInput.files = dataTransfer.files;
}

function removeScreenshot(index) {
  selectedScreenshots.splice(index, 1);
  syncScreenshotsInput();
  renderScreenshotsList();
  validateScreenshots();
}

function renderScreenshotsList() {
  screenshotsList.innerHTML = selectedScreenshots
    .map(
      (file, index) => `<li><span>${file.name}</span><button type="button" class="file-list-remove" data-index="${index}" aria-label="${I18N.t('form.removeFile')}">×</button></li>`
    )
    .join('');
  screenshotsStatus.hidden = selectedScreenshots.length > 0;
}

screenshotsList.addEventListener('click', (event) => {
  const btn = event.target.closest('.file-list-remove');
  if (!btn) return;
  removeScreenshot(Number(btn.dataset.index));
});

function validateScreenshots() {
  const files = selectedScreenshots;
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
  selectedScreenshots = selectedScreenshots.concat(Array.from(screenshotsInput.files));
  syncScreenshotsInput();
  renderScreenshotsList();
  validateScreenshots();
});
screenshotsBtn.addEventListener('click', () => screenshotsInput.click());

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
  if (!value) {
    setFieldError(reporterEmailInput, fieldErrors.reporterEmail, ERROR_MESSAGES.emailRequired);
    return false;
  }
  if (!EMAIL_RE.test(value)) {
    setFieldError(reporterEmailInput, fieldErrors.reporterEmail, ERROR_MESSAGES.emailInvalid);
    return false;
  }
  setFieldError(reporterEmailInput, fieldErrors.reporterEmail, '');
  return true;
}
reporterEmailInput.addEventListener('blur', validateEmailField);
