/**
 * Substitueix un <select> natiu per un desplegable personalitzat (trigger + panell flotant),
 * mantenint el <select> original amagat com a font de veritat del valor (per compatibilitat
 * amb la resta del codi, que llegeix select.value i escolta l'esdeveniment "change").
 */
function enhanceSelect(selectEl) {
  let uid = enhanceSelect._uid = (enhanceSelect._uid || 0) + 1;
  const triggerId = `${selectEl.id || 'select'}-trigger-${uid}`;
  const panelId = `${selectEl.id || 'select'}-panel-${uid}`;

  selectEl.style.display = 'none';
  selectEl.setAttribute('aria-hidden', 'true');
  selectEl.tabIndex = -1;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'select-trigger';
  trigger.id = triggerId;
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', panelId);
  trigger.innerHTML = `
    <span class="select-trigger-label"></span>
    <svg class="chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  const panel = document.createElement('div');
  panel.className = 'select-panel';
  panel.id = panelId;
  panel.setAttribute('role', 'listbox');
  document.body.appendChild(panel);

  selectEl.insertAdjacentElement('afterend', trigger);

  const associatedLabel = selectEl.id && document.querySelector(`label[for="${selectEl.id}"]`);
  if (associatedLabel) associatedLabel.setAttribute('for', triggerId);

  let highlightedIndex = -1;

  function labelText() {
    const opt = selectEl.options[selectEl.selectedIndex];
    return opt ? opt.text : '';
  }

  function updateTrigger() {
    trigger.querySelector('.select-trigger-label').textContent = labelText();
  }

  function renderOptions() {
    panel.innerHTML = '';
    Array.from(selectEl.options).forEach((opt, i) => {
      const item = document.createElement('div');
      item.className = 'select-option';
      item.id = `${panelId}-opt-${i}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(opt.selected));
      if (opt.disabled) item.setAttribute('aria-disabled', 'true');
      if (opt.selected) item.classList.add('selected');
      item.innerHTML = `
        <span>${opt.text}</span>
        <svg class="check" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 10.5L8 14.5L16 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      if (!opt.disabled) {
        item.addEventListener('click', () => selectValue(i));
      }
      panel.appendChild(item);
    });
    highlightedIndex = selectEl.selectedIndex;
    highlightOption(highlightedIndex);
  }

  function highlightOption(index) {
    const items = panel.querySelectorAll('.select-option');
    items.forEach((el) => el.classList.remove('highlighted'));
    const target = items[index];
    if (target) {
      target.classList.add('highlighted');
      trigger.setAttribute('aria-activedescendant', target.id);
      target.scrollIntoView({ block: 'nearest' });
    }
    highlightedIndex = index;
  }

  function selectValue(index) {
    const opt = selectEl.options[index];
    if (!opt || opt.disabled) return;
    selectEl.selectedIndex = index;
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    updateTrigger();
    closePanel();
    trigger.focus();
  }

  function position() {
    const rect = trigger.getBoundingClientRect();
    panel.style.top = rect.bottom + 6 + 'px';
    panel.style.left = rect.left + 'px';
    panel.style.width = rect.width + 'px';
  }

  function openPanel() {
    renderOptions();
    position();
    panel.classList.add('open');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('mousedown', onDocMouseDown, true);
    window.addEventListener('scroll', closePanel, true);
    window.addEventListener('resize', closePanel);
    document.addEventListener('keydown', onKeydown);
  }

  function closePanel() {
    panel.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    document.removeEventListener('mousedown', onDocMouseDown, true);
    window.removeEventListener('scroll', closePanel, true);
    window.removeEventListener('resize', closePanel);
    document.removeEventListener('keydown', onKeydown);
  }

  function isOpen() {
    return panel.classList.contains('open');
  }

  function onDocMouseDown(e) {
    if (!panel.contains(e.target) && e.target !== trigger) closePanel();
  }

  function onKeydown(e) {
    if (!isOpen()) return;
    const optionCount = selectEl.options.length;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      trigger.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightOption(Math.min(highlightedIndex + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightOption(Math.max(highlightedIndex - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectValue(highlightedIndex);
    } else if (e.key === 'Tab') {
      closePanel();
    }
  }

  trigger.addEventListener('click', () => {
    if (isOpen()) {
      closePanel();
    } else {
      openPanel();
    }
  });

  updateTrigger();

  return {
    trigger,
    refresh() {
      updateTrigger();
      if (isOpen()) renderOptions();
    },
    focus() {
      trigger.focus();
    },
    setInvalid(isInvalid) {
      trigger.classList.toggle('invalid', isInvalid);
      trigger.setAttribute('aria-invalid', isInvalid ? 'true' : 'false');
    },
    describeWith(errorId) {
      if (errorId) trigger.setAttribute('aria-describedby', errorId);
      else trigger.removeAttribute('aria-describedby');
    }
  };
}
