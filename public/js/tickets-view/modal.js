function populateModal(t) {
  modalUrgency.innerHTML = urgencyIconHtml(t);
  modalTitle.textContent = t.number ? I18N.t('modal.ticketNumber', { number: t.number }) : I18N.t('modal.ticketGeneric');
  modalRepo.textContent = t.repoLabel;
  modalDescription.textContent = t.description || t.title || I18N.t('modal.na');
  modalStatus.textContent = STATUS_LABELS[t.status] || STATUS_LABELS.no_comencat;
  modalStatus.dataset.status = t.status || 'no_comencat';
  modalPriority.textContent = PRIORITY_LABELS_CA[t.priority] || t.priority || I18N.t('modal.na');
  modalPriority.dataset.priority = t.priority || '';
  modalCategory.textContent = CATEGORY_LABELS_CA[t.category] || I18N.t('modal.na');
  modalDepartment.textContent = DEPARTMENT_LABELS_CA[t.department] || I18N.t('modal.na');
  modalReporter.textContent = t.reporterName || I18N.t('stub.anonymous');
  modalDate.textContent = `${formatRelativeTime(t.createdAt)} (${formatTicketDate(t.createdAt)})`;
  modalUrgencyValue.innerHTML = urgencyBadgeHtml(t);
  modalUrgencyValue.title = I18N.t('modal.score', { score: t.urgencyScore });

  if (t.screenshotUrls && t.screenshotUrls.length) {
    modalScreenshotsSection.hidden = false;
    modalScreenshots.innerHTML = t.screenshotUrls.map((url) => `
      <a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="Captura de pantalla" loading="lazy"></a>
    `).join('');
  } else {
    modalScreenshotsSection.hidden = true;
    modalScreenshots.innerHTML = '';
  }
}

function renderCommentEl(c) {
  const div = document.createElement('div');
  div.className = 'modal-comment';
  div.innerHTML = `
    <div class="modal-comment-head">
      <span class="modal-comment-author">${escapeHtml(c.author)}</span>
      <span class="modal-comment-date">${escapeHtml(formatRelativeTime(c.createdAt))}</span>
    </div>
    <div class="modal-comment-body">${escapeHtml(c.body)}</div>
  `;
  return div;
}

// Si el comentari ocupa més de les línies visibles per defecte, hi afegeix
// un botó per obrir-lo sencer en un modal (només es mostra quan cal de veritat).
function setupCommentClamp(commentEl) {
  const body = commentEl.querySelector('.modal-comment-body');
  body.classList.add('clamped');
  if (body.scrollHeight <= body.clientHeight + 1) {
    body.classList.remove('clamped');
    return;
  }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'modal-comment-toggle';
  toggle.textContent = I18N.t('modal.commentToggle');
  toggle.addEventListener('click', () => openCommentModal(commentEl));
  commentEl.appendChild(toggle);
}

function openCommentModal(commentEl) {
  const head = commentEl.querySelector('.modal-comment-head');
  const body = commentEl.querySelector('.modal-comment-body');
  commentModalHead.replaceChildren(head.cloneNode(true));
  commentModalBody.textContent = body.textContent;
  commentModal.showModal();
}

commentModalClose.addEventListener('click', () => commentModal.close());
commentModal.addEventListener('click', (e) => {
  const rect = commentModal.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) commentModal.close();
});

async function loadModalComments(id) {
  modalComments.querySelectorAll('.modal-comment').forEach((el) => el.remove());
  modalCommentsStatus.hidden = false;
  modalCommentsStatus.textContent = I18N.t('modal.commentsLoading');
  try {
    const res = await fetch(`/api/tickets/${id}/comments`);
    if (!res.ok) throw new Error();
    const comments = await res.json();
    if (currentModalTicketId !== id) return;
    if (!comments.length) {
      modalCommentsStatus.textContent = I18N.t('modal.commentsEmpty');
      return;
    }
    modalCommentsStatus.hidden = true;
    comments.forEach((c) => {
      const el = renderCommentEl(c);
      modalComments.appendChild(el);
      setupCommentClamp(el);
    });
  } catch (err) {
    if (currentModalTicketId !== id) return;
    modalCommentsStatus.hidden = false;
    modalCommentsStatus.textContent = I18N.t('modal.commentsLoadError');
  }
}

modalCommentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalCommentError.style.display = 'none';
  const body = modalCommentInput.value.trim();
  const authorName = modalCommentAuthor.value.trim();
  const authorEmail = modalCommentAuthorEmail.value.trim();
  if (!body || !authorName || !currentModalTicketId) return;

  modalCommentSubmit.disabled = true;
  modalCommentSubmit.textContent = I18N.t('modal.commentSubmitting');
  try {
    const res = await fetch(`/api/tickets/${currentModalTicketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, authorName, authorEmail })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    modalCommentsStatus.hidden = true;
    const newCommentEl = renderCommentEl(data);
    modalComments.appendChild(newCommentEl);
    setupCommentClamp(newCommentEl);
    modalCommentInput.value = '';
    modalCommentAuthor.value = '';
    modalCommentAuthorEmail.value = '';
  } catch (err) {
    modalCommentError.textContent = err.message;
    modalCommentError.style.display = 'block';
  } finally {
    modalCommentSubmit.disabled = false;
    modalCommentSubmit.textContent = I18N.t('modal.commentSubmit');
  }
});

function openTicketModal(t) {
  currentModalTicketId = t.id;
  populateModal(t);
  ticketModal.showModal();
  loadModalComments(t.id);
}

ticketModalClose.addEventListener('click', () => ticketModal.close());
ticketModal.addEventListener('click', (e) => {
  const rect = ticketModal.getBoundingClientRect();
  const inside = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
  if (!inside) ticketModal.close();
});
ticketModal.addEventListener('close', () => {
  currentModalTicketId = null;
  modalCommentForm.reset();
  modalCommentError.style.display = 'none';
});
