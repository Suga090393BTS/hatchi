/* ============================================================
   Vue Repas — repas-types + rotation hebdomadaire
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, grams } = UI;
  const { DAYS_SHORT } = UI;

  let tab = 'rotation'; // 'rotation' | 'types'

  /* ---------- Repas-types ---------- */
  function mealSummary(m) {
    return (m.items || []).map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      if (!ing) return '';
      return `${ing.name} ${ing.unit === 'piece' ? '×' + it.qty : grams(it.qty)}`;
    }).filter(Boolean).join(' · ') || 'Vide';
  }

  function openMealEditor(meal) {
    const isNew = !meal;
    let draft = meal ? JSON.parse(JSON.stringify(meal)) : { name: '', items: [] };

    const itemsBox = h('div');
    function renderItems() {
      UI.clear(itemsBox);
      if (!draft.items.length) itemsBox.appendChild(h('div.muted.small', { style: 'padding:6px 2px' }, 'Aucun ingrédient. Ajoutez-en ci-dessous.'));
      draft.items.forEach((it, idx) => {
        const ing = Store.ingredient(it.ingredientId);
        itemsBox.appendChild(h('div.inline', { style: 'margin-bottom:8px' }, [
          h('select.input', {
            style: 'flex:2',
            onChange: (e) => it.ingredientId = e.target.value
          }, Store.get().ingredients.map((i) => h('option', { value: i.id, selected: i.id === it.ingredientId }, i.name))),
          h('input.input', { style: 'flex:1', type: 'number', min: '0', value: it.qty, onInput: (e) => it.qty = +e.target.value || 0 }),
          h('span.muted.small', { style: 'width:34px' }, ing && ing.unit === 'piece' ? 'u.' : 'g'),
          h('button.delete-x', { onClick: () => { draft.items.splice(idx, 1); renderItems(); } }, '✕')
        ]));
      });
    }
    renderItems();

    const body = h('div', null, [
      h('div.field', null, [
        h('label', null, 'Nom du repas-type'),
        h('input.input', { value: draft.name, placeholder: 'Ex. Poulet + os (matin)', onInput: (e) => draft.name = e.target.value })
      ]),
      h('div.field', null, [
        h('label', null, 'Ingrédients & quantités'),
        itemsBox,
        h('button.btn.ghost.sm', { onClick: () => {
          const first = Store.get().ingredients[0];
          draft.items.push({ ingredientId: first ? first.id : '', qty: first && first.unit === 'piece' ? 1 : 100 });
          renderItems();
        } }, '+ Ajouter un ingrédient')
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
    const meals = Store.get().meals;
    if (!meals.length) {
      root.appendChild(h('div.card', null, UI.emptyState('🍖', 'Aucun repas-type', 'Créez vos repas (ex. « Poulet + os », « Bœuf + courgette + œuf ») puis placez-les dans la rotation.')));
    } else {
      root.appendChild(h('div.card.flush', null, meals.map((m) =>
        h('div.row', { onClick: () => openMealEditor(m) }, [
          h('div.row-ic', null, '🍖'),
          h('div.row-main', null, [h('strong', null, m.name), h('small', null, mealSummary(m))]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ])
      )));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openMealEditor(null) }, '+ Nouveau repas-type'));
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
    const meals = Store.get().meals;
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

    // Proposition de rotation type si tout est vide
    const rotationEmpty = !Object.keys(Store.get().rotation).some((k) => (Store.get().rotation[k] || []).length);
    if (rotationEmpty) {
      root.appendChild(h('div.card', { style: 'background:var(--green-100);border-color:#bfe0d4' }, [
        h('div.inline', { style: 'gap:12px' }, [
          h('span', { style: 'font-size:26px' }, '✨'),
          h('div', { style: 'flex:1' }, [
            h('strong', null, 'Démarrer avec votre rotation type'),
            h('div.small.muted', null, 'Plan viande maison matin/soir repris de votre tableau HATCHI 2026. Modifiable ensuite.')
          ])
        ]),
        h('button.btn.block', { style: 'margin-top:12px', onClick: async () => {
          if (await UI.confirm('Charger la rotation type (crée les repas-types et remplit la semaine) ?', { ok: 'Charger' })) {
            Store.loadExampleRotation(); UI.toast('Rotation chargée ✓');
          }
        } }, '✨ Charger la rotation type')
      ]));
    }

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
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: tab === 'rotation' ? 'on' : '', onClick: () => { tab = 'rotation'; App.rerender(); } }, 'Rotation'),
        h('button', { class: tab === 'types' ? 'on' : '', onClick: () => { tab = 'types'; App.rerender(); } }, 'Repas-types')
      ]));
      if (tab === 'rotation') rotationView(root); else typesView(root);
    }
  };
})();
