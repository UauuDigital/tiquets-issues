const ERROR_MESSAGES = {
  get repoRequired() { return I18N.t('error.repoRequired'); },
  get descriptionRequired() { return I18N.t('error.descriptionRequired'); },
  get emailInvalid() { return I18N.t('error.emailInvalid'); },
  get tooManyScreenshots() { return I18N.t('error.tooManyScreenshots'); },
  get screenshotTooLarge() { return I18N.t('error.screenshotTooLarge'); },
  get screenshotInvalidType() { return I18N.t('error.screenshotInvalidType'); },
  get submitFailed() { return I18N.t('error.submitFailed'); },
  get loginRateLimited() { return I18N.t('error.loginRateLimited'); }
};
