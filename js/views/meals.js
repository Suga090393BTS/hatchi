/* ============================================================
   Vue Repas — repas-types + rotation hebdomadaire
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, grams } = UI;
  const { DAYS_SHORT } = UI;

  let tab = 'donnes'; // 'donnes' | 'rotation' | 'types'
  let typesSlot = 'matin'; // onglet actif dans Repas-types : 'matin' | 'soir'
  const mealSlot = (m) => m.slot || 'matin';

  /* ---------- Repas-types ---------- */
  function mealSummary(m) {
    return (m.items || []).map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      if (!ing) return '';
      return `${ing.name} ${ing.unit === 'piece' ? '×' + it.qty : grams(it.qty)}`;
    }).filter(Boolean).join(' · ') || 'Vide';
  }

  const CAT_LABEL = { viande: '🥩 Viandes', abats: '🫀 Abats', os: '🦴 Os', entier: '🐔 Animaux entiers', oeuf: '🥚 Œufs', legume: '🥕 Légumes', autre: '📦 Autre' };
  const CAT_ORDER = ['viande', 'abats', 'os', 'entier', 'oeuf', 'legume', 'autre'];
  const stockLabel = (i) => {
    const st = Store.stockOf(i.id);
    return st > 0 ? (i.unit === 'piece' ? '×' + st : UI.grams(st)) + ' en stock' : 'épuisé';
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

  function openMealEditor(meal, preset) {
    const isNew = !meal;
    let draft = meal ? JSON.parse(JSON.stringify(meal)) : Object.assign({ name: '', slot: typesSlot, items: [] }, preset || {});
    if (!draft.slot) draft.slot = 'matin';

    const slotSeg = h('div.seg', null, [['matin', '🌅 Matin'], ['soir', '🌙 Soir']].map(([v, l]) =>
      h('button', { class: draft.slot === v ? 'on' : '', onClick: (e) => {
        draft.slot = v;
        [...slotSeg.children].forEach((b) => b.classList.toggle('on', b === e.currentTarget));
      } }, l)));
    const body = h('div', null, [
      h('div.field', null, [
        h('label', null, 'Nom du repas-type'),
        h('input.input', { value: draft.name, placeholder: 'Ex. Poulet + os', onInput: (e) => draft.name = e.target.value })
      ]),
      h('div.field', null, [h('label', null, 'Repas du…'), slotSeg]),
      h('div.field', null, [
        h('label', null, 'Ingrédients & quantités (prévision — pas besoin d\'avoir le stock)'),
        itemsEditor(draft, { stockOnly: false })
      ]),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer ce repas-type ?', { danger: true, ok: 'Supprimer' })) { Store.removeMeal(meal.id); UI.closeModal(); }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!draft.name.trim()) { UI.toast('Donnez un nom'); return; }
          if (isNew) Store.addMeal(draft); else Store.updateMeal(meal.id, draft);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouveau repas-type' : 'Modifier le repas', body });
  }

  function typesView(root) {
    root.appendChild(h('div.seg', { style: 'margin-bottom:12px' }, [['matin', '🌅 Matin'], ['soir', '🌙 Soir']].map(([v, l]) =>
      h('button', { class: typesSlot === v ? 'on' : '', onClick: () => { typesSlot = v; App.rerender(); } }, l))));
    const meals = Store.get().meals.filter((m) => mealSlot(m) === typesSlot);
    if (!meals.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🍖', 'Aucun repas-type du ' + typesSlot, 'Créez vos repas (ex. « Poulet + os », « Bœuf + courgette + œuf ») puis placez-les dans la rotation.')));
    } else {
      root.appendChild(h('div.card.flush', null, meals.map((m) =>
        h('div.row', { onClick: () => openMealEditor(m) }, [
          h('div.row-ic', null, typesSlot === 'matin' ? '🌅' : '🌙'),
          h('div.row-main', null, [h('strong', null, m.name), h('small', null, mealSummary(m))]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ])
      )));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openMealEditor(null) }, '+ Nouveau repas-type du ' + typesSlot));
    // Suggestion automatique : compose un repas avec ce qui est réellement en stock
    root.appendChild(h('button.btn.subtle.block', { style: 'margin-top:8px', onClick: () => {
      const sug = Store.suggestMealFromStock(typesSlot);
      if (sug.error) { UI.toast(sug.error); return; }
      openMealEditor(null, sug);
    } }, '✨ Composer un repas du ' + typesSlot + ' selon le stock'));
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
    const body = h('div', null, [
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Date'), h('input.input', { type: 'date', value: draft.date, max: Store.todayISO(), onChange: (e) => draft.date = e.target.value })]),
        h('div.field', null, [h('label', null, 'Repas du…'), slotSeg])
      ]),
      h('div.field', null, [h('label', null, 'Ce que j\'ai donné (selon le stock)'), itemsEditor(draft, { stockOnly: true })]),
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
    vals.forEach((v, i) => {
      if (!v) return;
      const x = pad.l + i * bw + bw * 0.15;
      const ok = !a.reco || (v >= a.reco * 0.8 && v <= a.reco * 1.25);
      svg.appendChild(el('rect', { x, y: py(v), width: bw * 0.7, height: (H - pad.b) - py(v), rx: 3, fill: ok ? '#1f6f5c' : '#c98a2b' }));
    });
    if (a.reco) {
      svg.appendChild(el('line', { x1: pad.l, y1: py(a.reco), x2: W - pad.r, y2: py(a.reco), stroke: '#a33b2e', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
      svg.appendChild(el('text', { x: 2, y: py(a.reco) + 4, 'font-size': 9, fill: '#a33b2e' }, a.reco + ' g'));
    }
    days.forEach((d, i) => {
      if (i % 2) return;
      svg.appendChild(el('text', { x: pad.l + i * bw + bw / 2, y: H - 6, 'font-size': 8.5, fill: '#5d6b66', 'text-anchor': 'middle' }, +d.slice(8)));
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
    const ids = Store.getRotation(week, dayIdx, slot);
    const names = ids.map((id) => { const m = Store.meal(id); return m ? m.name : null; }).filter(Boolean);
    return h('div', {
      style: 'flex:1;cursor:pointer', onClick: () => openSlotPicker(week, dayIdx, slot, label)
    }, [
      h('div.muted.small', { style: 'font-weight:700' }, label),
      names.length
        ? h('div.small', null, names.join(', '))
        : h('div.muted.small', { style: 'opacity:.6' }, '+ choisir')
    ]);
  }

  function openSlotPicker(week, dayIdx, slot, label) {
    const all = Store.get().meals;
    // les repas du bon créneau d'abord, les autres ensuite
    const meals = all.filter((m) => mealSlot(m) === slot).concat(all.filter((m) => mealSlot(m) !== slot));
    let selected = new Set(Store.getRotation(week, dayIdx, slot));
    if (!meals.length) {
      UI.toast('Créez d\'abord des repas-types');
      tab = 'types'; App.rerender(); return;
    }
    const list = h('div.chip-row', { style: 'flex-direction:column;align-items:stretch' },
      meals.map((m) => {
        const btn = h('button', {
          class: 'chip' + (selected.has(m.id) ? ' on' : ''),
          style: 'justify-content:space-between',
          onClick: () => { selected.has(m.id) ? selected.delete(m.id) : selected.add(m.id); btn.classList.toggle('on', selected.has(m.id)); }
        }, [h('span', null, m.name), h('span.small', { style: 'opacity:.8' }, mealSummary(m))]);
        return btn;
      })
    );
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 10px' }, `${UI.DAYS[dayIdx]} · ${label} · Semaine ${week}`),
      list,
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => { Store.setRotation(week, dayIdx, slot, [...selected]); UI.closeModal(); } }, 'Valider')
      ])
    ]);
    UI.modal({ title: 'Repas du ' + UI.DAYS[dayIdx].toLowerCase(), body });
  }

  function rotationView(root) {
    const cycleWeeks = Store.get().settings.cycleWeeks || 1;

    // Proposition de rotation 4 semaines (toujours proposée ; remplace la rotation en place)
    const rotationEmpty = !Object.keys(Store.get().rotation).some((k) => (Store.get().rotation[k] || []).length);
    root.appendChild(h('div.card', { style: 'background:var(--green-100);border-color:#bfe0d4' }, [
      h('div.inline', { style: 'gap:12px' }, [
        h('span', { style: 'font-size:26px' }, '✨'),
        h('div', { style: 'flex:1' }, [
          h('strong', null, 'Rotation 4 semaines « bien-être »'),
          h('div.small.muted', null, 'Protéines variées sur le mois, poisson 1×/semaine, abats et os répartis — à partir de vos repas du tableau HATCHI 2026. Modifiable ensuite.')
        ])
      ]),
      h('button.btn.block', { style: 'margin-top:12px', onClick: async () => {
        if (await UI.confirm(rotationEmpty
          ? 'Charger la rotation 4 semaines (crée les repas-types et remplit les 4 semaines) ?'
          : 'Charger la rotation 4 semaines ? Elle remplace la rotation actuelle.', { ok: 'Charger' })) {
          Store.loadExampleRotation(); UI.toast('Rotation 4 semaines chargée ✓');
        }
      } }, '✨ Charger la rotation 4 semaines')
    ]));

    // Sélecteur du nombre de semaines de cycle
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, 'Cycle de rotation'),
        h('span.muted.small', null, cycleWeeks === 1 ? '1 semaine (identique)' : cycleWeeks + ' semaines')]),
      h('div.seg', null, [1, 2, 3, 4].map((n) =>
        h('button', { class: n === cycleWeeks ? 'on' : '', onClick: () => { Store.updateSettings({ cycleWeeks: n }); if (editWeek > n) editWeek = 1; } }, n + ' sem.')
      )),
      h('p.muted.small', { style: 'margin:10px 4px 0' }, 'L’app détermine automatiquement le repas du jour selon ce cycle et la date de départ (Réglages).')
    ]));

    // Équilibre BARF de la semaine
    const bal = Store.barfBalance('week');
    if (bal.muscle + bal.abats > 0) {
      const abatsOk = bal.abatsPct >= 8 && bal.abatsPct <= 15;
      const osOk = bal.osPieces > 0;
      root.appendChild(h('div.card', null, [
        h('div.card-head', null, [h('h3', null, 'Équilibre de la semaine'), h('span.muted.small', null, UI.grams(bal.muscle + bal.abats) + ' viande')]),
        h('div', { style: 'display:flex;height:14px;border-radius:99px;overflow:hidden;margin-bottom:8px' }, [
          h('div', { style: `width:${bal.musclePct}%;background:var(--green)`, title: 'Muscle' }),
          h('div', { style: `width:${bal.abatsPct}%;background:var(--amber)`, title: 'Abats' })
        ]),
        h('div.inline', { style: 'gap:14px;flex-wrap:wrap;font-size:12.5px' }, [
          h('span.inline', { style: 'gap:5px' }, [h('i', { style: 'width:9px;height:9px;border-radius:2px;background:var(--green);display:inline-block' }), `Muscle ${bal.musclePct}%`]),
          h('span.inline', { style: 'gap:5px' }, [h('i', { style: 'width:9px;height:9px;border-radius:2px;background:var(--amber);display:inline-block' }), `Abats ${bal.abatsPct}%`]),
          bal.legume ? h('span.muted', null, '🥕 ' + UI.grams(bal.legume)) : null,
          h('span', { class: osOk ? 'muted' : '', style: osOk ? '' : 'color:var(--red);font-weight:700' }, '🦴 ' + bal.osPieces + ' os')
        ]),
        h('p.muted.small', { style: 'margin:8px 4px 0' }, abatsOk && osOk
          ? '✅ Bon équilibre (repère BARF : ~80 % muscle, ~10 % os, ~10 % abats).'
          : (!abatsOk ? `⚠️ Abats à ~${bal.abatsPct}% (viser ~10%). ` : '') + (!osOk ? '⚠️ Pensez à inclure de l’os.' : ''))
      ]));
    }

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
  }

  Views.meals = {
    render(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px;flex-wrap:wrap;justify-content:center' }, [
        h('button', { class: tab === 'donnes' ? 'on' : '', onClick: () => { tab = 'donnes'; App.rerender(); } }, '🍽 Donnés'),
        h('button', { class: tab === 'rotation' ? 'on' : '', onClick: () => { tab = 'rotation'; App.rerender(); } }, 'Rotation'),
        h('button', { class: tab === 'types' ? 'on' : '', onClick: () => { tab = 'types'; App.rerender(); } }, 'Repas-types')
      ]));
      if (tab === 'donnes') donnesView(root);
      else if (tab === 'rotation') rotationView(root);
      else typesView(root);
    }
  };
})();
