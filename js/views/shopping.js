/* ============================================================
   Vue Courses — « À acheter » (besoins − stock) + « Mon congélateur »
   Achats saisis en KG, stockés en grammes (conversion auto).
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, money, grams } = UI;

  let range = 'week';   // 'week' | 'month'
  let view = 'acheter'; // 'acheter' | 'achats' | 'stock'
  let stockCat = 'tout'; // filtre catégorie du stock : 'tout' | 'viande' | 'legume'…

  const { CAT_ORDER, CAT_LABEL, catIcon } = UI; // catégories : source unique dans ui.js
  let buyCat = 'tout'; // onglet de catégorie de la liste de courses

  function lineCost(ing, qty) {
    if (!ing || !ing.price) return 0;
    return ing.unit === 'piece' ? ing.price * qty : ing.price * (qty / 1000);
  }
  // Étiquette de prix d'un ingrédient : produit maison (coût 0 €), prix, ou non défini
  function priceLabel(ing) {
    if (ing.free) return '🏡 produit maison · 0 €';
    return ing.price ? money(ing.price) + (ing.unit === 'piece' ? '/u.' : '/kg') : 'prix non défini';
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
  // Suggestions de morceaux : liste éditable dans Réglages, enrichie automatiquement par les achats

  Views.shopping = {
    render(root) {
      const tab = (v, label) => h('button', { class: view === v ? 'on' : '', onClick: () => { view = v; App.rerender(); } }, label);
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        tab('acheter', '🛒 À acheter'),
        tab('achats', '🧾 Achats'),
        tab('stock', '📦 Stock')
      ]));
      if (view === 'achats') achatsView(root);
      else if (view === 'stock') stockView(root);
      else acheterView(root);
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

    // Manquant = besoin − ce que j'ai déjà en stock. Produits maison → à préparer, le reste → à acheter
    const toBuy = {}; const toPrepare = {}; let covered = 0;
    needIds.forEach((id) => {
      const m = needs[id] - Store.stockOf(id);
      if (m <= 0) { covered++; return; }
      const ing = Store.ingredient(id);
      if (ing && ing.free) toPrepare[id] = m; else toBuy[id] = m;
    });
    const buyIds = Object.keys(toBuy);
    const prepIds = Object.keys(toPrepare);

    if (!buyIds.length && !prepIds.length) {
      root.appendChild(h('div.card', { style: 'background:var(--green-100);border-color:#bfe0d4' }, [
        h('div.inline', { style: 'gap:10px' }, [h('span', { style: 'font-size:24px' }, '✅'),
          h('div', null, [h('strong', null, 'Rien à acheter 🎉'), h('div.small.muted', null, 'Ton stock couvre déjà toute la période.')])])
      ]));
      return;
    }

    // 🏡 Production maison : à préparer/récolter, pas à acheter
    if (prepIds.length) {
      root.appendChild(h('div.section-title', null, '🏡 À préparer (production maison)'));
      root.appendChild(h('div.card.flush', null, prepIds.map((id) => {
        const ing = Store.ingredient(id); const qty = toPrepare[id];
        const have = Store.stockOf(id);
        return h('div.row', null, [
          h('div.row-ic', null, catIcon(ing.category)),
          h('div.row-main', null, [h('strong', null, ing.name),
            h('small', null, have ? 'déjà ' + qtyLabel(ing, have) + ' en stock' : '🏡 produit maison · 0 €')]),
          h('div.row-end', null, [
            h('strong', null, qtyLabel(ing, qty)),
            h('button.btn.sm', { onClick: () => openPrepareModal(ing, qty) }, '✓ Préparé')
          ])
        ]);
      })));
    }

    // Budget : toujours calculé sur la liste entière, indépendamment de l'onglet affiché
    let grandTotal = 0;
    buyIds.forEach((id) => { const ing = Store.ingredient(id); if (ing) grandTotal += lineCost(ing, toBuy[id]); });

    // Onglets de catégorie plutôt qu'une longue liste à dérouler
    const buyIngs = buyIds.map((id) => Store.ingredient(id)).filter(Boolean);
    const present = CAT_ORDER.filter((c) => buyIngs.some((i) => i.category === c));
    if (buyCat !== 'tout' && present.indexOf(buyCat) === -1) buyCat = 'tout';
    const tabs = UI.catTabs(present, buyCat, (c) => { buyCat = c; App.rerender(); });
    if (tabs) root.appendChild(tabs);

    const shown = buyIngs
      .filter((ing) => buyCat === 'tout' || ing.category === buyCat)
      .sort((a, b) => (CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)) || a.name.localeCompare(b.name));
    root.appendChild(h('div.card.flush', null, shown.map((ing) => {
      const qty = toBuy[ing.id];
      const cost = lineCost(ing, qty);
      const have = Store.stockOf(ing.id);
      return h('div.row', null, [
        h('div.row-ic', null, catIcon(ing.category)),
        h('div.row-main', null, [
          h('strong', null, ing.name),
          h('small', null, have ? ('déjà ' + qtyLabel(ing, have) + ' en stock') : priceLabel(ing))
        ]),
        h('div.row-end', null, [
          h('strong', null, qtyLabel(ing, qty) + ' à acheter'),
          cost ? h('span.muted.small', null, money(cost)) : null
        ])
      ]);
    })));

    if (covered) root.appendChild(h('p.muted.small.center', { style: 'margin:6px' },
      '✓ ' + covered + ' ingrédient' + (covered > 1 ? 's' : '') + ' déjà couvert' + (covered > 1 ? 's' : '') + ' par le stock'));

    if (buyIds.length) {
      root.appendChild(h('div.card', { style: 'margin-top:8px' }, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('div.muted.small', null, 'Budget estimé'), h('div', { style: 'font-size:24px;font-weight:800;color:var(--green-700)' }, money(grandTotal))]),
          h('button.btn.ghost.sm', { onClick: () => App.go('meals') }, 'Prix')
        ])
      ]));
      root.appendChild(h('div.inline', { style: 'gap:8px' }, [
        h('button.btn.subtle', { style: 'flex:1', onClick: () => copyList(toBuy) }, '📋 Copier'),
        h('button.btn', { style: 'flex:1', onClick: () => openPurchaseModal(toBuy) }, '✓ J’ai tout acheté')
      ]));
    }
  }

  // « ✓ Préparé » : la production maison rejoint le stock, coût 0 €
  function openPrepareModal(ing, neededQty) {
    const piece = ing.unit === 'piece';
    let q = piece ? Math.ceil(neededQty) : neededQty;
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 10px' }, '🏡 ' + ing.name + ' — production maison, coût 0 €. La quantité rejoint ton stock.'),
      h('div.field', null, [h('label', null, 'Quantité préparée' + (piece ? ' (pièces)' : ' (g)')),
        h('input.input', { type: 'number', min: '0', step: piece ? '1' : '50', value: q, onInput: (e) => q = +e.target.value || 0 })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!(q > 0)) { UI.toast('Indique une quantité'); return; }
          Store.addPurchase({ items: [{ ingredientId: ing.id, qty: piece ? Math.round(q) : Math.round(q) }] });
          UI.closeModal(); UI.toast('🏡 ' + qtyLabel(ing, q) + ' de ' + ing.name + ' ajouté au stock ✓');
        } }, '✓ Ajouter au stock')
      ])
    ]);
    UI.modal({ title: '🏡 Préparé — ' + ing.name, body });
  }

  /* ---------- ACHATS : enregistrer ses courses, historique, listes ---------- */
  function achatsView(root) {
    root.appendChild(h('button.btn.block', { style: 'margin-bottom:12px', onClick: () => openPurchaseModal() }, '🛒 J’ai fait des courses'));

    const purchases = Store.purchasesSorted();
    if (!purchases.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🧾', 'Aucun achat enregistré',
        'Enregistre tes courses pour suivre ton budget et alimenter ton stock.')));
    } else {
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

    // Listes qui servent à la saisie d'un achat
    root.appendChild(h('div.section-title', null, 'Listes'));
    root.appendChild(h('div.card', null, h('div.inline', { style: 'justify-content:space-between' }, [
      h('div', null, [h('strong', null, Store.get().ingredients.length + ' articles'),
        h('div.muted.small', null, 'Noms, catégories et prix')]),
      h('button.btn.ghost.sm', { onClick: () => Views.openIngredientsList() }, 'Gérer')
    ])));
    root.appendChild(h('div.card', null, h('div.inline', { style: 'justify-content:space-between' }, [
      h('div', null, [h('strong', null, Store.cuts().length + ' morceaux'),
        h('div.muted.small', null, 'Suggestions à la saisie d’un achat')]),
      h('button.btn.ghost.sm', { onClick: openCutsList }, 'Gérer')
    ])));
  }

  /* ---------- STOCK : ce qu'il reste, par catégorie ---------- */
  function stockView(root) {
    const low = Store.lowStock();
    if (low.length) {
      root.appendChild(h('div.card', { style: 'background:var(--amber-100);border-color:#eccf9a' }, [
        h('strong', null, '🧊 Bientôt épuisé'),
        h('div.small', { style: 'margin-top:4px' }, low.map((x) => x.ing.name).join(', '))
      ]));
    }

    // Inventaire : une seule quantité par ingrédient (plus de distinction frigo / congélo)
    const used = Store.needs(Store.planningDays());
    const allIngs = Store.get().ingredients.filter((i) => Store.stockOf(i.id) > 0 || used[i.id]);

    // Onglets de catégorie (barre partagée)
    const presentCats = CAT_ORDER.filter((cat) => allIngs.some((i) => i.category === cat));
    if (stockCat !== 'tout' && presentCats.indexOf(stockCat) === -1) stockCat = 'tout';
    const stockTabs = UI.catTabs(presentCats, stockCat, (c) => { stockCat = c; App.rerender(); });
    if (stockTabs) root.appendChild(stockTabs);

    const ings = (stockCat === 'tout' ? allIngs : allIngs.filter((i) => i.category === stockCat))
      .slice().sort((a, b) => (CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)) || a.name.localeCompare(b.name, 'fr'));

    if (!ings.length) {
      root.appendChild(h('div.card', null, UI.emptyState('📦', 'Aucun article en stock',
        'Enregistre tes courses dans l’onglet Achats pour alimenter ton stock.')));
    } else {
      root.appendChild(h('div.card.flush', null, ings.map((ing) => {
        const qty = Store.stockOf(ing.id);
        const days = Store.coverageDays(ing.id);
        const cov = days === Infinity ? null : (days < 1 ? 'reste <1 j' : 'reste ~' + Math.floor(days) + ' j');
        const lowS = days !== Infinity && days < (Store.get().settings.stockAlertDays || 3);
        return h('div.row', { onClick: () => editStock(ing) }, [
          h('div.row-ic', null, catIcon(ing.category)),
          h('div.row-main', null, [h('strong', null, ing.name),
            h('small', null, [qty ? qtyLabel(ing, qty) : 'épuisé', cov ? '  ·  ' : '',
              cov ? h('span', { style: lowS ? 'color:var(--red);font-weight:700' : '' }, cov) : ''])]),
          h('div.row-end', null, h('button.btn.ghost.icon', { onClick: () => editStock(ing) }, '✎'))
        ]);
      })));
    }

    // L'alerte pilote ce qui s'affiche ci-dessus : elle vit avec le stock
    root.appendChild(h('div.section-title', null, 'Réglage'));
    root.appendChild(h('div.card', null, [
      h('div.field', { style: 'margin-bottom:0' }, [h('label', null, 'Alerte stock (jours)'),
        h('input.input', { type: 'number', min: '1', value: Store.get().settings.stockAlertDays || 3,
          onChange: (e) => Store.updateSettings({ stockAlertDays: +e.target.value || 3 }) })]),
      h('p.muted.small', { style: 'margin:8px 4px 0' }, 'Préviens-moi quand un ingrédient couvre moins de N jours de repas (tous chiens confondus).')
    ]));
  }

  /* ---------- Morceaux (suggestions à la saisie d'un achat — leur seul usage) ---------- */
  function openCutsList() {
    const cuts = Store.cuts();
    const card = h('div.card.flush');
    if (!cuts.length) card.appendChild(h('div.empty', { style: 'padding:18px' }, 'Aucun morceau'));
    cuts.forEach((c) => {
      card.appendChild(h('div.row', null, [
        h('div.row-ic', null, '🔪'),
        h('div.row-main', null, h('strong', null, c)),
        h('div.row-end', null, h('div.inline', { style: 'gap:4px' }, [
          h('button.btn.ghost.icon', { onClick: () => { UI.closeModal(); setTimeout(() => openCutEditor(c), 50); } }, '✎'),
          h('button.delete-x', { onClick: async () => {
            if (await UI.confirm('Supprimer « ' + c + ' » des suggestions ?', { danger: true, ok: 'Supprimer' })) {
              Store.removeCut(c); UI.closeModal(); setTimeout(openCutsList, 50);
            }
          } }, '✕')
        ]))
      ]));
    });
    UI.modal({ title: 'Morceaux', body: h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Suggestions proposées à la saisie d’un achat (viandes & abats). Un morceau inconnu saisi dans un achat s’ajoute automatiquement ici.'),
      card,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openCutEditor(null), 50); } }, '+ Ajouter un morceau')
    ]) });
  }
  function openCutEditor(cut) {
    let name = cut || '';
    UI.modal({ title: cut ? 'Modifier le morceau' : 'Nouveau morceau', body: h('div', null, [
      h('div.field', null, [h('label', null, 'Nom du morceau'), h('input.input', { value: name, placeholder: 'Ex. bavette', onInput: (e) => name = e.target.value })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => { UI.closeModal(); setTimeout(openCutsList, 50); } }, 'Annuler'),
        h('button.btn', { onClick: () => {
          if (!name.trim()) { UI.toast('Nom requis'); return; }
          if (cut) Store.renameCut(cut, name);
          else if (!Store.addCut(name)) { UI.toast('Ce morceau existe déjà'); return; }
          UI.closeModal(); setTimeout(openCutsList, 50);
        } }, 'Enregistrer')
      ])
    ]) });
  }

  function editStock(ing) {
    const piece = ing.unit === 'piece';
    const toUnit = (v) => piece ? v : +(v / 1000).toFixed(2);
    const fromUnit = (v) => piece ? Math.round(v) : Math.round(v * 1000);
    let q = toUnit(Store.stockOf(ing.id));
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Quantité en stock' + (piece ? ' (pièces)' : ' (kg)')),
        h('input.input', { type: 'number', min: '0', step: piece ? '1' : '0.1', value: q, onInput: (e) => { q = +e.target.value || 0; } })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => { Store.setStock(ing.id, fromUnit(q)); UI.closeModal(); } }, 'Enregistrer')
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
          h('div.row-end', null, [
            h('strong', null, ing ? qtyLabel(ing, it.qty) : ''),
            it.price ? h('span.muted.small', null, money(it.price)) : null
          ])
        ]);
      })),
      h('p.muted.small', { style: 'margin:10px 4px 0' }, 'Supprimer cet achat retirera ces quantités de ton stock.'),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Fermer'),
        h('button.btn.danger', { style: 'flex:2', onClick: () => { Store.removePurchase(p.id); UI.closeModal(); UI.toast('Achat supprimé'); } }, '🗑 Supprimer cet achat')
      ])
    ]);
    UI.modal({ title: 'Achat du ' + UI.fmtShortYear(p.date), body });
  }

  /* ---------- Enregistrer un achat — article par article ----------
     1) Panier : la liste de ce que j'ai acheté (+ total calculé)
     2) Choix d'un article (onglets par catégorie)
     3) Fiche article : poids/nombre + prix au kilo OU prix total
        (l'autre se calcule tout seul) + morceau pour viandes/abats */
  function openPurchaseModal(prefill) {
    let dateVal = Store.todayISO();
    let pickCat = null; // dernier onglet utilisé dans le choix d'article
    const basket = [];
    if (prefill) {
      Object.keys(prefill).forEach((id) => {
        const ing = Store.ingredient(id);
        if (!ing || !(prefill[id] > 0)) return;
        const piece = ing.unit === 'piece';
        const qty = piece ? Math.ceil(prefill[id]) : Math.round(prefill[id]);
        const ppk = ing.price || 0;
        basket.push({ ing, qty, cut: '', ppk, price: ppk ? +(piece ? ppk * qty : ppk * qty / 1000).toFixed(2) : 0 });
      });
    }

    /* --- Étape 1 : le panier --- */
    function mainStep() {
      const total = basket.reduce((s, l) => s + (l.price || 0), 0);
      const listEl = basket.length
        ? h('div.card.flush', null, basket.map((l, idx) => h('div.row', { onClick: () => formStep(l.ing, l) }, [
            h('div.row-ic', null, catIcon(l.ing.category)),
            h('div.row-main', null, [
              h('strong', null, l.ing.name + (l.cut ? ' (' + l.cut + ')' : '')),
              h('small', null, qtyLabel(l.ing, l.qty) + (l.price ? ' · ' + money(l.price) : (l.ing.free ? ' · 🏡 0 €' : ' · prix non saisi')))
            ]),
            h('div.row-end', null, h('button.delete-x', { onClick: (e) => { e.stopPropagation(); basket.splice(idx, 1); mainStep(); } }, '✕'))
          ])))
        : h('p.muted.small', { style: 'margin:4px' }, 'Ajoute tes articles un par un : article, poids, prix — le total se calcule tout seul.');

      const body = h('div', null, [
        h('div.field', null, [h('label', null, 'Date'), h('input.input', { type: 'date', value: dateVal, max: Store.todayISO(), onChange: (e) => dateVal = e.target.value })]),
        h('div.field', null, [h('label', null, 'Articles achetés'), listEl]),
        h('button.btn.subtle.block', { onClick: pickStep }, '+ Ajouter un article'),
        total ? h('div.inline', { style: 'justify-content:space-between;margin-top:12px;padding:0 4px' }, [
          h('span.muted', null, 'Total'), h('strong', { style: 'font-size:18px;color:var(--green-700)' }, money(total))
        ]) : null,
        h('div.modal-actions', null, [
          h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
          h('button.btn', { style: 'flex:2', onClick: () => {
            if (!basket.length) { UI.toast('Ajoute au moins un article'); return; }
            const items = basket.map((l) => ({ ingredientId: l.ing.id, qty: l.qty, cut: l.cut || '', price: l.price || 0 }));
            Store.addPurchase({ date: dateVal, items, cost: total });
            // mémorise les prix au kilo saisis pour affiner le budget « À acheter »
            basket.forEach((l) => { if (l.ppk > 0 && l.ppk !== l.ing.price) Store.updateIngredient(l.ing.id, { price: l.ppk }); });
            UI.closeModal(); UI.toast('Ajouté au stock ✓');
          } }, basket.length ? 'Ajouter au stock (' + basket.length + ')' : 'Ajouter au stock')
        ])
      ]);
      UI.modal({ title: '🛒 J’ai fait des courses', body });
    }

    /* --- Étape 2 : choisir un article (onglets par catégorie) --- */
    function pickStep() {
      const cats = ['viande', 'abats', 'os', 'entier', 'oeuf', 'legume', 'autre'];
      const all = Store.get().ingredients.filter((i) => cats.includes(i.category));
      const present = CAT_ORDER.filter((cat) => all.some((i) => i.category === cat));
      const list = h('div');
      const tabs = {};
      const show = (cat) => {
        pickCat = cat;
        present.forEach((c) => tabs[c].classList.toggle('on', c === cat));
        UI.clear(list);
        list.appendChild(h('div.card.flush', null, all.filter((i) => i.category === cat).map((ing) =>
          h('div.row', { onClick: () => formStep(ing, null) }, [
            h('div.row-ic', null, catIcon(ing.category)),
            h('div.row-main', null, [h('strong', null, ing.name),
              h('small', null, priceLabel(ing))]),
            // ✎ : corriger le nom (ou le prix) sans quitter la saisie de l'achat
            h('div.row-end', null, h('button.btn.ghost.icon', {
              title: 'Renommer / modifier',
              onClick: (e) => { e.stopPropagation(); Views.openIngredientEditor(ing, { onDone: () => pickStep() }); }
            }, '✎'))
          ]))));
        // Un article acheté pour la première fois se crée ici, puis on enchaîne sur sa saisie
        list.appendChild(h('button.btn.subtle.block', { style: 'margin-top:10px', onClick: () => {
          Views.openIngredientEditor(null, {
            preset: { category: cat },
            onDone: (created) => (created ? formStep(created, null) : pickStep())
          });
        } }, '+ Nouvel article'));
      };
      const tabBar = h('div.chip-row', { style: 'margin-bottom:10px' }, present.map((cat) => {
        const b = h('button.chip', { onClick: () => show(cat) }, CAT_LABEL[cat]);
        tabs[cat] = b; return b;
      }));
      show(pickCat && present.includes(pickCat) ? pickCat : present[0]);
      const body = h('div', null, [tabBar, list,
        h('div.modal-actions', null, [h('button.btn.subtle', { onClick: mainStep }, '← Retour au panier')])]);
      UI.modal({ title: 'Quel article ?', body });
    }

    /* --- Étape 3 : quantité + prix (au kilo OU total) + morceau --- */
    function formStep(ing, line) {
      const piece = ing.unit === 'piece';
      const editing = !!line;
      const d = {
        qty: editing ? (piece ? line.qty : +(line.qty / 1000).toFixed(2)) : (piece ? 1 : ''),
        ppk: editing ? (line.ppk || '') : (ing.price || ''),
        total: editing ? (line.price || '') : '',
        cut: editing ? (line.cut || '') : ''
      };
      const round2 = (n) => +n.toFixed(2);
      const totalFromPpk = () => round2(piece ? (+d.ppk * +d.qty) : (+d.ppk * +d.qty));
      const ppkFromTotal = () => round2(+d.total / +d.qty);

      const qtyIn = h('input.input', { type: 'number', min: '0', step: piece ? '1' : '0.1', value: d.qty, placeholder: '0', onInput: (e) => { d.qty = e.target.value; sync('qty'); } });
      const ppkIn = h('input.input', { type: 'number', min: '0', step: '0.01', value: d.ppk, placeholder: '0', onInput: (e) => { d.ppk = e.target.value; sync('ppk'); } });
      const totalIn = h('input.input', { type: 'number', min: '0', step: '0.01', value: d.total, placeholder: '0', onInput: (e) => { d.total = e.target.value; sync('total'); } });
      const echo = h('p.muted.small', { style: 'margin:8px 4px 0' });

      function sync(changed) {
        // le prix au kilo et le prix total se calculent l'un l'autre grâce au poids
        if (+d.qty > 0) {
          if (changed === 'total' && +d.total > 0) { d.ppk = ppkFromTotal(); ppkIn.value = d.ppk; }
          else if (+d.ppk > 0) { d.total = totalFromPpk(); totalIn.value = d.total; }
        }
        echo.textContent = (+d.qty > 0 && !piece ? '= ' + Math.round(+d.qty * 1000) + ' g' : '') +
          (+d.total > 0 && +d.qty > 0 ? (piece ? '' : '  ·  ') + money(+d.total) + ' au total' : '');
      }
      sync('init');

      const cuttable = ['viande', 'abats'].includes(ing.category);
      const body = h('div', null, [
        h('datalist', { id: 'hatchi-cuts' }, Store.cuts().map((c) => h('option', { value: c }))),
        h('div.field', null, [h('label', null, piece ? 'Nombre (pièces)' : 'Poids acheté (kg)'), qtyIn]),
        ing.free
          ? h('p.muted.small', { style: 'margin:0 4px 10px' }, '🏡 Produit maison — coût 0 €, rien à saisir.')
          : h('div.grid2', null, [
              h('div.field', null, [h('label', null, piece ? 'Prix à la pièce (€)' : 'Prix au kilo (€/kg)'), ppkIn]),
              h('div.field', null, [h('label', null, 'Prix total payé (€)'), totalIn])
            ]),
        cuttable ? h('div.field', null, [h('label', null, 'Morceau (facultatif)'),
          h('input.input', { placeholder: 'ex. cuisse, bavette, foie…', list: 'hatchi-cuts', value: d.cut, onInput: (e) => d.cut = e.target.value.trim() })]) : null,
        echo,
        h('div.modal-actions', null, [
          h('button.btn.subtle', { onClick: () => (editing ? mainStep() : pickStep()) }, '← Retour'),
          h('button.btn', { style: 'flex:2', onClick: () => {
            const q = +d.qty;
            if (!(q > 0)) { UI.toast(piece ? 'Indique le nombre' : 'Indique le poids en kg'); return; }
            const data = { ing, qty: piece ? Math.round(q) : Math.round(q * 1000), cut: d.cut || '', ppk: +d.ppk || 0, price: +d.total || 0 };
            if (editing) Object.assign(line, data); else basket.push(data);
            mainStep();
          } }, editing ? 'Enregistrer' : '✓ Ajouter au panier')
        ])
      ]);
      UI.modal({ title: catIcon(ing.category) + ' ' + ing.name, body });
    }

    mainStep();
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
