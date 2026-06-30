/* ============================================================
   Vue Courses — liste agrégée + budget, depuis la rotation
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, money, grams } = UI;

  let range = 'week'; // 'week' | 'month'
  let view = 'courses'; // 'courses' | 'stock'

  const CAT_ORDER = ['viande', 'abats', 'os', 'oeuf', 'legume', 'autre'];
  const CAT_LABEL = { viande: '🥩 Viandes', abats: '🫀 Abats', os: '🦴 Os', oeuf: '🥚 Œufs', legume: '🥕 Légumes', autre: '📦 Autre' };

  function datesFor(range) {
    const today = new Date(Store.todayISO() + 'T00:00:00');
    const out = [];
    if (range === 'week') {
      // semaine en cours (lundi -> dimanche)
      const monday = new Date(Store.mondayOf(Store.todayISO()) + 'T00:00:00');
      for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(d.getDate() + i); out.push(Store.isoLocal(d)); }
    } else {
      // 30 jours à partir d'aujourd'hui
      for (let i = 0; i < 30; i++) { const d = new Date(today); d.setDate(d.getDate() + i); out.push(Store.isoLocal(d)); }
    }
    return out;
  }

  function aggregate(range) {
    const totals = {}; // ingredientId => qty
    datesFor(range).forEach((iso) => {
      ['matin', 'soir'].forEach((slot) => {
        Store.mealsForDay(iso, slot).forEach((m) => {
          (m.items || []).forEach((it) => {
            totals[it.ingredientId] = (totals[it.ingredientId] || 0) + (it.qty || 0);
          });
        });
      });
    });
    return totals;
  }

  function lineCost(ing, qty) {
    if (!ing || !ing.price) return 0;
    return ing.unit === 'piece' ? ing.price * qty : ing.price * (qty / 1000);
  }

  Views.shopping = {
    render(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: view === 'courses' ? 'on' : '', onClick: () => { view = 'courses'; App.rerender(); } }, '🛒 Courses'),
        h('button', { class: view === 'stock' ? 'on' : '', onClick: () => { view = 'stock'; App.rerender(); } }, '🧊 Stock')
      ]));
      if (view === 'stock') return stockView(root);
      coursesView(root);
    }
  };

  function coursesView(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: range === 'week' ? 'on' : '', onClick: () => { range = 'week'; App.rerender(); } }, 'Cette semaine'),
        h('button', { class: range === 'month' ? 'on' : '', onClick: () => { range = 'month'; App.rerender(); } }, '30 prochains jours')
      ]));

      const totals = aggregate(range);
      const ids = Object.keys(totals).filter((id) => totals[id] > 0);

      if (!ids.length) {
        root.appendChild(h('div.card', null, UI.emptyState('🛒', 'Liste vide', 'Planifiez des repas dans la rotation pour générer automatiquement la liste de courses.')));
        root.appendChild(h('button.btn.block', { onClick: () => App.go('meals') }, 'Configurer la rotation →'));
        return;
      }

      // Group by category
      let grandTotal = 0;
      const byCat = {};
      ids.forEach((id) => {
        const ing = Store.ingredient(id);
        if (!ing) return;
        (byCat[ing.category] = byCat[ing.category] || []).push({ ing, qty: totals[id] });
      });

      CAT_ORDER.forEach((cat) => {
        const list = byCat[cat];
        if (!list || !list.length) return;
        list.sort((a, b) => a.ing.name.localeCompare(b.ing.name));
        root.appendChild(h('div.section-title', null, CAT_LABEL[cat]));
        root.appendChild(h('div.card.flush', null, list.map(({ ing, qty }) => {
          const cost = lineCost(ing, qty); grandTotal += cost;
          return h('div.row', null, [
            h('div.row-ic', null, ing.unit === 'piece' ? '🔢' : '⚖️'),
            h('div.row-main', null, [
              h('strong', null, ing.name),
              h('small', null, ing.price ? `${money(ing.price)}${ing.unit === 'piece' ? '/u.' : '/kg'}` : 'Prix non défini')
            ]),
            h('div.row-end', null, [
              h('strong', null, ing.unit === 'piece' ? '×' + qty : grams(qty)),
              cost ? h('span.muted.small', null, money(cost)) : null
            ])
          ]);
        })));
      });

      // Budget summary
      root.appendChild(h('div.card', { style: 'margin-top:14px' }, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('div.muted.small', null, 'Budget estimé'), h('div', { style: 'font-size:24px;font-weight:800;color:var(--green-700)' }, money(grandTotal))]),
          h('button.btn.ghost.sm', { onClick: () => App.go('settings') }, 'Modifier les prix')
        ]),
        h('p.muted.small', { style: 'margin:10px 4px 0' }, 'Estimation basée sur la rotation et les prix des ingrédients. Ajustez les prix dans Réglages › Ingrédients.')
      ]));

      // Copy to clipboard
      root.appendChild(h('button.btn.subtle.block', { style: 'margin-top:4px', onClick: () => copyList(totals) }, '📋 Copier la liste'));
  }

  /* ---------- Stock ---------- */
  function stockView(root) {
    const low = Store.lowStock();
    if (low.length) {
      root.appendChild(h('div.card', { style: 'background:var(--amber-100);border-color:#eccf9a' }, [
        h('strong', null, '🧊 À réapprovisionner'),
        h('div.small', { style: 'margin-top:4px' }, low.map((x) => x.ing.name).join(', '))
      ]));
    }

    root.appendChild(h('div.inline', { style: 'gap:8px;margin-bottom:12px' }, [
      h('button.btn.ghost.sm', { style: 'flex:1', onClick: () => { Store.restockFromNeeds('week'); UI.toast('Stock + 1 semaine'); } }, '+ Semaine'),
      h('button.btn.ghost.sm', { style: 'flex:1', onClick: () => { Store.restockFromNeeds('month'); UI.toast('Stock + 30 jours'); } }, '+ 30 jours')
    ]));

    // ingrédients : ceux utilisés en rotation ou ayant du stock
    const used = Store.needs(Math.max(7, (Store.get().settings.cycleWeeks || 1) * 7));
    const ings = Store.get().ingredients.filter((i) => Store.stockOf(i.id) > 0 || used[i.id]);
    if (!ings.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🧊', 'Stock vide', 'Ajoutez des ingrédients à la rotation, puis réapprovisionnez depuis la liste de courses.')));
      return;
    }
    root.appendChild(h('div.card.flush', null, ings.map((ing) => {
      const qty = Store.stockOf(ing.id);
      const days = Store.coverageDays(ing.id);
      const piece = ing.unit === 'piece';
      const step = piece ? 1 : 100;
      const cov = days === Infinity ? null : (days < 1 ? '<1 j' : Math.floor(days) + ' j');
      const low = days !== Infinity && days < (Store.get().settings.stockAlertDays || 3);
      return h('div.row', null, [
        h('div.row-ic', null, ({ viande: '🥩', abats: '🫀', os: '🦴', oeuf: '🥚', legume: '🥕' })[ing.category] || '📦'),
        h('div.row-main', null, [h('strong', null, ing.name),
          h('small', null, [piece ? qty + ' u.' : UI.grams(qty), cov ? '  ·  ' : '', cov ? h('span', { class: low ? '' : '', style: low ? 'color:var(--red);font-weight:700' : '' }, cov + ' de stock') : ''])]),
        h('div.row-end', null, h('div.inline', { style: 'gap:6px' }, [
          h('button.btn.subtle.icon', { onClick: () => Store.adjustStock(ing.id, -step) }, '−'),
          h('button.btn.subtle.icon', { onClick: () => Store.adjustStock(ing.id, step) }, '+'),
          h('button.btn.ghost.icon', { onClick: () => editStock(ing) }, '✎')
        ]))
      ]);
    })));
    root.appendChild(h('p.muted.small', { style: 'margin:10px 4px' }, '± ajuste de ' + 'manière rapide (100 g / 1 pièce). Le stock se déduit automatiquement quand un repas est marqué « donné ».'));
  }

  function editStock(ing) {
    let v = Store.stockOf(ing.id);
    const piece = ing.unit === 'piece';
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Stock de ' + ing.name + (piece ? ' (pièces)' : ' (g)')),
        h('input.input', { type: 'number', min: '0', value: v, onInput: (e) => v = +e.target.value || 0 })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => { Store.setStock(ing.id, v); UI.closeModal(); } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: 'Stock — ' + ing.name, body });
  }

  function copyList(totals) {
    const lines = [];
    CAT_ORDER.forEach((cat) => {
      const items = Object.keys(totals)
        .map((id) => ({ ing: Store.ingredient(id), qty: totals[id] }))
        .filter((x) => x.ing && x.ing.category === cat && x.qty > 0)
        .sort((a, b) => a.ing.name.localeCompare(b.ing.name));
      if (!items.length) return;
      lines.push(CAT_LABEL[cat].replace(/^[^ ]+ /, '').toUpperCase());
      items.forEach(({ ing, qty }) => lines.push(`- ${ing.name} : ${ing.unit === 'piece' ? '×' + qty : grams(qty)}`));
      lines.push('');
    });
    const text = 'Liste de courses Hatchi\n\n' + lines.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.toast('Liste copiée ✓'), () => UI.toast('Copie impossible'));
    else UI.toast('Copie non supportée');
  }
})();
