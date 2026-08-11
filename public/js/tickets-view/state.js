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
