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
  Store.subscribe(() => {
    refreshHeader();
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = null; render(); });
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

  // Service worker (uniquement si servi en http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
