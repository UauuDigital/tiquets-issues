const zonesBoard = document.getElementById('zonesBoard');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSearchInput = document.getElementById('ticketSearch');
const ticketAuthorSearchInput = document.getElementById('ticketAuthorSearch');
const ticketSearchSuggest = document.getElementById('ticketSearchSuggest');
const ticketAuthorSuggest = document.getElementById('ticketAuthorSuggest');
const ticketProjectFilter = document.getElementById('ticketProjectFilter');
const statusChips = document.getElementById('statusChips');
const priorityChips = document.getElementById('priorityChips');
const ticketsCount = document.getElementById('ticketsCount');

const ticketModal = document.getElementById('ticketModal');
const ticketModalClose = document.getElementById('ticketModalClose');
const commentModal = document.getElementById('commentModal');
const commentModalClose = document.getElementById('commentModalClose');
const commentModalHead = document.getElementById('commentModalHead');
const commentModalBody = document.getElementById('commentModalBody');
const modalUrgency = document.getElementById('modalUrgency');
const modalTitle = document.getElementById('modalTitle');
const modalRepo = document.getElementById('modalRepo');
const modalDescription = document.getElementById('modalDescription');
const modalStatus = document.getElementById('modalStatus');
const modalPriority = document.getElementById('modalPriority');
const modalCategory = document.getElementById('modalCategory');
const modalDepartment = document.getElementById('modalDepartment');
const modalReporter = document.getElementById('modalReporter');
const modalDate = document.getElementById('modalDate');
const modalUrgencyValue = document.getElementById('modalUrgencyValue');
const modalScreenshotsSection = document.getElementById('modalScreenshotsSection');
const modalScreenshots = document.getElementById('modalScreenshots');
const modalComments = document.getElementById('modalComments');
const modalCommentsStatus = document.getElementById('modalCommentsStatus');
const modalCommentForm = document.getElementById('modalCommentForm');
const modalCommentAuthor = document.getElementById('modalCommentAuthor');
const modalCommentAuthorEmail = document.getElementById('modalCommentAuthorEmail');
const modalCommentInput = document.getElementById('modalCommentInput');
const modalCommentError = document.getElementById('modalCommentError');
const modalCommentSubmit = document.getElementById('modalCommentSubmit');

const activityList = document.getElementById('activityList');
const activityStatus = document.getElementById('activityStatus');
const activityCard = document.getElementById('activityCard');
const activityToggle = document.getElementById('activityToggle');
const activityClose = document.getElementById('activityClose');
const activityBackdrop = document.getElementById('activityBackdrop');

let allTickets = [];
let ticketSearchQuery = '';
let ticketAuthorQuery = '';
let ticketStatusQuery = '';
let ticketPriorityQuery = '';
let ticketProjectQuery = '';
let currentModalTicketId = null;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Es reomplen a rebuildLabelMaps() amb el text de l'idioma actiu; l'objecte
// es manté sempre el mateix (Object.assign), perquè board-core.js/board.js/
// modal.js/activity.js hi guarden una referència directa.
const PRIORITY_LABELS_CA = {};
const CATEGORY_LABELS_CA = {};
const DEPARTMENT_LABELS_CA = {};
const STATUS_LABELS = {};
const PRIORITY_ORDER = { critica: 4, alta: 3, mitjana: 2, baixa: 1 };
const STATUS_ORDER = { comencat: 3, en_espera: 2, no_comencat: 1, acabat: 0, cancelat: 0 };

function rebuildLabelMaps() {
  Object.assign(PRIORITY_LABELS_CA, {
    baixa: I18N.t('priority.baixa'), mitjana: I18N.t('priority.mitjana'), alta: I18N.t('priority.alta'), critica: I18N.t('priority.critica')
  });
  Object.assign(CATEGORY_LABELS_CA, {
    bug: I18N.t('category.bug'), funcionalitat: I18N.t('category.funcionalitat'), acces: I18N.t('category.acces'), altres: I18N.t('category.altres')
  });
  Object.assign(DEPARTMENT_LABELS_CA, {
    comercial: I18N.t('department.comercial'), coordinacio: I18N.t('department.coordinacio'), cuina: I18N.t('department.cuina'), administracio: I18N.t('department.administracio'), digital: I18N.t('department.digital')
  });
  Object.assign(STATUS_LABELS, {
    no_comencat: I18N.t('status.no_comencat'), comencat: I18N.t('status.comencat'), en_espera: I18N.t('status.en_espera'), acabat: I18N.t('status.acabat'), cancelat: I18N.t('status.cancelat')
  });
}
rebuildLabelMaps();

const STATUS_COLORS = {
  no_comencat: '#4b5563',
  comencat: '#1d4ed8',
  en_espera: '#b45309',
  acabat: '#15803d',
  cancelat: '#b91c1c'
};
