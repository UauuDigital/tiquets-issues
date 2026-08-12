initBoardCore({
  fetchUrl: '/api/admin/tickets',
  headers: authHeaders,
  searchFields: (t) => [t.title, t.description, t.repoLabel, t.reporterName, t.reporterEmail, t.number ? `#${t.number}` : '']
});

document.querySelectorAll('.info-icon').forEach((btn) => {
  btn.addEventListener('click', (e) => e.stopPropagation());
});

function statusSelectHtml(t) {
  const status = t.status || 'no_comencat';
  return `
    <select class="status-select" data-status="${status}" data-id="${t.id}">
      ${Object.entries(STATUS_LABELS).map(([value, label]) =>
        `<option value="${value}"${value === status ? ' selected' : ''}>${label}</option>`
      ).join('')}
    </select>`;
}

function prioritySelectHtml(t) {
  const priority = t.priority || 'baixa';
  return `
    <select class="priority-select" data-priority="${priority}" data-id="${t.id}">
      ${Object.entries(PRIORITY_LABELS_CA).map(([value, label]) =>
        `<option value="${value}"${value === priority ? ' selected' : ''}>${label}</option>`
      ).join('')}
    </select>`;
}

function ticketCardHtml(t) {
  return `
    <div class="ticket-card-frame">
    <article class="ticket-card" data-id="${t.id}" role="button" tabindex="0" aria-label="Obre el tiquet ${t.number ? '#' + t.number : ''}: ${escapeHtml(t.description || '')}" style="--card-color:${urgencyColor(t.urgencyScore)};--status-color:${STATUS_COLORS[t.status || 'no_comencat']}">
      <div class="ticket-card-urgency" title="Urgència: ${t.urgencyScore} (dies oberts × pes de prioritat)">
        ${urgencyIconHtml(t)}
        <span class="ticket-card-number">${t.number ? '#' + t.number : ''}</span>
      </div>
      <div class="ticket-card-main">
        <div class="ticket-card-top">
          <p class="ticket-card-desc" title="${escapeHtml(t.title)}">${escapeHtml(t.description || t.title)}</p>
          <div class="ticket-card-actions">
            <a class="icon-btn" href="${t.url}" target="_blank" rel="noopener" title="Obrir a GitHub" aria-label="Obrir a GitHub">${ICON_LINK}</a>
            <button type="button" class="icon-btn danger" data-delete="${t.id}" title="Eliminar tiquet (i la incidència de GitHub)" aria-label="Eliminar tiquet (i la incidència de GitHub)">${ICON_TRASH}</button>
          </div>
        </div>
        <div class="ticket-card-field"><span class="ticket-repo">${escapeHtml(t.repoLabel)}</span></div>
        <div class="ticket-card-field">${prioritySelectHtml(t)}</div>
        <div class="ticket-card-field">${statusSelectHtml(t)}</div>
        <div class="ticket-card-foot">
          <span>${escapeHtml(t.reporterName || 'Anònim')}</span>
          <span title="${escapeHtml(formatTicketDate(t.createdAt))}">${escapeHtml(formatRelativeTime(t.createdAt))}</span>
        </div>
        ${autoDeleteText(t) ? `<p class="ticket-card-autodelete">${escapeHtml(autoDeleteText(t))}</p>` : ''}
      </div>
    </article>
    </div>`;
}

function renderZones(tickets) {
  const byZone = {};
  for (const z of ZONES) byZone[z.key] = [];
  for (const t of tickets) byZone[zoneForTicket(t).key].push(t);

  zonesBoard.innerHTML = ZONES.map((z) => `
    <section class="urgency-zone${byZone[z.key].length ? '' : ' urgency-zone-empty'}" style="--zone-color:${z.color}">
      <header class="urgency-zone-head">
        <span class="urgency-zone-dot"></span>
        <h3>${z.label}</h3>
        <span class="urgency-zone-count">${byZone[z.key].length}</span>
      </header>
      <div class="urgency-zone-cards">
        ${byZone[z.key].length
          ? byZone[z.key].map(ticketCardHtml).join('')
          : '<p class="urgency-zone-empty-msg">Cap tiquet en aquesta zona.</p>'}
      </div>
    </section>
  `).join('');

  zonesBoard.querySelectorAll('.ticket-card').forEach((card) => {
    const t = tickets.find((x) => x.id === card.dataset.id);
    card.addEventListener('click', (e) => {
      if (e.target.closest('select, a, button')) return;
      openTicketModal(t);
    });
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target.closest('select, a, button')) return;
      e.preventDefault();
      openTicketModal(t);
    });
  });
  zonesBoard.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketStatus(select));
  });
  zonesBoard.querySelectorAll('.priority-select').forEach((select) => {
    select.addEventListener('change', () => updateTicketPriority(select));
  });
  zonesBoard.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => deleteTicket(btn.dataset.delete));
  });
}

async function deleteTicket(id) {
  if (!confirm('Segur que vols eliminar aquest tiquet? S\'intentarà eliminar també la incidència de GitHub de manera permanent i irreversible.')) return;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (!res.ok && res.status !== 204) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    allTickets = allTickets.filter((t) => t.id !== id);
    if (currentModalTicketId === id) ticketModal.close();
    renderFilteredTickets();
    loadActivity();
  } catch (err) {
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  }
}

async function updateTicketStatus(select) {
  const id = select.dataset.id;
  const newStatus = select.value;
  const previousStatus = select.dataset.status;
  select.disabled = true;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    select.dataset.status = newStatus;
    const ticket = allTickets.find((t) => t.id === id);
    if (ticket) {
      ticket.status = newStatus;
      ticket.urgencyScore = computeUrgencyScore(ticket);
      renderFilteredTickets();
      loadActivity();
      if (currentModalTicketId === id) populateModal(ticket);
      return;
    }
  } catch (err) {
    select.value = previousStatus;
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  } finally {
    select.disabled = false;
  }
}

async function updateTicketPriority(select) {
  const id = select.dataset.id;
  const newPriority = select.value;
  const previousPriority = select.dataset.priority;
  select.disabled = true;
  try {
    const res = await fetch(`/api/admin/tickets/${id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ priority: newPriority })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Error ${res.status}`);
    }
    select.dataset.priority = newPriority;
    const ticket = allTickets.find((t) => t.id === id);
    if (ticket) {
      ticket.priority = newPriority;
      ticket.urgencyScore = computeUrgencyScore(ticket);
      renderFilteredTickets();
      loadActivity();
      if (currentModalTicketId === id) populateModal(ticket);
      return;
    }
  } catch (err) {
    select.value = previousPriority;
    ticketsError.textContent = err.message;
    ticketsError.style.display = 'block';
  } finally {
    select.disabled = false;
  }
}
