const zonesBoard = document.getElementById('zonesBoard');
const ticketsError = document.getElementById('ticketsError');
const ticketsEmptyMsg = document.getElementById('ticketsEmptyMsg');
const ticketsNoResultsMsg = document.getElementById('ticketsNoResultsMsg');
const ticketSearchInput = document.getElementById('ticketSearch');
const ticketAuthorSearchInput = document.getElementById('ticketAuthorSearch');
const ticketSearchSuggest = document.getElementById('ticketSearchSuggest');
const ticketAuthorSuggest = document.getElementById('ticketAuthorSuggest');
const activityList = document.getElementById('activityList');
const activityStatus = document.getElementById('activityStatus');
const activityCard = document.getElementById('activityCard');
const activityToggle = document.getElementById('activityToggle');
const activityToggleBadge = document.getElementById('activityToggleBadge');
const activityClose = document.getElementById('activityClose');
const activityBackdrop = document.getElementById('activityBackdrop');
const activityClear = document.getElementById('activityClear');
const activityClearModal = document.getElementById('activityClearModal');
const activityClearInput = document.getElementById('activityClearInput');
const activityClearError = document.getElementById('activityClearError');
const activityClearCancel = document.getElementById('activityClearCancel');
const activityClearConfirm = document.getElementById('activityClearConfirm');
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
const modalStatusWrap = document.getElementById('modalStatusWrap');
const modalPriority = document.getElementById('modalPriority');
const modalCategory = document.getElementById('modalCategory');
const modalDepartment = document.getElementById('modalDepartment');
const modalReporter = document.getElementById('modalReporter');
const modalEmail = document.getElementById('modalEmail');
const modalDate = document.getElementById('modalDate');
const modalUrgencyValue = document.getElementById('modalUrgencyValue');
const modalGithubLink = document.getElementById('modalGithubLink');
const modalAutoDelete = document.getElementById('modalAutoDelete');
const modalDelete = document.getElementById('modalDelete');
const modalScreenshotsSection = document.getElementById('modalScreenshotsSection');
const modalScreenshots = document.getElementById('modalScreenshots');
const modalComments = document.getElementById('modalComments');
const modalCommentsStatus = document.getElementById('modalCommentsStatus');
const modalCommentForm = document.getElementById('modalCommentForm');
const modalCommentInput = document.getElementById('modalCommentInput');
const modalCommentError = document.getElementById('modalCommentError');
const modalCommentSubmit = document.getElementById('modalCommentSubmit');

let allTickets = [];
let ticketSearchQuery = '';
let ticketStatusQuery = '';
let ticketPriorityQuery = '';
let ticketProjectQuery = '';
let ticketAuthorQuery = '';
let currentModalTicketId = null;

const ICON_LINK = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M8.5 11.5l3-3M7 13.5H5.5A3.5 3.5 0 012 10a3.5 3.5 0 013.5-3.5H7M13 6.5h1.5A3.5 3.5 0 0118 10a3.5 3.5 0 01-3.5 3.5H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M8.5 9v5M11.5 9v5M5.5 6l.6 9a1 1 0 001 .9h5.8a1 1 0 001-.9l.6-9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function authHeaders() {
  return { 'x-admin-token': localStorage.getItem('adminToken') || '', 'Content-Type': 'application/json' };
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const PRIORITY_LABELS_CA = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };
const CATEGORY_LABELS_CA = { bug: 'Error / no funciona', funcionalitat: 'Petició de funcionalitat', acces: 'Accés i permisos', altres: 'Altres' };
const DEPARTMENT_LABELS_CA = { comercial: 'Comercial', coordinacio: 'Coordinació', cuina: 'Cuina', administracio: 'Administració', digital: 'Digital' };
const PRIORITY_ORDER = { critica: 4, alta: 3, mitjana: 2, baixa: 1 };
const STATUS_ORDER = { comencat: 3, en_espera: 2, no_comencat: 1, acabat: 0, cancelat: 0 };

const STATUS_LABELS = {
  no_comencat: 'No començat',
  comencat: 'Començat',
  en_espera: 'En espera',
  acabat: 'Acabat',
  cancelat: 'Cancel·lat'
};

const STATUS_COLORS = {
  no_comencat: '#4b5563',
  comencat: '#1d4ed8',
  en_espera: '#b45309',
  acabat: '#15803d',
  cancelat: '#b91c1c'
};
