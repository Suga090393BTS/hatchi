/* ============================================================
   Hatchi — UI helpers (DOM, modal, toast, format)
   Global: window.UI
   ============================================================ */
(function () {
  'use strict';

  const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
  const DAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Tiny hyperscript: h('div.cls#id', {attrs}, [children])
  function h(tag, attrs, children) {
    let id = null, cls = [];
    const m = tag.match(/^([a-z0-9]+)((?:[.#][\w-]+)*)$/i);
    let name = 'div';
    if (m) {
      name = m[1];
      const rest = m[2] || '';
      rest.split(/(?=[.#])/).forEach((tok) => {
        if (tok.startsWith('.')) cls.push(tok.slice(1));
        else if (tok.startsWith('#')) id = tok.slice(1);
      });
    } else { name = tag; }
    const el = document.createElement(name);
    if (id) el.id = id;
    if (cls.length) el.className = cls.join(' ');
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'dataset') { for (const d in v) el.dataset[d] = v[d]; }
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
        else el.setAttribute(k, v);
      }
    }
    appendChildren(el, children);
    return el;
  }
  function appendChildren(el, children) {
    if (children == null) return;
    if (!Array.isArray(children)) children = [children];
    children.forEach((c) => {
      if (c == null || c === false) return;
      if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
      else el.appendChild(c);
    });
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* ---------- Dates en français ---------- */
  function fmtLong(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = (d.getDay() + 6) % 7;
    return `${DAYS[day]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }
  function fmtShort(iso) {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 4)}.`;
  }
  function fmtShortYear(iso) {
    const d = new Date(iso + 'T00:00:00');
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }
  function relDays(days) {
    if (days === 0) return "aujourd'hui";
    if (days === 1) return 'demain';
    if (days === -1) return 'hier';
    if (days > 1) return `dans ${days} j`;
    return `il y a ${Math.abs(days)} j`;
  }
  function money(n) {
    if (!n) return '0 €';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  }
  function grams(g) {
    if (g >= 1000) return (g / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' kg';
    return g + ' g';
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    const host = document.getElementById('toastHost');
    const t = h('div.toast', null, msg);
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 1700);
    setTimeout(() => t.remove(), 2050);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    // opts: { title, body(el), onClose }
    const host = document.getElementById('modalHost');
    clear(host); host.hidden = false;
    const sheet = h('div.modal', null, [
      h('div.modal-grab'),
      opts.title ? h('h2', null, opts.title) : null,
      opts.body
    ]);
    host.appendChild(sheet);
    const close = () => { host.hidden = true; clear(host); if (opts.onClose) opts.onClose(); };
    host.onclick = (e) => { if (e.target === host) close(); };
    host._close = close;
    return { close, el: sheet };
  }
  function closeModal() {
    const host = document.getElementById('modalHost');
    if (host._close) host._close();
    else { host.hidden = true; clear(host); }
  }

  function confirm(message, opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      let done = false;
      const finish = (val) => { if (done) return; done = true; resolve(val); };
      const body = h('div', null, [
        h('p.muted', { style: 'margin:4px 4px 0' }, message),
        h('div.modal-actions', null, [
          h('button.btn.subtle', { onClick: () => { finish(false); closeModal(); } }, opts.cancel || 'Annuler'),
          h('button', { class: 'btn ' + (opts.danger ? 'danger' : ''), onClick: () => { finish(true); closeModal(); } }, opts.ok || 'Confirmer')
        ])
      ]);
      modal({ title: opts.title || 'Confirmer', body, onClose: () => finish(false) });
    });
  }

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  }

  /* ---------- En-tête d'une section ouverte depuis un onglet ----------
     Motif unique de navigation : les sections du carnet (soins, vaccins,
     journal…) s'ouvrent depuis l'onglet Chien et se referment par ce retour.
     Un seul niveau : pas de seconde barre qui reproposerait les mêmes entrées. */
  function subHead(title, onBack) {
    return h('div.subhead', null, [
      h('button.subhead-back', { onClick: onBack, title: 'Retour', 'aria-label': 'Retour' }, '‹'),
      h('h2', null, title)
    ]);
  }

  function emptyState(icon, title, sub) {
    return h('div.empty', null, [
      h('div.big', null, icon),
      h('strong', null, title),
      sub ? h('div.small', { style: 'margin-top:4px' }, sub) : null
    ]);
  }

  window.UI = { h, clear, appendChildren, fmtLong, fmtShort, fmtShortYear, relDays, money, grams, toast, modal, closeModal, confirm, emptyState, subHead, download, DAYS, DAYS_SHORT, MONTHS };
})();
