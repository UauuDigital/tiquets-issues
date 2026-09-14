// L'accés directe a la incidència de GitHub només es mostra a
// digital@uauu.cat (l'únic compte d'administració), no a la resta
// d'usuaris del portal que consulten aquesta vista pública de tiquets.
const ADMIN_EMAIL = 'digital@uauu.cat';
let isAdminSession = false;

function renderAuthGateTexts() {
  if (authGate.hidden) return;
  if (currentUsuari === 'not-approved') {
    authGateMessage.textContent = I18N.t('authGate.notApproved');
    authGateLink.textContent = I18N.t('authGate.requestAccess');
  } else {
    authGateMessage.textContent = I18N.t('authGate.noSessionView');
    authGateLink.textContent = I18N.t('nav.login');
  }
}

async function syncAuthGate() {
  const session = await AuthSession.getSession();
  if (!session) {
    userAccessToken = null;
    currentUsuari = null;
    isAdminSession = false;
    authGate.hidden = false;
    if (pageHead) pageHead.hidden = true;
    activityToggle.hidden = true;
    ticketsLayout.hidden = true;
    renderAuthGateTexts();
    authGateLink.href = 'login.html';
    return;
  }

  const usuari = await AuthSession.getUsuari();
  if (!usuari || !usuari.actiu) {
    userAccessToken = null;
    currentUsuari = 'not-approved';
    isAdminSession = false;
    authGate.hidden = false;
    if (pageHead) pageHead.hidden = true;
    activityToggle.hidden = true;
    ticketsLayout.hidden = true;
    renderAuthGateTexts();
    authGateLink.href = 'registre.html';
    return;
  }

  userAccessToken = session.access_token;
  currentUsuari = usuari;
  isAdminSession = (usuari.email || '').toLowerCase() === ADMIN_EMAIL;
  authGate.hidden = true;
  if (pageHead) pageHead.hidden = false;
  activityToggle.hidden = false;
  ticketsLayout.hidden = false;
  syncCommentAs();
  loadTickets();
  loadActivity();
}

AuthSession.onChange(() => syncAuthGate());
syncAuthGate();

document.addEventListener('i18n:change', () => {
  renderAuthGateTexts();
  rebuildLabelMaps();
  rebuildUrgencyLabels();
  if (typeof renderFilteredTickets === 'function') renderFilteredTickets();
  if (currentModalTicketId) {
    const t = allTickets.find((x) => x.id === currentModalTicketId);
    if (t) populateModal(t);
  }
  syncCommentAs();
  renderActivity(lastActivityEntries);
});
