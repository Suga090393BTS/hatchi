/* ============================================================
   Vue Repas — donnés (réel) + rotation (prévision) + quantités types
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, grams } = UI;
  const { DAYS_SHORT } = UI;

  let tab = 'donnes'; // 'donnes' | 'rotation' | 'quantites'
  let typesSlot = 'matin'; // créneau actif dans Quantités : 'matin' | 'soir'

  const { CAT_LABEL, CAT_ORDER, CAT_IC } = UI; // catégories : source unique dans ui.js
  let ingCat = 'tout';  // onglet de catégorie du catalogue (onglet Repas › Ingrédients)
  let listCat = 'tout'; // onglet de catégorie de la liste modale « Articles & prix »

  // Résumé d'une liste d'aliments : « Poulet 300 g · Œuf ×1 »
  function itemsSummary(items) {
    return (items || []).map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      if (!ing) return '';
      return `${ing.name} ${ing.unit === 'piece' ? '×' + it.qty : grams(it.qty)}`;
    }).filter(Boolean).join(' · ');
  }
  const stockLabel = (i) => {
    const st = Store.stockOf(i.id);
    if (!(st > 0)) return 'épuisé';
    return (i.unit === 'piece' ? '×' + st : UI.grams(st)) + ' en stock';
  };

  // Éditeur d'ingrédients partagé.
  // stockOnly=true (repas DONNÉS) : seul ce qui est en stock est proposé, alerte si dépassement.
  // stockOnly=false (repas-TYPES, prévision) : tout le catalogue, le stock est juste indiqué.
  function itemsEditor(draft, opts) {
    const stockOnly = !!(opts && opts.stockOnly);
    const itemsBox = h('div');
    function renderItems() {
      UI.clear(itemsBox);
      if (!draft.items.length) itemsBox.appendChild(h('div.muted.small', { style: 'padding:6px 2px' },
        stockOnly ? 'Aucun ingrédient. Composez avec les boutons ci-dessous (seul ce qui est en stock est proposé).'
                  : 'Aucun ingrédient. Composez avec les boutons ci-dessous.'));
      draft.items.forEach((it, idx) => {
        const ing = Store.ingredient(it.ingredientId);
        const groups = CAT_ORDER.map((cat) => {
          const list = Store.get().ingredients.filter((i) => i.category === cat && (!stockOnly || Store.stockOf(i.id) > 0 || i.id === it.ingredientId));
          return list.length ? h('optgroup', { label: CAT_LABEL[cat] }, list.map((i) =>
            h('option', { value: i.id, selected: i.id === it.ingredientId }, i.name + ' — ' + stockLabel(i)))) : null;
        }).filter(Boolean);
        const over = stockOnly && ing && ing.unit !== 'piece' && it.qty > Store.stockOf(ing.id);
        itemsBox.appendChild(h('div.inline', { style: 'margin-bottom:8px' }, [
          h('select.input', { style: 'flex:2', onChange: (e) => { it.ingredientId = e.target.value; renderItems(); } }, groups),
          h('input.input', { style: 'flex:1' + (over ? ';border-color:var(--red)' : ''), type: 'number', min: '0', value: it.qty, onInput: (e) => { it.qty = +e.target.value || 0; } }),
          h('span.muted.small', { style: 'width:34px' }, ing && ing.unit === 'piece' ? 'u.' : 'g'),
          h('button.delete-x', { onClick: () => { draft.items.splice(idx, 1); renderItems(); } }, '✕')
        ]));
        if (over) itemsBox.appendChild(h('div.muted.small', { style: 'color:var(--red);margin:-4px 2px 8px' }, '⚠️ Plus que ' + stockLabel(ing) + ' de ' + ing.name));
      });
    }
    renderItems();
    const addBtn = (cat, defQty) => h('button.btn.ghost.sm', { onClick: () => {
      const pool = Store.get().ingredients.filter((i) => i.category === cat && (!stockOnly || Store.stockOf(i.id) > 0));
      if (!pool.length) { UI.toast(stockOnly ? 'Rien en stock dans « ' + CAT_LABEL[cat] + ' » — fais des courses d\'abord' : 'Aucun ingrédient dans « ' + CAT_LABEL[cat] + ' »'); return; }
      const first = pool[0];
      const qty = first.unit === 'piece' ? 1 : (stockOnly ? Math.min(defQty, Store.stockOf(first.id)) : defQty);
      draft.items.push({ ingredientId: first.id, qty });
      renderItems();
    } }, '+ ' + CAT_LABEL[cat]);
    // le matin, Hatchi mange moins : viande à 300 g par défaut (400 g le soir)
    const meatDef = draft.slot === 'soir' ? 400 : 300;
    return h('div', null, [
      itemsBox,
      h('div.inline', { style: 'flex-wrap:wrap;gap:6px' }, [
        addBtn('viande', meatDef), addBtn('legume', 100), addBtn('abats', 200),
        addBtn('oeuf', 1), addBtn('os', 1), addBtn('autre', 100)
      ])
    ]);
  }

  /* ---------- Quantités types (doses par aliment, sans nom de repas) ---------- */
  function openDoseEditor(slot) {
    let ingId = '', qty = '';
    const qtyInput = h('input.input', { type: 'number', min: '0', placeholder: 'Ex. 300', value: '', onInput: (e) => qty = e.target.value });
    const groups = CAT_ORDER.map((cat) => {
      const list = Store.get().ingredients.filter((i) => i.category === cat);
      return list.length ? h('optgroup', { label: CAT_LABEL[cat] }, list.map((i) => h('option', { value: i.id }, i.name))) : null;
    }).filter(Boolean);
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Aliment'),
        h('select.input', { onChange: (e) => { ingId = e.target.value; if (ingId && qty === '') { qty = Store.doseFor(ingId, slot); qtyInput.value = qty; } } },
          [h('option', { value: '', selected: true, disabled: true }, 'Choisir un aliment…')].concat(groups))]),
      h('div.field', null, [h('label', null, 'Dose type du ' + slot + ' (g, ou pièces pour œuf/os)'), qtyInput]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => {
          if (!ingId) { UI.toast('Choisis un aliment'); return; }
          if (!(+qty > 0)) { UI.toast('Indique une dose'); return; }
          Store.setDose(ingId, slot, +qty);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: 'Dose type du ' + slot, body });
  }

  // La ration conseillée pilote les quantités : elle vit donc ici, et non sur l'onglet Chien.
  function rationCard() {
    const s = Store.get().settings;
    const sug = Store.suggestedRationPct();
    const cur = s.rationPct || 2.5;
    return h('div.card', null, [
      h('div.field', { style: 'margin-bottom:0' }, [h('label', null, 'Ration conseillée (% du poids / jour)'),
        h('input.input', { type: 'number', step: '0.1', min: '1', max: '8', value: cur,
          onChange: (e) => Store.updateSettings({ rationPct: +e.target.value || 2.5 }) })]),
      h('div.inline', { style: 'justify-content:space-between;margin-top:8px;gap:8px' }, [
        h('p.muted.small', { style: 'margin:0;flex:1' }, '💡 Suggestion pour un ' + Store.sizeLabel(s.dogSize).toLowerCase() + (sug > 3 ? ' encore chiot' : '') + ' : ~' + sug + ' % (à valider avec le véto).'),
        sug !== cur ? h('button.btn.ghost.sm', { onClick: () => { Store.updateSettings({ rationPct: sug }); UI.toast('Ration réglée sur ' + sug + ' %'); } }, 'Appliquer') : null
      ])
    ]);
  }

  function quantitesView(root) {
    root.appendChild(rationCard());
    root.appendChild(h('div.seg', { style: 'margin-bottom:12px' }, [['matin', '🌅 Matin'], ['soir', '🌙 Soir']].map(([v, l]) =>
      h('button', { class: typesSlot === v ? 'on' : '', onClick: () => { typesSlot = v; App.rerender(); } }, l))));
    root.appendChild(h('p.muted.small', { style: 'margin:0 4px 10px' },
      'Tes doses par aliment pour le ' + typesSlot + ' (prévision — le stock n\'est pas touché). Elles pré-remplissent la rotation et « J\'ai donné ».'));

    const doses = Store.doses();
    const rows = [];
    CAT_ORDER.forEach((cat) => {
      Store.get().ingredients.forEach((ing) => {
        if (ing.category !== cat) return;
        const d = doses[ing.id];
        if (!d || d[typesSlot] == null || d[typesSlot] === '') return;
        rows.push(h('div.row', null, [
          h('div.row-ic', null, CAT_IC[ing.category] || '📦'),
          h('div.row-main', null, h('strong', null, ing.name)),
          h('div.row-end', null, h('div.inline', { style: 'gap:6px' }, [
            h('input.input', { style: 'width:80px;text-align:right', type: 'number', min: '0', value: d[typesSlot],
              onChange: (e) => { const v = +e.target.value; if (v > 0) Store.setDose(ing.id, typesSlot, v); } }),
            h('span.muted.small', { style: 'width:18px' }, ing.unit === 'piece' ? 'u.' : 'g'),
            h('button.delete-x', { onClick: async () => {
              if (await UI.confirm('Retirer ' + ing.name + ' des doses du ' + typesSlot + ' ?', { danger: true, ok: 'Retirer' })) Store.removeDose(ing.id, typesSlot);
            } }, '✕')
          ]))
        ]));
      });
    });
    if (!rows.length) {
      root.appendChild(h('div.card', null, UI.emptyState('⚖️', 'Aucune dose type du ' + typesSlot,
        'Ex. « le matin, mon poulet c\'est 300 g, mon lapin 250 g ». Ajoute tes aliments un par un.')));
    } else {
      root.appendChild(h('div.card.flush', null, rows));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openDoseEditor(typesSlot) }, '+ Ajouter un aliment (dose du ' + typesSlot + ')'));
  }

  /* ---------- Repas réellement donnés ---------- */
  function showBilan() {
    const dog = Store.get().settings.dogName || 'Hatchi';
    const a = Store.fedAnalysis(7);
    const today = Store.fedGramsForDay(Store.todayISO());
    const body = h('div', null, [
      h('div.inline', { style: 'justify-content:space-between;margin-bottom:10px' }, [
        h('div', null, [h('div.muted.small', null, 'Donné aujourd\'hui'),
          h('div', { style: 'font-size:22px;font-weight:800;color:var(--green-700)' }, UI.grams(today) + (a.reco ? ' / ~' + UI.grams(a.reco) : ''))]),
        h('div', { style: 'text-align:right' }, [h('div.muted.small', null, '7 derniers jours'), h('strong', null, a.avgPerDay ? '~' + a.avgPerDay + ' g/j' : '—')])
      ]),
      h('div', null, a.advice.map((t) => h('p', { style: 'margin:6px 2px;font-size:14px;line-height:1.45' }, t))),
      h('div.modal-actions', null, h('button.btn', { style: 'flex:1', onClick: () => UI.closeModal() }, 'OK'))
    ]);
    UI.modal({ title: '✨ Bilan de ' + dog, body });
  }

  // Éditeur « ce que j'ai vraiment donné » (peut différer de la rotation)
  function openFedEditor(existing, opts) {
    opts = opts || {};
    let draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : { date: opts.date || Store.todayISO(), slot: opts.slot || 'matin', items: JSON.parse(JSON.stringify(opts.presetItems || [])) };
    const slotSeg = h('div.seg', null, [['matin', '🌅 Matin'], ['soir', '🌙 Soir']].map(([v, l]) =>
      h('button', { class: draft.slot === v ? 'on' : '', onClick: (e) => {
        draft.slot = v;
        [...slotSeg.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      } }, l)));
    // Repas du jour : on se limite à ce qui est en stock (on ne peut pas donner ce qu'on n'a pas).
    // Repas passé rattrapé après coup : tout le catalogue, car ce qui a été mangé ce jour-là
    // n'est justement plus en stock aujourd'hui.
    const isToday = () => draft.date === Store.todayISO();
    const itemsBoxHost = h('div');
    const itemsLabel = h('label');
    const rebuildItems = () => {
      itemsLabel.textContent = isToday() ? 'Ce que j\'ai donné (selon le stock)' : 'Ce qui a été donné ce jour-là';
      UI.clear(itemsBoxHost);
      itemsBoxHost.appendChild(itemsEditor(draft, { stockOnly: isToday() }));
    };
    rebuildItems();
    const body = h('div', null, [
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Date'), h('input.input', { type: 'date', value: draft.date, max: Store.todayISO(), onChange: (e) => { draft.date = e.target.value; rebuildItems(); } })]),
        h('div.field', null, [h('label', null, 'Repas du…'), slotSeg])
      ]),
      h('div.field', null, [itemsLabel, itemsBoxHost]),
      h('button.btn.subtle.block', { style: 'margin-bottom:10px', onClick: () => {
        const sug = Store.suggestMealFromStock(draft.slot);
        if (sug.error) { UI.toast(sug.error); return; }
        draft.items = sug.items;
        rebuildItems();
      } }, '✨ Suggérer selon le stock'),
      h('div.modal-actions', null, [
        existing ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer ce repas ? (le stock est réintégré)', { danger: true, ok: 'Supprimer' })) { Store.removeFed(existing.id); UI.closeModal(); }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!draft.items.filter((it) => it.ingredientId && it.qty > 0).length) { UI.toast('Ajoute au moins un ingrédient'); return; }
          if (existing) Store.removeFed(existing.id); // édition = on remplace (stock réajusté)
          Store.logFed(draft);
          UI.closeModal();
          setTimeout(showBilan, 150);
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: existing ? 'Modifier le repas donné' : '🍽 Repas donné', body });
  }
  Views.openFedEditor = openFedEditor; // utilisé par l'écran Aujourd'hui

  // Graphique : grammes donnés par jour (14 j) + ligne de la ration conseillée
  function fedChart(a) {
    const W = 320, H = 150, pad = { l: 34, r: 8, t: 14, b: 20 };
    const days = a.dates;
    const vals = days.map((d) => a.gramsByDay[d] || 0);
    const top = Math.max(a.reco || 0, Math.max.apply(null, vals), 100) * 1.15;
    const bw = (W - pad.l - pad.r) / days.length;
    const py = (v) => pad.t + (1 - v / top) * (H - pad.t - pad.b);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const el = (n, attrs, txt) => { const x = document.createElementNS(NS, n); for (const k in attrs) x.setAttribute(k, attrs[k]); if (txt != null) x.textContent = txt; return x; };
    // couleurs du thème actif
    const css = getComputedStyle(document.documentElement);
    const V = (n, fb) => (css.getPropertyValue(n).trim() || fb);
    const cMain = V('--green', '#1f6f5c'), cAmber = V('--amber', '#c98a2b'), cRed = V('--red', '#a33b2e'), cSoft = V('--ink-soft', '#5d6b66');
    vals.forEach((v, i) => {
      if (!v) return;
      const x = pad.l + i * bw + bw * 0.15;
      const ok = !a.reco || (v >= a.reco * 0.8 && v <= a.reco * 1.25);
      svg.appendChild(el('rect', { x, y: py(v), width: bw * 0.7, height: (H - pad.b) - py(v), rx: 3, fill: ok ? cMain : cAmber }));
    });
    if (a.reco) {
      svg.appendChild(el('line', { x1: pad.l, y1: py(a.reco), x2: W - pad.r, y2: py(a.reco), stroke: cRed, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
      svg.appendChild(el('text', { x: 2, y: py(a.reco) + 4, 'font-size': 9, fill: cRed }, a.reco + ' g'));
    }
    days.forEach((d, i) => {
      if (i % 2) return;
      svg.appendChild(el('text', { x: pad.l + i * bw + bw / 2, y: H - 6, 'font-size': 8.5, fill: cSoft, 'text-anchor': 'middle' }, +d.slice(8)));
    });
    return h('div.chart-wrap', null, svg);
  }

  function fedSummary(e) {
    return e.items.map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      return ing ? ing.name + ' ' + (ing.unit === 'piece' ? '×' + it.qty : grams(it.qty)) : null;
    }).filter(Boolean).join(' · ');
  }

  function donnesView(root) {
    const a = Store.fedAnalysis(7);
    // Bilan « agent »
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, '✨ Bilan (7 derniers jours)'), h('span.muted.small', null, a.nDays + ' jour' + (a.nDays > 1 ? 's' : '') + ' noté' + (a.nDays > 1 ? 's' : ''))]),
      (a.muscle + a.abats) > 0 ? h('div', { style: 'display:flex;height:12px;border-radius:99px;overflow:hidden;margin-bottom:8px' }, [
        h('div', { style: `width:${100 - a.abatsPct}%;background:var(--green)` }),
        h('div', { style: `width:${a.abatsPct}%;background:var(--amber)` })
      ]) : null,
      (a.muscle + a.abats) > 0 ? h('div.inline', { style: 'gap:12px;flex-wrap:wrap;font-size:12.5px;margin-bottom:6px' }, [
        h('span', null, '🥩 ' + UI.grams(a.muscle)), h('span', null, '🫀 ' + a.abatsPct + ' %'),
        h('span', null, '🦴 ' + a.osPieces + ' os'), h('span', null, '🥚 ' + a.oeufs),
        h('span', null, '🥕 ' + UI.grams(a.legume)),
        a.proteins.length ? h('span.muted', null, a.proteins.join(', ')) : null
      ]) : null,
      h('div', null, a.advice.map((t) => h('p.small', { style: 'margin:5px 2px;line-height:1.4' }, t)))
    ]));

    // Graphique sur 14 jours
    const a14 = Store.fedAnalysis(14);
    if (a14.grams > 0) {
      root.appendChild(h('div.card', null, [
        h('div.card-head', null, [h('h3', null, 'Quantités par jour'), h('span.muted.small', null, '14 jours')]),
        fedChart(a14)
      ]));
    }

    root.appendChild(h('button.btn.block', { style: 'margin:8px 0', onClick: () => openFedEditor(null, {}) }, '+ Noter un repas donné'));

    // Historique groupé par jour
    const entries = Store.fedSorted();
    if (!entries.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🍽', 'Aucun repas noté', 'Sur « Aujourd\'hui », appuie sur « 🍽 J\'ai donné… » pour noter ce que Hatchi mange vraiment.')));
      return;
    }
    let curDate = null;
    let card = null;
    entries.forEach((e) => {
      if (e.date !== curDate) {
        curDate = e.date;
        root.appendChild(h('div.section-title', null, UI.fmtLong(e.date) + ' — ' + UI.grams(Store.fedGramsForDay(e.date))));
        card = h('div.card.flush');
        root.appendChild(card);
      }
      card.appendChild(h('div.row', { onClick: () => openFedEditor(e) }, [
        h('div.row-ic', null, e.slot === 'soir' ? '🌙' : '🌅'),
        h('div.row-main', null, [h('strong', null, e.slot === 'soir' ? 'Soir' : 'Matin'), h('small', null, fedSummary(e))]),
        h('div.row-end', null, h('span.muted', null, '›'))
      ]));
    });
  }

  /* ---------- Rotation ---------- */
  let editWeek = 1;

  function slotPicker(week, dayIdx, slot, label) {
    const items = Store.getRotation(week, dayIdx, slot);
    const summary = itemsSummary(items);
    return h('div', {
      style: 'flex:1;cursor:pointer', onClick: () => openSlotPicker(week, dayIdx, slot, label)
    }, [
      h('div.muted.small', { style: 'font-weight:700' }, label),
      summary
        ? h('div.small', null, summary)
        : h('div.muted.small', { style: 'opacity:.6' }, '+ composer')
    ]);
  }

  // Composition d'un créneau de rotation : aliment par aliment, doses types pré-remplies
  function openSlotPicker(week, dayIdx, slot, label) {
    const sel = new Map(Store.getRotation(week, dayIdx, slot).map((it) => [it.ingredientId, it.qty]));
    const hasDose = (ing) => { const d = Store.doses()[ing.id]; return d && d[slot] != null && d[slot] !== ''; };
    // sa petite liste (doses types du créneau) d'abord, puis le reste du catalogue
    const ings = [];
    CAT_ORDER.forEach((cat) => Store.get().ingredients.forEach((i) => { if (i.category === cat && hasDose(i)) ings.push(i); }));
    CAT_ORDER.forEach((cat) => Store.get().ingredients.forEach((i) => { if (i.category === cat && !hasDose(i)) ings.push(i); }));

    const list = h('div');
    function render() {
      UI.clear(list);
      let sepDone = false;
      ings.forEach((ing, i) => {
        if (!sepDone && !hasDose(ing) && ings.some(hasDose)) { sepDone = true; list.appendChild(h('div.muted.small', { style: 'margin:8px 2px 6px;font-weight:700' }, 'Autres aliments')); }
        const on = sel.has(ing.id);
        list.appendChild(h('div.inline', { style: 'margin-bottom:6px' }, [
          h('button', {
            class: 'chip' + (on ? ' on' : ''), style: 'flex:1;justify-content:flex-start',
            onClick: () => { if (on) sel.delete(ing.id); else sel.set(ing.id, Store.doseFor(ing.id, slot)); render(); }
          }, [h('span', null, (CAT_IC[ing.category] || '📦') + ' ' + ing.name)]),
          on ? h('input.input', { style: 'width:80px;text-align:right', type: 'number', min: '0', value: sel.get(ing.id), onInput: (e) => sel.set(ing.id, +e.target.value || 0) }) : null,
          on ? h('span.muted.small', { style: 'width:18px' }, ing.unit === 'piece' ? 'u.' : 'g') : null
        ]));
      });
    }
    render();

    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 10px' }, `${UI.DAYS[dayIdx]} · ${label} · Semaine ${week} — coche tes aliments, les doses types se pré-remplissent.`),
      h('div', { style: 'max-height:48vh;overflow-y:auto' }, list),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => {
          Store.setRotation(week, dayIdx, slot, [...sel].map(([ingredientId, qty]) => ({ ingredientId, qty })));
          UI.closeModal();
        } }, 'Valider')
      ])
    ]);
    UI.modal({ title: 'Repas du ' + UI.DAYS[dayIdx].toLowerCase(), body });
  }

  function rotationView(root) {
    const cycleWeeks = Store.get().settings.cycleWeeks || 1;

    // Le cycle et sa date de départ pilotent la rotation : ils vivent ici, avec elle.
    // (Avant : cycleWeeks était éditable ici ET sur l'onglet Chien, la date de départ
    //  seulement sur Chien, et ce texte renvoyait à tort vers Réglages.)
    const s = Store.get().settings;
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, 'Cycle de rotation'),
        h('span.muted.small', null, cycleWeeks === 1 ? '1 semaine (identique)' : cycleWeeks + ' semaines')]),
      h('div.seg', null, [1, 2, 3, 4].map((n) =>
        h('button', { class: n === cycleWeeks ? 'on' : '', onClick: () => { Store.updateSettings({ cycleWeeks: n }); if (editWeek > n) editWeek = 1; } }, n + ' sem.')
      )),
      h('div.field', { style: 'margin:12px 0 0' }, [h('label', null, 'Lundi de départ du cycle'),
        h('input.input', { type: 'date', value: s.anchorMonday || '',
          onChange: (e) => Store.updateSettings({ anchorMonday: Store.mondayOf(e.target.value) }) })]),
      h('p.muted.small', { style: 'margin:0 4px' }, 'L’app détermine le repas du jour à partir de ce cycle et de cette date de départ.')
    ]));

    if (cycleWeeks > 1) {
      root.appendChild(h('div.seg', { style: 'margin:0 0 12px' },
        Array.from({ length: cycleWeeks }, (_, i) => i + 1).map((w) =>
          h('button', { class: w === editWeek ? 'on' : '', onClick: () => { editWeek = w; App.rerender(); } }, 'Sem. ' + w)
        )));
    }

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      root.appendChild(h('div.card', { style: 'padding:12px 16px' }, [
        h('div', { style: 'font-weight:800;margin-bottom:8px' }, UI.DAYS[dayIdx]),
        h('div.inline', { style: 'gap:14px;align-items:flex-start' }, [
          slotPicker(editWeek, dayIdx, 'matin', '🌅 Matin'),
          h('div', { style: 'width:1px;align-self:stretch;background:var(--line)' }),
          slotPicker(editWeek, dayIdx, 'soir', '🌙 Soir')
        ])
      ]));
    }

    // Compte-rendu : analyse du plan de la semaine affichée
    const ra = Store.rotationAnalysis(editWeek);
    const viande = ra.muscle + ra.abats;
    root.appendChild(h('div.section-title', null, '🔎 Analyse du plan' + (cycleWeeks > 1 ? ' — semaine ' + editWeek : '')));
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, 'Compte-rendu'), h('span.muted.small', null, ra.daysPlanned + ' jour' + (ra.daysPlanned > 1 ? 's' : '') + ' planifié' + (ra.daysPlanned > 1 ? 's' : ''))]),
      viande > 0 ? h('div', { style: 'display:flex;height:12px;border-radius:99px;overflow:hidden;margin-bottom:8px' }, [
        h('div', { style: `width:${100 - ra.abatsPct}%;background:var(--green)`, title: 'Muscle' }),
        h('div', { style: `width:${ra.abatsPct}%;background:var(--amber)`, title: 'Abats' })
      ]) : null,
      viande > 0 ? h('div.inline', { style: 'gap:12px;flex-wrap:wrap;font-size:12.5px;margin-bottom:6px' }, [
        h('span', null, '🥩 ' + UI.grams(ra.muscle)), h('span', null, '🫀 ' + ra.abatsPct + ' %'),
        h('span', null, '🦴 ' + ra.osPieces + ' os'), h('span', null, '🥚 ' + ra.oeufs),
        h('span', null, '🥕 ' + UI.grams(ra.legume)),
        ra.proteins.length ? h('span.muted', null, ra.proteins.join(', ')) : null
      ]) : null,
      h('div', null, ra.advice.map((t) => h('p.small', { style: 'margin:5px 2px;line-height:1.4' }, t)))
    ]));
  }

  /* ---------- Ingrédients & prix (le catalogue vit avec les repas, pas dans Réglages) ---------- */
  const CATS_EDIT = [['viande', '🥩 Viande'], ['abats', '🫀 Abats'], ['os', '🦴 Os'], ['entier', '🐔 Animal entier'], ['oeuf', '🥚 Œuf'], ['legume', '🥕 Légume'], ['autre', '📦 Autre']];

  // opts.onDone(ingredient|null) : appelé après enregistrement/annulation/suppression.
  // Permet d'appeler l'éditeur depuis un autre écran modal (ex. la saisie d'un achat)
  // et d'y revenir ensuite sans perdre ce qui y était en cours.
  function openIngredientEditor(ing, opts) {
    const done = (result) => { UI.closeModal(); if (opts && opts.onDone) setTimeout(() => opts.onDone(result || null), 50); };
    const isNew = !ing;
    const d = ing ? JSON.parse(JSON.stringify(ing))
                  : Object.assign({ name: '', category: 'viande', unit: 'g', price: 0 }, (opts && opts.preset) || {});
    const priceInput = h('input.input', { type: 'number', step: '0.01', min: '0', value: d.price, disabled: !!d.free, onInput: (e) => d.price = +e.target.value || 0 });
    const priceLabel = h('label', null, d.unit === 'piece' ? 'Prix à l’unité (€)' : 'Prix au kilo (€/kg)');
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Nom'), h('input.input', { value: d.name, onInput: (e) => d.name = e.target.value })]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Catégorie'),
          h('select.input', { onChange: (e) => d.category = e.target.value }, CATS_EDIT.map(([v, l]) => h('option', { value: v, selected: v === d.category }, l)))]),
        h('div.field', null, [h('label', null, 'Unité'),
          h('select.input', { onChange: (e) => { d.unit = e.target.value; priceLabel.textContent = d.unit === 'piece' ? 'Prix à l’unité (€)' : 'Prix au kilo (€/kg)'; } },
            [['g', 'grammes'], ['piece', 'pièce']].map(([v, l]) => h('option', { value: v, selected: v === d.unit }, l)))])
      ]),
      h('div.field', null, [priceLabel, priceInput]),
      h('div.field', null, h('label.inline', { style: 'gap:8px;cursor:pointer;font-size:14px;font-weight:600;letter-spacing:0' }, [
        h('input', { type: 'checkbox', checked: !!d.free, onChange: (e) => {
          d.free = e.target.checked;
          if (d.free) { d.price = 0; priceInput.value = 0; }
          priceInput.disabled = d.free;
        } }),
        '🏡 Coût zéro € — je le produis moi-même'
      ])),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => { if (await UI.confirm('Supprimer cet ingrédient ?', { danger: true, ok: 'Supprimer' })) { Store.removeIngredient(ing.id); done(null); } } }, '🗑')
               : h('button.btn.subtle', { onClick: () => done(null) }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.name.trim()) { UI.toast('Nom requis'); return; }
          if (isNew) { const created = Store.addIngredient(d); done(created); }
          else { Store.updateIngredient(ing.id, d); done(Store.ingredient(ing.id)); }
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouvel ingrédient' : 'Modifier l’ingrédient', body });
  }
  Views.openIngredientEditor = openIngredientEditor;

  // Tri commun aux listes d'articles : par catégorie, puis par nom
  const byCatThenName = (a, b) =>
    (CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category)) || a.name.localeCompare(b.name, 'fr');

  const ingRow = (ing, onPick) => h('div.row', { onClick: () => onPick(ing) }, [
    h('div.row-ic', null, UI.catIcon(ing.category)),
    h('div.row-main', null, [
      h('strong', null, ing.name),
      h('small', null, ing.free ? '🏡 Produit maison · 0 €' : (ing.price ? UI.money(ing.price) + (ing.unit === 'piece' ? '/u.' : '/kg') : 'Prix non défini'))
    ]),
    h('div.row-end', null, h('span.muted', null, '›'))
  ]);

  // Liste modale du catalogue : même éditeur que l'onglet Ingrédients, mais appelable
  // depuis un autre écran (Courses › Achats) sans avoir à le quitter.
  function openIngredientsList() {
    const back = () => openIngredientsList();
    const tabsBox = h('div');
    const listBox = h('div');

    // Rendu en place : changer d'onglet ne rouvre pas la fenêtre
    function renderList() {
      const ings = Store.get().ingredients;
      const present = CAT_ORDER.filter((c) => ings.some((i) => i.category === c));
      if (listCat !== 'tout' && present.indexOf(listCat) === -1) listCat = 'tout';

      UI.clear(tabsBox);
      const tabs = UI.catTabs(present, listCat, (c) => { listCat = c; renderList(); });
      if (tabs) tabsBox.appendChild(tabs);

      const shown = ings
        .filter((i) => listCat === 'tout' || i.category === listCat)
        .slice().sort(byCatThenName);
      UI.clear(listBox);
      listBox.appendChild(h('div.card.flush', { style: 'max-height:46vh;overflow-y:auto' },
        shown.map((ing) => ingRow(ing, (i) => openIngredientEditor(i, { onDone: back })))));
    }
    renderList();

    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Touche un article pour le renommer, ou changer sa catégorie et son prix.'),
      tabsBox,
      listBox,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => openIngredientEditor(null, { preset: { category: listCat === 'tout' ? 'viande' : listCat }, onDone: back }) }, '+ Nouvel article'),
      h('div.modal-actions', null, [h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Fermer')])
    ]);
    UI.modal({ title: 'Articles & prix', body });
  }
  Views.openIngredientsList = openIngredientsList;

  function ingredientsView(root) {
    root.appendChild(h('p.muted.small', { style: 'margin:0 4px 10px' },
      'Ton catalogue d’aliments et leurs prix. Il alimente la composition des repas, le stock et le budget des courses.'));
    const ings = Store.get().ingredients;
    if (!ings.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🥩', 'Aucun ingrédient', 'Ajoute les aliments que tu donnes pour composer tes repas.')));
    } else {
      // Onglets de catégorie plutôt qu'une longue liste à dérouler
      const present = CAT_ORDER.filter((c) => ings.some((i) => i.category === c));
      if (ingCat !== 'tout' && present.indexOf(ingCat) === -1) ingCat = 'tout';
      const tabs = UI.catTabs(present, ingCat, (c) => { ingCat = c; App.rerender(); });
      if (tabs) root.appendChild(tabs);

      const shown = ings
        .filter((i) => ingCat === 'tout' || i.category === ingCat)
        .slice().sort(byCatThenName);
      root.appendChild(h('div.card.flush', null,
        shown.map((ing) => ingRow(ing, (i) => openIngredientEditor(i)))));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:10px', onClick: () => openIngredientEditor(null) }, '+ Nouvel ingrédient'));
  }

  Views.meals = {
    render(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: tab === 'donnes' ? 'on' : '', onClick: () => { tab = 'donnes'; App.rerender(); } }, '🍽 Donnés'),
        h('button', { class: tab === 'rotation' ? 'on' : '', onClick: () => { tab = 'rotation'; App.rerender(); } }, 'Rotation'),
        h('button', { class: tab === 'quantites' ? 'on' : '', onClick: () => { tab = 'quantites'; App.rerender(); } }, '⚖️ Quantités'),
        h('button', { class: tab === 'ingredients' ? 'on' : '', onClick: () => { tab = 'ingredients'; App.rerender(); } }, '🥩 Ingrédients')
      ]));
      if (tab === 'donnes') donnesView(root);
      else if (tab === 'rotation') rotationView(root);
      else if (tab === 'ingredients') ingredientsView(root);
      else quantitesView(root);
    }
  };
})();
