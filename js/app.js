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
    document.getElementById('dogNameLabel').textContent = (s.settings.dogName || 'Hatchi') + (s.dogs.length > 1 ? ' ▾' : '');
    document.getElementById('dateLabel').textContent = UI.fmtLong(Store.todayISO());
  }

  /* ---- Sélecteur de chien : toucher le nom dans le bandeau ---- */
  function openDogSwitcher() {
    const dogs = Store.dogsList();
    const body = h('div', null, [
      h('div.card.flush', null, dogs.map((d) => h('div.row', {
        onClick: () => { UI.closeModal(); if (!d.active) { Store.setCurrentDog(d.id); UI.toast('🐾 ' + d.name); } }
      }, [
        h('div.row-ic', null, '🐕'),
        h('div.row-main', null, [h('strong', null, d.name), h('small', null, [d.breed, d.birthdate ? 'né(e) le ' + UI.fmtShortYear(d.birthdate) : ''].filter(Boolean).join(' · '))]),
        h('div.row-end', null, d.active ? h('span.badge.ok', null, '✓ affiché') : h('span.muted', null, '›'))
      ]))),
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => Views.openDogEditor(null), 50); } }, '+ Ajouter un chien')
    ]);
    UI.modal({ title: '🐾 Mes chiens', body });
  }
  const brand = document.querySelector('.brand');
  brand.style.cursor = 'pointer';
  brand.addEventListener('click', openDogSwitcher);

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

  /* ---- Bouton 📞 : appel direct du véto (choix véto/urgences si les deux sont renseignés) ---- */
  document.getElementById('vetCallBtn').addEventListener('click', () => {
    const s = Store.get();
    const vet = s.vetCurrent || {};
    const urg = s.vetEmergency || {};
    const call = (p) => { location.href = 'tel:' + String(p).replace(/[^+0-9]/g, ''); };
    if (vet.phone && urg.phone) {
      const body = h('div', null, [
        h('button.btn.block', { style: 'margin-bottom:8px', onClick: () => { UI.closeModal(); call(vet.phone); } }, '📞 ' + (vet.name || 'Vétérinaire') + ' — ' + vet.phone),
        h('button.btn.danger.block', { onClick: () => { UI.closeModal(); call(urg.phone); } }, '🚨 Urgences — ' + (urg.name ? urg.name + ' · ' : '') + urg.phone),
        h('button.btn.subtle.block', { style: 'margin-top:8px', onClick: () => UI.closeModal() }, 'Annuler')
      ]);
      UI.modal({ title: 'Appeler', body });
    } else if (vet.phone) call(vet.phone);
    else if (urg.phone) call(urg.phone);
    else { UI.toast('Renseigne le téléphone du véto dans Soins → Identité'); go('treatments'); }
  });

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
