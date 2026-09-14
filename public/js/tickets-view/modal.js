function populateModal(t) {
  modalUrgency.innerHTML = urgencyIconHtml(t);
  modalTitle.innerHTML = t.number ? I18N.t('modal.ticketNumber', { number: ticketNumberHtml(t.number) }) : I18N.t('modal.ticketGeneric');
  modalRepo.textContent = t.repoLabel;
  modalDescription.textContent = t.description || t.title || I18N.t('modal.na');
  modalStatus.textContent = STATUS_LABELS[t.status] || STATUS_LABELS.no_comencat;
  modalStatus.dataset.status = t.status || 'no_comencat';
  modalPriority.textContent = PRIORITY_LABELS_CA[t.priority] || t.priority || I18N.t('modal.na');
  modalPriority.dataset.priority = t.priority || '';
  modalCategory.textContent = CATEGORY_LABELS_CA[t.category] || I18N.t('modal.na');
  modalReporter.textContent = t.reporterName || I18N.t('stub.anonymous');
  modalDate.textContent = `${formatRelativeTime(t.createdAt)} (${formatTicketDate(t.createdAt)})`;
  modalUrgencyValue.innerHTML = urgencyBadgeHtml(t);
  modalUrgencyValue.title = I18N.t('modal.score', { score: t.urgencyScore });
  modalActions.hidden = !isAdminSession;
  modalGithubLink.href = t.url || '#';

  if (t.screenshotUrls && t.screenshotUrls.length) {
    modalScreenshotsSection.hidden = false;
    modalScreenshots.innerHTML = t.screenshotUrls.map((url) => `
      <button type="button" class="modal-screenshot-thumb"><img src="${url}" alt="Captura de pantalla" loading="lazy"></button>
    `).join('');
    modalScreenshots.querySelectorAll('.modal-screenshot-thumb').forEach((btn, index) => {
      btn.addEventListener('click', () => openImageLightbox(t.screenshotUrls, index));
    });
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
    const res = await fetch(`/api/tickets/${id}/comments`, { headers: authHeaders() });
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
  if (!body || !currentModalTicketId) return;

  modalCommentSubmit.disabled = true;
  modalCommentSubmit.textContent = I18N.t('modal.commentSubmitting');
  try {
    const res = await fetch(`/api/tickets/${currentModalTicketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ body })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

    modalCommentsStatus.hidden = true;
    const newCommentEl = renderCommentEl(data);
    modalComments.appendChild(newCommentEl);
    setupCommentClamp(newCommentEl);
    modalCommentInput.value = '';
  } catch (err) {
    modalCommentError.textContent = err.message;
    modalCommentError.style.display = 'block';
  } finally {
    modalCommentSubmit.disabled = false;
    modalCommentSubmit.textContent = I18N.t('modal.commentSubmit');
  }
});

function syncCommentAs() {
  if (!modalCommentAs) return;
  modalCommentAs.textContent = currentUsuari
    ? I18N.t('modal.commentAs', { name: currentUsuari.nom, email: currentUsuari.email })
    : '';
}

function openTicketModal(t) {
  currentModalTicketId = t.id;
  populateModal(t);
  syncCommentAs();
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
