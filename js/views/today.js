/* ============================================================
   Vue Aujourd'hui — dashboard
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, money, grams, relDays } = UI;

  const SORTIES = [
    { key: 'ville', label: 'Ville', ic: '🏙️' },
    { key: 'foret', label: 'Forêt', ic: '🌲' },
    { key: 'educ', label: 'Éduc', ic: '🎓' },
    { key: 'veto', label: 'Véto', ic: '🏥' }
  ];

  function mealLines(meals) {
    const lines = [];
    meals.forEach((m) => {
      (m.items || []).forEach((it) => {
        const ing = Store.ingredient(it.ingredientId);
        if (!ing) return;
        lines.push(h('div.meal-line', null, [
          h('span', null, ing.name),
          h('span.q', null, ing.unit === 'piece' ? `×${it.qty}` : grams(it.qty))
        ]));
      });
    });
    return lines;
  }

  function mealSlot(slot, label, ic, iso) {
    const meals = Store.mealsForDay(iso, slot);
    const entry = Store.dayEntry(iso);
    const doneKey = slot === 'matin' ? 'repasMatin' : 'repasSoir';
    const done = !!entry[doneKey];
    const hasMeals = meals.length > 0;

    return h('div', { class: 'meal-slot' + (done ? ' done' : '') }, [
      h('div.slot-label', null, [h('span', null, ic), h('span', null, label),
        done ? h('span.badge.ok', { style: 'margin-left:auto' }, '✓ donné') : null]),
      h('div.slot-body', null,
        hasMeals ? mealLines(meals)
                 : h('div.muted.small', null, 'Aucun repas planifié')),
      h('button', {
        class: 'btn sm ' + (done ? 'subtle' : 'ghost'),
        style: 'margin-top:12px;width:100%',
        onClick: () => Store.setMealGiven(iso, slot, !done)
      }, done ? 'Annuler' : 'Marquer comme donné')
    ]);
  }

  function reminders(iso) {
    const due = Store.get().treatments
      .map((t) => ({ t, st: Store.dueStatus(t, iso) }))
      .filter((x) => x.st.state === 'overdue' || x.st.state === 'soon')
      .sort((a, b) => (a.st.days ?? 999) - (b.st.days ?? 999));

    if (!due.length) {
      return h('div.card', null, h('div.inline', null, [
        h('span', { style: 'font-size:22px' }, '✅'),
        h('div', null, [h('strong', null, 'Aucun soin urgent'), h('div.muted.small', null, 'Tout est à jour côté traitements.')])
      ]));
    }
    return h('div.card.flush', null, due.map(({ t, st }) => {
      const overdue = st.state === 'overdue';
      return h('div.row', null, [
        h('div.row-ic', null, iconFor(t.type)),
        h('div.row-main', null, [
          h('strong', null, t.name),
          h('small', null, overdue ? `En retard — prévu ${relDays(st.days)}` : `À faire ${relDays(st.days)}`)
        ]),
        h('div.row-end', null, [
          h('span', { class: 'badge ' + (overdue ? 'due' : 'soon') }, overdue ? 'En retard' : 'Bientôt'),
          h('button.btn.sm', { onClick: () => { Store.markTreatmentDone(t.id, iso); UI.toast('Fait ✓'); } }, 'Fait')
        ])
      ]);
    }));
  }

  function iconFor(type) {
    return ({ collier: '🦟', vermifuge: '🪱', vaccin: '💉', yeux: '👁️', oreilles: '👂', dents: '🦷', griffes: '🐾', toilettage: '🛁' })[type] || '💊';
  }

  function sortiesCard(iso) {
    const entry = Store.dayEntry(iso);
    const sorties = entry.sorties || {};
    return h('div.card', null, [
      h('div.card-head', null, [h('h3', null, 'Sorties & activités')]),
      h('div.chip-row', null, SORTIES.map((s) =>
        h('button', {
          class: 'chip' + (sorties[s.key] ? ' on' : ''),
          onClick: () => {
            const ns = Object.assign({}, sorties, { [s.key]: !sorties[s.key] });
            Store.updateDay(iso, { sorties: ns });
          }
        }, [h('span', null, s.ic), h('span', null, s.label)])
      ))
    ]);
  }

  function todaySoins(iso) {
    // Soins quotidiens/réguliers à cocher (yeux, oreilles, etc.)
    const entry = Store.dayEntry(iso);
    const soins = entry.soins || [];
    const daily = Store.get().treatments.filter((t) => t.unit === 'jours');
    if (!daily.length) return null;
    return h('div.card', null, [
      h('div.card-head', null, [h('h3', null, 'Soins du jour')]),
      h('div.chip-row', null, daily.map((t) =>
        h('button', {
          class: 'chip' + (soins.includes(t.id) ? ' on' : ''),
          onClick: () => {
            Store.toggleDaySoin(iso, t.id);
            if (!soins.includes(t.id)) Store.markTreatmentDone(t.id, iso);
          }
        }, [h('span', null, iconFor(t.type)), h('span', null, t.name)])
      ))
    ]);
  }

  function rationCard(iso) {
    const reco = Store.recommendedRation();
    const planned = Store.dayPlannedGrams(iso);
    if (!reco) {
      return h('div.card', null, h('div.inline', { style: 'gap:10px' }, [
        h('span', { style: 'font-size:22px' }, '⚖️'),
        h('div', { style: 'flex:1' }, [h('strong', null, 'Ration conseillée'), h('div.muted.small', null, 'Ajoutez une pesée pour calculer la ration.')]),
        h('button.btn.ghost.sm', { onClick: () => App.go('treatments') }, 'Peser')
      ]));
    }
    const pct = reco ? Math.min(140, Math.round(planned / reco * 100)) : 0;
    const diff = planned - reco;
    const okColor = Math.abs(diff) <= reco * 0.1 ? 'var(--ok)' : (planned < reco ? 'var(--amber)' : 'var(--red)');
    const msg = Math.abs(diff) <= reco * 0.1 ? 'Équilibré' : (planned < reco ? `${Math.abs(diff)} g en moins` : `${diff} g en plus`);
    return h('div.card', null, [
      h('div.inline', { style: 'justify-content:space-between;margin-bottom:8px' }, [
        h('div', null, [h('div.muted.small', null, 'Ration conseillée (' + (Store.get().settings.rationPct || 2.5) + ' % du poids)'),
          h('div', { style: 'font-size:20px;font-weight:800;color:var(--green-700)' }, UI.grams(reco) + ' / jour')]),
        h('div', { style: 'text-align:right' }, [h('div.muted.small', null, 'Planifié'), h('strong', { style: 'font-size:18px' }, UI.grams(planned))])
      ]),
      h('div', { style: 'height:8px;background:var(--sand);border-radius:99px;overflow:hidden' },
        h('div', { style: `height:100%;width:${pct}%;background:${okColor};border-radius:99px;transition:width .3s` })),
      h('div.small', { style: `margin-top:6px;color:${okColor};font-weight:700` }, msg + (planned ? '' : ' (les pièces œuf/os ne sont pas comptées en grammes)'))
    ]);
  }

  function lowStockAlert() {
    const low = Store.lowStock();
    if (!low.length) return null;
    return h('div.card', { style: 'background:var(--amber-100);border-color:#eccf9a' }, [
      h('div.inline', { style: 'gap:10px' }, [
        h('span', { style: 'font-size:22px' }, '🧊'),
        h('div', { style: 'flex:1' }, [
          h('strong', null, 'Stock bas'),
          h('div.small', null, low.map((x) => x.ing.name + ' (' + (x.days < 1 ? '<1' : Math.floor(x.days)) + ' j)').join(', '))
        ]),
        h('button.btn.ghost.sm', { onClick: () => App.go('shopping') }, 'Stock')
      ])
    ]);
  }

  Views.today = {
    render(root) {
      const iso = Store.todayISO();

      const alert = lowStockAlert();
      if (alert) root.appendChild(alert);

      root.appendChild(h('div.section-title', null, 'Repas du jour'));
      root.appendChild(h('div.hero-meal', null, [
        mealSlot('matin', 'Matin', '🌅', iso),
        mealSlot('soir', 'Soir', '🌙', iso)
      ]));
      root.appendChild(rationCard(iso));

      root.appendChild(h('div.section-title', null, 'Rappels soins'));
      root.appendChild(reminders(iso));

      const soins = todaySoins(iso);
      if (soins) { root.appendChild(h('div.section-title', null, 'À faire')); root.appendChild(soins); }

      root.appendChild(h('div.section-title', null, 'Activités'));
      root.appendChild(sortiesCard(iso));

      // Note rapide du jour
      const entry = Store.dayEntry(iso);
      root.appendChild(h('div.card', null, [
        h('div.card-head', null, [h('h3', null, 'Note du jour'),
          h('button.linkbtn', { onClick: () => App.go('journal') }, 'Journal →')]),
        h('textarea.input', {
          placeholder: 'Selles, comportement, observations…',
          value: entry.notes || '',
          onChange: (e) => Store.updateDay(iso, { notes: e.target.value })
        })
      ]));
    }
  };
})();
