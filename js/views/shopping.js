/* ============================================================
   Vue Courses — « À acheter » (besoins − stock) + « Mon congélateur »
   Achats saisis en KG, stockés en grammes (conversion auto).
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, money, grams } = UI;

  let range = 'week';   // 'week' | 'month'
  let view = 'acheter'; // 'acheter' | 'stock'

  const CAT_ORDER = ['viande', 'abats', 'os', 'oeuf', 'legume', 'autre'];
  const CAT_LABEL = { viande: '🥩 Viandes', abats: '🫀 Abats', os: '🦴 Os', oeuf: '🥚 Œufs', legume: '🥕 Légumes', autre: '📦 Autre' };
  const catIcon = (c) => ({ viande: '🥩', abats: '🫀', os: '🦴', oeuf: '🥚', legume: '🥕' })[c] || '📦';

  function lineCost(ing, qty) {
    if (!ing || !ing.price) return 0;
    return ing.unit === 'piece' ? ing.price * qty : ing.price * (qty / 1000);
  }
  // Affichage d'une quantité : pièces => "×N", sinon kg/g automatique
  function qtyLabel(ing, qty) {
    return ing.unit === 'piece' ? ('×' + Math.ceil(qty)) : grams(Math.round(qty));
  }
  // Nom de l'ingrédient + morceau éventuel : "Poulet (cuisse)"
  function itemLabel(it) {
    const ing = Store.ingredient(it.ingredientId);
    const base = ing ? ing.name : 'Ingrédient supprimé';
    return it.cut ? base + ' (' + it.cut + ')' : base;
  }
  // Suggestions de morceaux (datalist)
  const CUTS = ['filet', 'blanc', 'cuisse', 'haut de cuisse', 'pilon', 'aile', 'manchon', 'escalope',
    'bavette', 'paleron', 'gîte', 'basse côte', 'collier', 'jarret', 'joue', 'macreuse', 'plat de côtes', 'tendron',
    'épaule', 'gigot', 'côte', 'foie', 'cœur', 'rognons', 'gésier', 'poumon', 'rate', 'tripes'];

  Views.shopping = {
    render(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: view === 'acheter' ? 'on' : '', onClick: () => { view = 'acheter'; App.rerender(); } }, '🛒 À acheter'),
        h('button', { class: view === 'stock' ? 'on' : '', onClick: () => { view = 'stock'; App.rerender(); } }, '🧊 Mon congélateur')
      ]));
      if (view === 'stock') stockView(root); else acheterView(root);
    }
  };

  /* ---------- À ACHETER (besoins − stock) ---------- */
  function acheterView(root) {
    root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
      h('button', { class: range === 'week' ? 'on' : '', onClick: () => { range = 'week'; App.rerender(); } }, 'Cette semaine'),
      h('button', { class: range === 'month' ? 'on' : '', onClick: () => { range = 'month'; App.rerender(); } }, 'Ce mois-ci')
    ]));

    const needs = Store.needs(range);
    const needIds = Object.keys(needs).filter((id) => needs[id] > 0);
    if (!needIds.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🛒', 'Rien à acheter', 'Planifie des repas dans la rotation pour générer la liste de courses.')));
      root.appendChild(h('button.btn.block', { onClick: () => App.go('meals') }, 'Configurer la rotation →'));
      return;
    }

    // Manquant = besoin − ce que j'ai déjà au congélateur
    const toBuy = {}; let covered = 0;
    needIds.forEach((id) => {
      const m = needs[id] - Store.stockOf(id);
      if (m > 0) toBuy[id] = m; else covered++;
    });
    const buyIds = Object.keys(toBuy);

    if (!buyIds.length) {
      root.appendChild(h('div.card', { style: 'background:var(--green-100);border-color:#bfe0d4' }, [
        h('div.inline', { style: 'gap:10px' }, [h('span', { style: 'font-size:24px' }, '✅'),
          h('div', null, [h('strong', null, 'Rien à acheter 🎉'), h('div.small.muted', null, 'Ton congélateur couvre déjà toute la période.')])])
      ]));
      return;
    }

    let grandTotal = 0;
    const byCat = {};
    buyIds.forEach((id) => { const ing = Store.ingredient(id); if (ing) (byCat[ing.category] = byCat[ing.category] || []).push({ ing, qty: toBuy[id] }); });

    CAT_ORDER.forEach((cat) => {
      const list = byCat[cat]; if (!list || !list.length) return;
      list.sort((a, b) => a.ing.name.localeCompare(b.ing.name));
      root.appendChild(h('div.section-title', null, CAT_LABEL[cat]));
      root.appendChild(h('div.card.flush', null, list.map(({ ing, qty }) => {
        const cost = lineCost(ing, qty); grandTotal += cost;
        const have = Store.stockOf(ing.id);
        return h('div.row', null, [
          h('div.row-ic', null, catIcon(ing.category)),
          h('div.row-main', null, [
            h('strong', null, ing.name),
            h('small', null, have ? ('déjà ' + qtyLabel(ing, have) + ' au congélo') : (ing.price ? money(ing.price) + (ing.unit === 'piece' ? '/u.' : '/kg') : 'prix non défini'))
          ]),
          h('div.row-end', null, [
            h('strong', null, qtyLabel(ing, qty) + ' à acheter'),
            cost ? h('span.muted.small', null, money(cost)) : null
          ])
        ]);
      })));
    });

    if (covered) root.appendChild(h('p.muted.small.center', { style: 'margin:6px' },
      '✓ ' + covered + ' ingrédient' + (covered > 1 ? 's' : '') + ' déjà couvert' + (covered > 1 ? 's' : '') + ' par le stock'));

    root.appendChild(h('div.card', { style: 'margin-top:8px' }, [
      h('div.inline', { style: 'justify-content:space-between' }, [
        h('div', null, [h('div.muted.small', null, 'Budget estimé'), h('div', { style: 'font-size:24px;font-weight:800;color:var(--green-700)' }, money(grandTotal))]),
        h('button.btn.ghost.sm', { onClick: () => App.go('settings') }, 'Prix')
      ])
    ]));
    root.appendChild(h('div.inline', { style: 'gap:8px' }, [
      h('button.btn.subtle', { style: 'flex:1', onClick: () => copyList(toBuy) }, '📋 Copier'),
      h('button.btn', { style: 'flex:1', onClick: () => openPurchaseModal(toBuy) }, '✓ J’ai tout acheté')
    ]));
  }

  /* ---------- MON CONGÉLATEUR ---------- */
  function stockView(root) {
    const low = Store.lowStock();
    if (low.length) {
      root.appendChild(h('div.card', { style: 'background:var(--amber-100);border-color:#eccf9a' }, [
        h('strong', null, '🧊 Bientôt épuisé'),
        h('div.small', { style: 'margin-top:4px' }, low.map((x) => x.ing.name).join(', '))
      ]));
    }

    root.appendChild(h('button.btn.block', { style: 'margin-bottom:12px', onClick: () => openPurchaseModal() }, '🛒 J’ai fait des courses'));

    const used = Store.needs(Math.max(7, (Store.get().settings.cycleWeeks || 1) * 7));
    const ings = Store.get().ingredients.filter((i) => Store.stockOf(i.id) > 0 || used[i.id]);
    if (!ings.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🧊', 'Congélateur vide', 'Appuie sur « J’ai fait des courses » pour enregistrer ce que tu as acheté.')));
    } else {
      root.appendChild(h('div.card.flush', null, ings.map((ing) => {
        const qty = Store.stockOf(ing.id);
        const days = Store.coverageDays(ing.id);
        const piece = ing.unit === 'piece';
        const step = piece ? 1 : 100;
        const cov = days === Infinity ? null : (days < 1 ? 'reste <1 j' : 'reste ~' + Math.floor(days) + ' j');
        const lowS = days !== Infinity && days < (Store.get().settings.stockAlertDays || 3);
        return h('div.row', null, [
          h('div.row-ic', null, catIcon(ing.category)),
          h('div.row-main', null, [h('strong', null, ing.name),
            h('small', null, [piece ? qty + ' u.' : grams(qty), cov ? '  ·  ' : '',
              cov ? h('span', { style: lowS ? 'color:var(--red);font-weight:700' : '' }, cov) : ''])]),
          h('div.row-end', null, h('div.inline', { style: 'gap:6px' }, [
            h('button.btn.subtle.icon', { onClick: () => Store.adjustStock(ing.id, -step) }, '−'),
            h('button.btn.subtle.icon', { onClick: () => Store.adjustStock(ing.id, step) }, '+'),
            h('button.btn.ghost.icon', { onClick: () => editStock(ing) }, '✎')
          ]))
        ]);
      })));
      root.appendChild(h('p.muted.small', { style: 'margin:10px 4px' }, 'Les boutons − / + ajustent par ' + '100 g (ou 1 pièce). Le stock se déduit tout seul quand un repas est marqué « donné ».'));
    }

    // Historique des achats + dépenses du mois
    const purchases = Store.purchasesSorted();
    if (purchases.length) {
      const spent = Store.spentInMonth();
      root.appendChild(h('div.section-title', null, 'Mes courses récentes'));
      if (spent) root.appendChild(h('div.card', { style: 'padding:12px 16px' }, h('div.inline', { style: 'justify-content:space-between' }, [
        h('span.muted', null, 'Dépensé ce mois-ci'), h('strong', { style: 'color:var(--green-700)' }, money(spent))
      ])));
      root.appendChild(h('div.card.flush', null, purchases.slice(0, 15).map((p) => {
        const summary = p.items.map((it) => { const ing = Store.ingredient(it.ingredientId); return ing ? qtyLabel(ing, it.qty) + ' ' + itemLabel(it) : ''; }).filter(Boolean).join(', ');
        return h('div.row', { onClick: () => openPurchaseDetail(p) }, [
          h('div.row-ic', null, '🛒'),
          h('div.row-main', null, [h('strong', null, UI.fmtShortYear(p.date) + (p.cost ? ' · ' + money(p.cost) : '')), h('small', null, summary)]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ]);
      })));
      root.appendChild(h('p.muted.small.center', { style: 'margin:8px' }, 'Touche un achat pour le voir ou le supprimer.'));
    }
  }

  function editStock(ing) {
    let v = Store.stockOf(ing.id);
    const piece = ing.unit === 'piece';
    let kg = piece ? v : +(v / 1000).toFixed(2);
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Stock de ' + ing.name + (piece ? ' (pièces)' : ' (kg)')),
        h('input.input', { type: 'number', min: '0', step: piece ? '1' : '0.1', value: piece ? v : kg, onInput: (e) => { kg = +e.target.value || 0; } })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => { Store.setStock(ing.id, piece ? Math.round(kg) : Math.round(kg * 1000)); UI.closeModal(); } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: 'Stock — ' + ing.name, body });
  }

  /* ---------- Détail d'un achat (voir / supprimer) ---------- */
  function openPurchaseDetail(p) {
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 12px' }, UI.fmtLong(p.date) + (p.cost ? '  ·  ' + money(p.cost) : '')),
      h('div.card.flush', null, p.items.map((it) => {
        const ing = Store.ingredient(it.ingredientId);
        return h('div.row', null, [
          h('div.row-ic', null, catIcon(ing ? ing.category : 'autre')),
          h('div.row-main', null, h('strong', null, itemLabel(it))),
          h('div.row-end', null, h('strong', null, ing ? qtyLabel(ing, it.qty) : ''))
        ]);
      })),
      h('p.muted.small', { style: 'margin:10px 4px 0' }, 'Supprimer cet achat retirera ces quantités de ton congélateur.'),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Fermer'),
        h('button.btn.danger', { style: 'flex:2', onClick: () => { Store.removePurchase(p.id); UI.closeModal(); UI.toast('Achat supprimé'); } }, '🗑 Supprimer cet achat')
      ])
    ]);
    UI.modal({ title: 'Achat du ' + UI.fmtShortYear(p.date), body });
  }

  /* ---------- Enregistrer un achat (saisie en KG) ---------- */
  function openPurchaseModal(prefill) {
    prefill = prefill || {};
    let dateVal = Store.todayISO();
    let cost = '';
    const cats = ['viande', 'abats', 'os', 'oeuf', 'legume'];
    const rows = Store.get().ingredients.filter((i) => cats.includes(i.category)).map((ing) => {
      const piece = ing.unit === 'piece';
      const pre = prefill[ing.id] || 0;
      const initVal = piece ? (pre ? Math.ceil(pre) : '') : (pre ? +(pre / 1000).toFixed(2) : '');
      return { ing, piece, cuttable: ['viande', 'abats'].includes(ing.category), cut: '', val: initVal === '' ? 0 : initVal, init: initVal };
    });

    const list = h('div');
    rows.forEach((r) => {
      const echo = h('span.muted.small', { style: 'min-width:74px;text-align:right' });
      const cutInput = r.cuttable ? h('input.input', { placeholder: 'morceau (ex. cuisse, bavette…) — facultatif', list: 'hatchi-cuts', style: 'margin-top:6px;font-size:14px;padding:8px 10px', onInput: (e) => r.cut = e.target.value.trim() }) : null;
      const cutWrap = cutInput ? h('div', { style: r.val > 0 ? '' : 'display:none' }, cutInput) : null;
      const refresh = () => {
        echo.textContent = r.piece ? '' : (r.val ? '= ' + Math.round(r.val * 1000) + ' g' : '');
        if (cutWrap) cutWrap.style.display = r.val > 0 ? '' : 'none';
      };
      const input = h('input.input', { type: 'number', min: '0', step: r.piece ? '1' : '0.1', value: r.init, placeholder: '0', style: 'width:74px', onInput: (e) => { r.val = +e.target.value || 0; refresh(); } });
      refresh();
      list.appendChild(h('div', { style: 'margin-bottom:8px' }, [
        h('div.inline', { style: 'gap:8px' }, [
          h('span', { style: 'flex:1;font-size:14px' }, r.ing.name),
          input,
          h('span.muted.small', { style: 'width:22px' }, r.piece ? 'u.' : 'kg'),
          echo
        ]),
        cutWrap
      ]));
    });

    const body = h('div', null, [
      h('datalist', { id: 'hatchi-cuts' }, CUTS.map((c) => h('option', { value: c }))),
      h('p.muted.small', { style: 'margin:0 4px 12px' }, 'Combien en as-tu acheté ? Saisis la viande en kilos — le stock est calculé automatiquement. Le morceau est facultatif.'),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Date'), h('input.input', { type: 'date', value: dateVal, max: Store.todayISO(), onChange: (e) => dateVal = e.target.value })]),
        h('div.field', null, [h('label', null, 'Prix total (€, optionnel)'), h('input.input', { type: 'number', step: '0.01', min: '0', placeholder: '0', onInput: (e) => cost = e.target.value })])
      ]),
      h('div.field', null, [h('label', null, 'Quantités achetées'), list]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          const items = rows.filter((r) => r.val > 0).map((r) => ({ ingredientId: r.ing.id, qty: r.piece ? Math.round(r.val) : Math.round(r.val * 1000), cut: r.cut || '' }));
          if (!items.length) { UI.toast('Saisis au moins une quantité'); return; }
          Store.addPurchase({ date: dateVal, items, cost });
          UI.closeModal(); UI.toast('Ajouté au congélateur ✓');
        } }, 'Ajouter au congélateur')
      ])
    ]);
    UI.modal({ title: '🛒 J’ai fait des courses', body });
  }

  /* ---------- Copier la liste ---------- */
  function copyList(toBuy) {
    const lines = [];
    CAT_ORDER.forEach((cat) => {
      const items = Object.keys(toBuy)
        .map((id) => ({ ing: Store.ingredient(id), qty: toBuy[id] }))
        .filter((x) => x.ing && x.ing.category === cat && x.qty > 0)
        .sort((a, b) => a.ing.name.localeCompare(b.ing.name));
      if (!items.length) return;
      lines.push(CAT_LABEL[cat].replace(/^[^ ]+ /, '').toUpperCase());
      items.forEach(({ ing, qty }) => lines.push('- ' + ing.name + ' : ' + qtyLabel(ing, qty)));
      lines.push('');
    });
    const text = 'Liste de courses Hatchi\n\n' + lines.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.toast('Liste copiée ✓'), () => UI.toast('Copie impossible'));
    else UI.toast('Copie non supportée');
  }
})();
