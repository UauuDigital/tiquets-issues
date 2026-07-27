const form = document.getElementById('ticket-form');
const submitBtn = document.getElementById('submit-btn');
const formError = document.getElementById('form-error');
const confirmView = document.getElementById('confirm-view');
const confirmText = document.getElementById('confirm-text');
const issueLink = document.getElementById('issue-link');
const againBtn = document.getElementById('again-btn');

const stubNumber = document.getElementById('stub-number');
const stubCategory = document.getElementById('stub-category');
const stubPriority = document.getElementById('stub-priority');

const categorySelect = document.getElementById('category');
const prioritySlider = document.getElementById('priority-slider');
const priorityRange = document.getElementById('priority-range');
const priorityBubble = document.getElementById('priority-bubble');
const priorityTicks = document.querySelectorAll('#priority-ticks span');
const repoSelect = document.getElementById('repoId');
const projectDescription = document.getElementById('project-description');

const PRIORITY_LEVELS = ['baixa', 'mitjana', 'alta', 'critica'];

const repoCustomSelect = enhanceSelect(repoSelect);
const categoryCustomSelect = enhanceSelect(categorySelect);

let repoDescriptions = {};

function syncProjectDescription() {
  const description = repoDescriptions[repoSelect.value];
  if (description) {
    projectDescription.textContent = description;
    projectDescription.classList.add('visible');
  } else {
    projectDescription.textContent = '';
    projectDescription.classList.remove('visible');
  }
}
repoSelect.addEventListener('change', syncProjectDescription);

async function loadRepos() {
  try {
    const res = await fetch('/api/repos');
    const repos = await res.json();
    repoSelect.innerHTML = '';
    if (!repos.length) {
      repoSelect.innerHTML = '<option value="" disabled selected>No hi ha projectes configurats</option>';
      return;
    }
    repoDescriptions = Object.fromEntries(repos.map((r) => [r.id, r.description || '']));
    repoSelect.innerHTML = repos
      .map((r) => `<option value="${r.id}">${r.label}</option>`)
      .join('');

    const requestedRepo = new URLSearchParams(window.location.search).get('repo');
    if (requestedRepo && repos.some((r) => r.id === requestedRepo)) {
      repoSelect.value = requestedRepo;
    }
  } catch (err) {
    repoSelect.innerHTML = '<option value="" disabled selected>Error carregant projectes</option>';
  } finally {
    repoCustomSelect.refresh();
    syncProjectDescription();
  }
}
loadRepos();

const PRIORITY_TEXT = { baixa: 'Baixa', mitjana: 'Mitjana', alta: 'Alta', critica: 'Crítica' };

function syncStub() {
  stubCategory.textContent = categorySelect.options[categorySelect.selectedIndex].text;
}
categorySelect.addEventListener('change', syncStub);
syncStub();

function syncPriority() {
  const level = PRIORITY_LEVELS[Number(priorityRange.value)];
  const pct = Number(priorityRange.value) / (PRIORITY_LEVELS.length - 1);

  prioritySlider.dataset.level = level;
  priorityBubble.textContent = PRIORITY_TEXT[level];

  const trackWidth = priorityRange.offsetWidth;
  const bubbleWidth = priorityBubble.offsetWidth;
  const rawLeft = pct * trackWidth;
  const clampedLeft = Math.min(Math.max(rawLeft, bubbleWidth / 2), trackWidth - bubbleWidth / 2);
  priorityBubble.style.left = clampedLeft + 'px';

  priorityTicks.forEach((tick) => {
    tick.classList.toggle('active', tick.dataset.value === level);
  });

  stubPriority.textContent = PRIORITY_TEXT[level];
  stubPriority.dataset.level = level;
}
priorityRange.addEventListener('input', syncPriority);
syncPriority();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.remove('error');

  const payload = {
    title: form.title.value,
    description: form.description.value,
    category: form.category.value,
    repoId: form.repoId.value,
    priority: PRIORITY_LEVELS[Number(priorityRange.value)] || 'baixa',
    reporterName: form.reporterName.value,
    reporterEmail: form.reporterEmail.value,
    department: form.department.value,
    website: form.website.value // honeypot
  };

  if (!payload.repoId) {
    formError.textContent = 'Cal triar un projecte.';
    formError.classList.add('error');
    return;
  }

  if (!payload.title.trim() || !payload.description.trim()) {
    formError.textContent = 'Cal omplir el títol i la descripció.';
    formError.classList.add('error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Enviant…';

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'No s\'ha pogut enviar el tiquet.');
    }

    if (data.number) {
      stubNumber.textContent = '#' + data.number;
      confirmText.textContent = `L'equip tècnic ja té la incidència número ${data.number}.`;
      issueLink.href = data.url;
      issueLink.textContent = 'Veure la incidència a GitHub ↗';
      issueLink.style.display = 'inline-block';
    } else {
      confirmText.textContent = 'L\'equip tècnic ja té la incidència.';
      issueLink.style.display = 'none';
    }

    form.style.display = 'none';
    confirmView.classList.add('visible');
  } catch (err) {
    formError.textContent = err.message || 'Alguna cosa ha fallat. Torna-ho a provar.';
    formError.classList.add('error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Enviar tiquet';
  }
});

againBtn.addEventListener('click', () => {
  form.reset();
  stubNumber.textContent = '— — —';
  syncStub();
  syncPriority();
  confirmView.classList.remove('visible');
  form.style.display = 'block';
});
