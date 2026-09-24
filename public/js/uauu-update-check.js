/*
 * uauu-update-check.js — Avís de "versió nova disponible" (comú a tots els
 * projectes web de UAUU).
 *
 * Consulta version.json (sense caché) cada 5 minuts i cada cop que la pestanya
 * torna a ser visible. Si l'identificador canvia respecte al del moment de
 * carregar la pàgina, mostra un bàner amb el botó "Actualitza".
 * No recarrega MAI sol, per no perdre formularis a mig omplir.
 *
 * Ús:
 *   <script src="uauu-update-check.js" defer></script>
 *   <script src="/js/uauu-update-check.js" defer data-version-url="/version.json"></script>
 *
 * data-version-url (opcional): URL del version.json. Per defecte "version.json",
 * relatiu a la pàgina actual.
 *
 * La còpia mestra és a Uauu/_shared-assets/cache/. Si la modifiques, copia-la
 * als projectes que la fan servir.
 */
(function () {
  'use strict';

  if (window.__uauuUpdateCheck) return; // evita carregar-lo dues vegades
  window.__uauuUpdateCheck = true;

  var script = document.currentScript;
  var VERSION_URL = (script && script.getAttribute('data-version-url')) || 'version.json';
  var INTERVAL_MS = 5 * 60 * 1000;
  var MIN_GAP_MS = 30 * 1000; // no repetir la consulta si s'ha fet fa menys de 30 s

  var baseline = null;   // versió amb què s'ha carregat la pàgina
  var dismissed = null;  // versió que l'usuari ha tancat amb la ×
  var lastCheck = 0;
  var banner = null;

  function check() {
    lastCheck = Date.now();
    fetch(VERSION_URL, { cache: 'no-store', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.version) return;
        var v = String(data.version);
        if (baseline === null) { baseline = v; return; }
        if (v !== baseline && v !== dismissed) showBanner(v);
      })
      .catch(function () { /* sense xarxa o servidor caigut: ja ho provarem més tard */ });
  }

  function showBanner(version) {
    if (banner) { banner.setAttribute('data-version', version); return; }

    var style = document.createElement('style');
    style.textContent =
      '.uauu-upd{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483000;' +
      'display:flex;align-items:center;gap:12px;max-width:calc(100vw - 32px);box-sizing:border-box;' +
      'padding:10px 10px 10px 16px;border-radius:10px;background:#1f2328;color:#fff;' +
      'font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)}' +
      '.uauu-upd button{font:inherit;cursor:pointer;border:0;border-radius:6px}' +
      '.uauu-upd__go{padding:6px 14px;background:#fff;color:#1f2328;font-weight:600}' +
      '.uauu-upd__go:hover{background:#e6e6e6}' +
      '.uauu-upd__x{padding:4px 8px;background:transparent;color:#fff;opacity:.7;font-size:18px;line-height:1}' +
      '.uauu-upd__x:hover{opacity:1}' +
      '.uauu-upd button:focus-visible{outline:2px solid #6cb6ff;outline-offset:2px}' +
      '@media print{.uauu-upd{display:none}}';
    document.head.appendChild(style);

    banner = document.createElement('div');
    banner.className = 'uauu-upd';
    banner.setAttribute('role', 'status');
    banner.setAttribute('data-version', version);

    var text = document.createElement('span');
    text.textContent = 'Hi ha una versió nova disponible.';

    var go = document.createElement('button');
    go.type = 'button';
    go.className = 'uauu-upd__go';
    go.textContent = 'Actualitza';
    go.addEventListener('click', function () { window.location.reload(); });

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'uauu-upd__x';
    close.setAttribute('aria-label', 'Tanca l’avís');
    close.textContent = '×';
    close.addEventListener('click', function () {
      dismissed = banner.getAttribute('data-version');
      banner.remove();
      banner = null;
    });

    banner.appendChild(text);
    banner.appendChild(go);
    banner.appendChild(close);
    document.body.appendChild(banner);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && Date.now() - lastCheck > MIN_GAP_MS) check();
  });
  setInterval(function () {
    if (document.visibilityState === 'visible') check();
  }, INTERVAL_MS);

  check();
})();
