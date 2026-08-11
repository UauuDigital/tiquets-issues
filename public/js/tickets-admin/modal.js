function populateModal(t) {
  modalUrgency.innerHTML = urgencyIconHtml(t);
  modalTitle.textContent = t.number ? `Tiquet núm. ${t.number}` : 'Tiquet';
  modalRepo.textContent = t.repoLabel;
  modalDescription.textContent = t.description || t.title || '—';
  modalStatusWrap.innerHTML = statusSelectHtml(t);
  modalStatusWrap.querySelector('.status-select').addEventListener('change', (e) => updateTicketStatus(e.target));
  modalPriority.innerHTML = prioritySelectHtml(t);
  modalPriority.querySelector('.priority-select').addEventListener('change', (e) => updateTicketPriority(e.target));
  modalCategory.textContent = CATEGORY_LABELS_CA[t.category] || '—';
  modalDepartment.textContent = DEPARTMENT_LABELS_CA[t.department] || '—';
  modalReporter.textContent = t.reporterName || 'Anònim';
  modalEmail.innerHTML = t.reporterEmail ? `<a href="mailto:${escapeHtml(t.reporterEmail)}">${escapeHtml(t.reporterEmail)}</a>` : '—';
  modalDate.textContent = `${formatRelativeTime(t.createdAt)} (${formatTicketDate(t.createdAt)})`;
  modalUrgencyValue.innerHTML = urgencyBadgeHtml(t);
  modalUrgencyValue.title = `Puntuació: ${t.urgencyScore}`;
  modalGithubLink.href = t.url || '#';
  const autoDeleteMsg = autoDeleteText(t);
  modalAutoDelete.textContent = autoDeleteMsg;
  modalAutoDelete.hidden = !autoDeleteMsg;

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
      <a href="${c.url}" target="_blank" rel="noopener" class="modal-comment-author">${escapeHtml(c.author)}</a>
      <span class="modal-comment-date">${escapeHtml(formatRelativeTime(c.createdAt))}</span>
      <button type="button" class="modal-comment-delete" title="Elimina el comentari">🗑</button>
    </div>
    <div class="modal-comment-body">${escapeHtml(c.body)}</div>
  `;
  div.querySelector('.modal-comment-delete').addEventListener('click', () => deleteComment(c.id, div));
  return div;
}

async function deleteComment(commentId, commentEl) {
  if (!window.confirm('Segur que vols eliminar aquest comentari? Aquesta acció no es pot desfer.')) return;
  try {
    const res = await fetch(`/api/admin/tickets/${currentModalTicketId}/comments/${commentId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!res.ok) throw new Error();
    commentEl.remove();
    if (!modalComments.querySelector('.modal-comment')) {
      modalCommentsStatus.hidden = false;
      modalCommentsStatus.textContent = 'Encara no hi ha cap comentari.';
    }
  } catch (err) {
    window.alert('No s\'ha pogut eliminar el comentari.');
  }
}

// Si el comentari ocupa més de les línies visibles per defecte, hi afegeix
// un botó per desplegar-lo sencer (només es mostra quan cal de veritat).
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
  toggle.textContent = 'Mostra el comentari sencer';
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
  modalCommentsStatus.textContent = 'Carregant…';
  try {
    const res = await fetch(`/api/admin/tickets/${id}/comments`, { headers: authHeaders() });
    if (!res.ok) throw new Error();
    const comments = await res.json();
    if (currentModalTicketId !== id) return;
    if (!comments.length) {
      modalCommentsStatus.textContent = 'Encara no hi ha cap comentari.';
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
    modalCommentsStatus.textContent = 'No s\'han pogut carregar els comentaris.';
  }
}

modalCommentForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalCommentError.style.display = 'none';
  const body = modalCommentInput.value.trim();
  if (!body || !currentModalTicketId) return;

  modalCommentSubmit.disabled = true;
  modalCommentSubmit.textContent = 'Publicant…';
  try {
    const res = await fetch(`/api/admin/tickets/${currentModalTicketId}/comments`, {
      method: 'POST',
      headers: authHeaders(),
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
    modalCommentSubmit.textContent = 'Publicar comentari';
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
modalDelete.addEventListener('click', () => {
  if (currentModalTicketId) deleteTicket(currentModalTicketId);
});
