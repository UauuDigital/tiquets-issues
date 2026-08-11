const ACTIVITY_ICONS = {
  created: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 4v12M4 10h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  status: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10a6 6 0 0110-4.5M16 10a6 6 0 01-10 4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M14 3.2v3.3h-3.3M6 16.8v-3.3h3.3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  priority: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 15.5V4.5M6 8.5l4-4 4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  deleted: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 6h10M8.5 6V4.5h3V6M6.5 6l.6 9a1 1 0 001 .9h3.8a1 1 0 001-.9l.6-9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

const ACTIVITY_COLORS = {
  created: '#2563eb',
  status: 'var(--ink-soft)',
  priority: 'var(--accent-ink)',
  deleted: 'var(--danger)'
};

function activityStatusBadge(key) {
  const label = STATUS_LABELS[key] || key || '—';
  const color = STATUS_COLORS[key] || 'var(--ink-soft)';
  return `<span class="activity-value" style="--activity-value-color:${color}">${escapeHtml(label)}</span>`;
}

function activityPriorityBadge(key) {
  const label = key ? (PRIORITY_LABELS_CA[key] || key) : 'sense prioritat';
  const color = key ? `var(--priority-${key})` : 'var(--ink-soft)';
  return `<span class="activity-value" style="--activity-value-color:${color}">${escapeHtml(label)}</span>`;
}

function activityText(entry) {
  const label = entry.ticketNumber ? `Tiquet #${entry.ticketNumber}` : 'Un tiquet';
  // Un tiquet eliminat ja no es pot obrir: es mostra com a text pla, no com a enllaç.
  const ticketRef = entry.ticketId && entry.type !== 'deleted'
    ? `<button type="button" class="activity-ticket-link" data-ticket-id="${escapeHtml(entry.ticketId)}">${escapeHtml(label)}</button>`
    : `<strong>${escapeHtml(label)}</strong>`;
  if (entry.type === 'created') {
    return `${ticketRef} creat${entry.reporterName ? ` per ${escapeHtml(entry.reporterName)}` : ''}`;
  }
  if (entry.type === 'status') {
    return `${ticketRef}: ${activityStatusBadge(entry.from || 'no_comencat')} → ${activityStatusBadge(entry.to)}`;
  }
  if (entry.type === 'priority') {
    return `${ticketRef}: ${activityPriorityBadge(entry.from)} → ${activityPriorityBadge(entry.to)}`;
  }
  if (entry.type === 'deleted') {
    return `${ticketRef} eliminat ${entry.by === 'auto' ? 'automàticament' : 'per l\'administrador'}`;
  }
  return `${ticketRef} actualitzat`;
}

function renderActivity(entries) {
  activityList.querySelectorAll('.activity-item').forEach((el) => el.remove());
  if (!entries.length) {
    activityStatus.textContent = 'Encara no hi ha activitat.';
    activityStatus.hidden = false;
    return;
  }
  activityStatus.hidden = true;
  entries.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'activity-item';
    item.innerHTML = `
      <span class="activity-icon" style="--activity-color:${ACTIVITY_COLORS[entry.type] || 'var(--ink-soft)'}">${ACTIVITY_ICONS[entry.type] || ACTIVITY_ICONS.status}</span>
      <span class="activity-body">${activityText(entry)}<span class="activity-time">${escapeHtml(formatRelativeTime(entry.at))}</span></span>
    `;
    activityList.appendChild(item);
  });
}

// En mòbil, l'historial es mostra amagat rere un botó i s'obre com a
// pantalla completa; en escriptori aquests controls no es veuen (CSS).
function openActivityCard() {
  activityCard.classList.add('is-open');
  activityBackdrop.classList.add('is-open');
  document.body.classList.add('no-scroll');
}
function closeActivityCard() {
  activityCard.classList.remove('is-open');
  activityBackdrop.classList.remove('is-open');
  document.body.classList.remove('no-scroll');
}
activityToggle.addEventListener('click', openActivityCard);
activityClose.addEventListener('click', closeActivityCard);
activityBackdrop.addEventListener('click', closeActivityCard);

async function loadActivity() {
  try {
    const res = await fetch('/api/activity');
    if (!res.ok) throw new Error();
    renderActivity(await res.json());
  } catch (err) {
    activityStatus.textContent = 'No s\'ha pogut carregar l\'activitat.';
    activityStatus.hidden = false;
  }
}

// El número de tiquet a cada entrada de l'activitat obre el modal de
// detall d'aquell tiquet (delegat: els elements es recreen cada cop
// que es refresca la llista).
activityList.addEventListener('click', (e) => {
  const link = e.target.closest('.activity-ticket-link');
  if (!link) return;
  const ticket = allTickets.find((t) => t.id === link.dataset.ticketId);
  if (ticket) openTicketModal(ticket);
});
