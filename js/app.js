/* ============================================================
   Hatchi — App bootstrap & router
   ============================================================ */
(function () {
  'use strict';
  const { h, clear } = UI;
  const Views = window.Views || {};

  const ROUTES = ['today', 'meals', 'shopping', 'treatments', 'journal', 'settings'];
  let current = location.hash.replace('#', '') || 'today';
  if (!ROUTES.includes(current)) current = 'today';

  const viewEl = document.getElementById('view');
  const tabbar = document.getElementById('tabbar');

  function render() {
    const view = Views[current];
    clear(viewEl);
    // remove any existing FAB
    const oldFab = document.querySelector('.fab'); if (oldFab) oldFab.remove();
    if (view && typeof view.render === 'function') {
      view.render(viewEl);
    } else {
      viewEl.appendChild(h('div.empty', null, 'Vue indisponible'));
    }
    // active tab
    [...tabbar.children].forEach((b) => b.classList.toggle('active', b.dataset.route === current));
    viewEl.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function go(route) {
    if (!ROUTES.includes(route)) route = 'today';
    current = route;
    history.replaceState(null, '', '#' + route);
    render();
  }
  window.App = { go, rerender: render };

  tabbar.addEventListener('click', (e) => {
    const b = e.target.closest('.tab');
    if (b) go(b.dataset.route);
  });
  window.addEventListener('hashchange', () => {
    const r = location.hash.replace('#', '');
    if (r && r !== current) go(r);
  });

  /* ---- Header bindings ---- */
  function refreshHeader() {
    const s = Store.get();
    document.getElementById('dogNameLabel').textContent = s.settings.dogName || 'Hatchi';
    document.getElementById('dateLabel').textContent = UI.fmtLong(Store.todayISO());
  }

  /* ---- Sync pill ---- */
  const pill = document.getElementById('syncPill');
  const syncText = document.getElementById('syncText');
  Store.onSync((st) => {
    pill.classList.toggle('synced', st === 'synced');
    pill.classList.toggle('error', st === 'error');
    syncText.textContent =
      st === 'synced' ? 'Synchro' :
      st === 'syncing' ? '…' :
      st === 'error' ? 'Erreur' : 'Local';
  });
  pill.addEventListener('click', () => go('settings'));

  /* ---- Re-render on state change (only current view) ---- */
  let raf = null;
  let pendingRender = false;
  function isEditingField() {
    const ae = document.activeElement;
    return ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && viewEl.contains(ae);
  }
  Store.subscribe(() => {
    refreshHeader();
    // Ne pas redessiner pendant une saisie (sélecteur de date, champ texte…) :
    // cela fermerait le clavier/picker et perdrait la saisie sur iOS.
    if (isEditingField()) { pendingRender = true; return; }
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; render(); });
  });
  // Quand l'utilisateur quitte un champ, on applique le rafraîchissement différé.
  viewEl.addEventListener('focusout', () => {
    if (!pendingRender) return;
    setTimeout(() => {
      if (isEditingField()) return; // un autre champ a pris le focus
      pendingRender = false;
      render();
    }, 50);
  });

  /* ---- Boot ---- */
  refreshHeader();
  render();

  // Lancer la sync si configurée
  const s = Store.get();
  if (s.settings.supabaseUrl && s.settings.supabaseKey) {
    Store.initSync();
  }

  // Rappels : notification quotidienne des soins en retard (à l'ouverture)
  function maybeNotify() {
    try {
      if (!('Notification' in window) || Notification.permission !== 'granted') return;
      const today = Store.todayISO();
      if (localStorage.getItem('hatchi.notified') === today) return;
      const due = Store.get().treatments
        .map((t) => ({ t, st: Store.dueStatus(t) }))
        .filter((x) => x.st.state === 'overdue' || x.st.state === 'soon');
      localStorage.setItem('hatchi.notified', today);
      if (!due.length) return;
      const names = due.map((x) => x.t.name).join(', ');
      new Notification('🐾 ' + (Store.get().settings.dogName || 'Hatchi') + ' — soins à faire', { body: names, icon: 'icon.svg' });
    } catch (e) { /* ignore */ }
  }
  maybeNotify();

  // Service worker + mise à jour automatique (uniquement si servi en http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded) return; reloaded = true; location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.update();
        setInterval(() => reg.update(), 60 * 60 * 1000); // re-vérifie chaque heure
      }).catch(() => {});
    });
  }
})();
