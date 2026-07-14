/* ============================================================
   Vue Aujourd'hui — dashboard
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, grams, relDays } = UI;

  function itemLines(items) {
    return (items || []).map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      if (!ing) return null;
      return h('div.meal-line', null, [
        h('span', null, ing.name),
        h('span.q', null, ing.unit === 'piece' ? `×${it.qty}` : grams(it.qty))
      ]);
    }).filter(Boolean);
  }

  // Résumé compact d'un repas sur une ligne : « Poulet 300 g · Carotte 100 g »
  function mealSummary(items) {
    const parts = (items || []).map((it) => {
      const ing = Store.ingredient(it.ingredientId);
      if (!ing) return null;
      return ing.name + ' ' + (ing.unit === 'piece' ? '×' + it.qty : grams(it.qty));
    }).filter(Boolean);
    return parts.length ? parts.join(' · ') : null;
  }

  // Un repas = un « onglet déroulant » : ligne compacte toujours visible (résumé) ;
  // on touche l'en-tête pour dérouler le détail + le bouton « J'ai donné ».
  function mealSlot(slot, label, ic, iso) {
    const planned = Store.itemsForDay(iso, slot);
    const fed = Store.fedForSlot(iso, slot);
    const entry = Store.dayEntry(iso);
    const done = !!fed || !!entry[slot === 'matin' ? 'repasMatin' : 'repasSoir'];
    // le prévu de la rotation sert de pré-remplissage — modifiable librement à la saisie
    const presetItems = planned.map((it) => ({ ingredientId: it.ingredientId, qty: it.qty }));
    const summary = mealSummary(fed ? fed.items : planned) || 'À noter';

    const body = h('div', null,
      fed ? itemLines(fed.items)
          : planned.length
            ? [h('div.muted.small', { style: 'margin-bottom:4px' }, 'Suggestion (rotation) :')].concat(itemLines(planned))
            : h('div.muted.small', null, 'Note ce que tu donnes, même sans planification.'));
    const details = h('div.meal-details', null, [
      body,
      fed
        ? h('button.btn.sm.subtle', { style: 'margin-top:10px;width:100%', onClick: () => Views.openFedEditor(fed) }, 'Modifier ce qui a été donné')
        : h('button.btn.sm.ghost', { style: 'margin-top:10px;width:100%', onClick: () => Views.openFedEditor(null, { date: iso, slot, presetItems }) }, '🍽 J\'ai donné…')
    ]);

    // Confort : le repas du créneau courant est déroulé d'office (matin le matin, soir le soir)
    const hour = new Date().getHours();
    const isCurrent = (slot === 'matin' && hour < 14) || (slot === 'soir' && hour >= 14);

    // Confort : 1 tap « ✓ donné » enregistre le repas prévu sans ouvrir l'éditeur (reste modifiable)
    const quickGive = (!done && planned.length)
      ? h('button.quickgive', { onClick: (e) => {
          e.stopPropagation();
          Store.logFed({ date: iso, slot, items: presetItems });
          UI.toast('Repas noté ✓ — modifiable dans le détail');
        } }, '✓ donné')
      : null;

    const card = h('div', { class: 'meal-slot slot-' + slot + (done ? ' done' : '') + (isCurrent && !done ? ' open' : '') }, [
      h('div.slot-head', { onClick: () => card.classList.toggle('open') }, [
        h('div.slot-ic', null, ic),
        h('div.slot-main', null, [
          h('div.slot-title', null, label),
          h('div.slot-sum', null, summary)
        ]),
        done ? h('span.badge.ok', null, '✓ donné') : quickGive,
        h('span.chev', null, '›')
      ]),
      details
    ]);
    return card;
  }

  function iconFor(type) {
    return ({ collier: '🦟', vermifuge: '🪱', vaccin: '💉', yeux: '👁️', oreilles: '👂', dents: '🦷', griffes: '🐾', toilettage: '🛁' })[type] || '💊';
  }

  // « À faire » : tout ce qu'il reste à faire aujourd'hui, dans UNE carte —
  // les soins en retard/à venir, les soins quotidiens à cocher, puis les tâches libres.
  // (Avant : « Rappels soins » et « Soins du jour » formaient deux blocs séparés.)
  function aFaireCard(iso) {
    const entry = Store.dayEntry(iso);
    const soins = entry.soins || [];
    const daily = Store.get().treatments.filter((t) => t.unit === 'jours');
    const card = h('div.card');

    // 1) Les soins datés qui réclament une action (en retard ou imminents)
    const due = Store.get().treatments
      .map((t) => ({ t, st: Store.dueStatus(t, iso) }))
      .filter((x) => x.st.state === 'overdue' || x.st.state === 'soon')
      .sort((a, b) => (a.st.days ?? 999) - (b.st.days ?? 999));
    if (due.length) {
      card.appendChild(h('div.muted.small', { style: 'font-weight:700;margin-bottom:8px' }, 'Soins à faire'));
      due.forEach(({ t, st }) => {
        const overdue = st.state === 'overdue';
        card.appendChild(h('div.inline', { style: 'gap:10px;padding:6px 0' }, [
          h('span', { style: 'font-size:17px' }, iconFor(t.type)),
          h('div', { style: 'flex:1;min-width:0' }, [
            h('div', { style: 'font-size:14.5px;font-weight:600' }, t.name),
            h('div.muted.small', null, overdue ? 'En retard — prévu ' + relDays(st.days) : 'À faire ' + relDays(st.days))
          ]),
          h('span', { class: 'badge ' + (overdue ? 'due' : 'soon') }, overdue ? 'En retard' : 'Bientôt'),
          h('button.btn.sm', { onClick: () => { Store.markTreatmentDone(t.id, iso); UI.toast('Fait ✓'); } }, 'Fait')
        ]));
      });
      card.appendChild(h('div.divider', { style: 'height:1px;background:var(--line);margin:12px 0' }));
    }

    // 2) Les soins quotidiens à cocher
    if (daily.length) {
      card.appendChild(h('div.muted.small', { style: 'font-weight:700;margin-bottom:8px' }, 'Soins du jour'));
      card.appendChild(h('div.chip-row', null, daily.map((t) =>
        h('button', {
          class: 'chip' + (soins.includes(t.id) ? ' on' : ''),
          onClick: () => { Store.toggleDaySoin(iso, t.id); if (!soins.includes(t.id)) Store.markTreatmentDone(t.id, iso); }
        }, [h('span', null, iconFor(t.type)), h('span', null, t.name)]))));
      card.appendChild(h('div.divider', { style: 'height:1px;background:var(--line);margin:12px 0' }));
    }
    card.appendChild(h('div.muted.small', { style: 'font-weight:700;margin-bottom:8px' }, 'Choses à faire'));
    const todos = Store.todosVisible();
    todos.forEach((t) => {
      card.appendChild(h('div.inline', { style: 'gap:10px;padding:5px 2px;align-items:center' }, [
        h('button', { style: 'border:0;background:none;font-size:19px;padding:0;cursor:pointer', onClick: () => Store.toggleTodo(t.id) }, t.done ? '✅' : '⬜'),
        h('span', { style: 'flex:1;font-size:14.5px' + (t.done ? ';text-decoration:line-through;opacity:.55' : ''), onClick: () => Store.toggleTodo(t.id) }, t.text),
        h('button.delete-x', { onClick: () => Store.removeTodo(t.id) }, '✕')
      ]));
    });
    if (!todos.length) card.appendChild(h('div.muted.small', { style: 'padding:2px 2px 4px' }, 'Rien de prévu — ajoute un rappel (RDV véto, harnais…).'));
    card.appendChild(h('datalist', { id: 'hatchi-todos' }, Store.todoTexts().map((t) => h('option', { value: t }))));
    const inp = h('input.input', { placeholder: 'Ex. prendre RDV véto…', style: 'flex:1', list: 'hatchi-todos' });
    const add = () => { if (!inp.value.trim()) { UI.toast('Écris la tâche d\'abord'); return; } Store.addTodo(inp.value); inp.value = ''; inp.blur(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    card.appendChild(h('div.inline', { style: 'gap:8px;margin-top:8px' }, [inp, h('button.btn.sm', { onClick: add }, '+ Ajouter')]));
    return card;
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
    const given = Store.fedGramsForDay(iso);
    const shown = given || planned; // priorité au réellement donné
    const label = given ? 'Donné' : 'Planifié';
    const pct = reco ? Math.min(140, Math.round(shown / reco * 100)) : 0;
    const diff = shown - reco;
    const okColor = Math.abs(diff) <= reco * 0.1 ? 'var(--ok)' : (shown < reco ? 'var(--amber)' : 'var(--red)');
    const msg = Math.abs(diff) <= reco * 0.1 ? 'Équilibré' : (shown < reco ? `${Math.abs(diff)} g en moins` : `${diff} g en plus`);
    return h('div.card', null, [
      h('div.inline', { style: 'justify-content:space-between;margin-bottom:8px' }, [
        h('div', null, [h('div.muted.small', null, 'Ration conseillée (' + (Store.get().settings.rationPct || 2.5) + ' % du poids)'),
          h('div', { style: 'font-size:20px;font-weight:800;color:var(--green-700)' }, UI.grams(reco) + ' / jour')]),
        h('div', { style: 'text-align:right' }, [h('div.muted.small', null, label), h('strong', { style: 'font-size:18px' }, UI.grams(shown))])
      ]),
      h('div', { style: 'height:8px;background:var(--sand);border-radius:99px;overflow:hidden' },
        h('div', { style: `height:100%;width:${pct}%;background:${okColor};border-radius:99px;transition:width .3s` })),
      h('div.small', { style: `margin-top:6px;color:${okColor};font-weight:700` }, msg + (shown ? '' : ' (les pièces œuf/os ne sont pas comptées en grammes)'))
    ]);
  }

  // Alerte stock compacte : une ligne, tap → Courses (le détail complet est dans Courses → Achats)
  function lowStockAlert() {
    const low = Store.lowStock();
    if (!low.length) return null;
    const noms = low.slice(0, 3).map((x) => x.ing.name).join(', ');
    const reste = low.length - 3;
    return h('button.card', {
      style: 'background:var(--amber-100);width:100%;text-align:left;cursor:pointer;padding:12px 16px',
      onClick: () => App.go('shopping')
    }, h('div.inline', { style: 'gap:10px' }, [
      h('span', { style: 'font-size:20px' }, '🧊'),
      h('div', { style: 'flex:1;min-width:0' }, [
        h('strong', { style: 'font-size:14.5px' }, low.length + ' ingrédient' + (low.length > 1 ? 's' : '') + ' bientôt épuisé' + (low.length > 1 ? 's' : '')),
        h('div.small.muted', { style: 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, noms + (reste > 0 ? ' +' + reste + ' autres' : ''))
      ]),
      h('span.muted', null, '›')
    ]));
  }

  Views.today = {
    render(root) {
      const iso = Store.todayISO();

      // Alerte stock (uniquement si besoin) — reste tout en haut
      const alert = lowStockAlert();
      if (alert) root.appendChild(alert);

      // 1) La journée — noter d'abord (ordre choisi : Journal en haut)
      root.appendChild(h('div.section-title', null, 'La journée'));
      root.appendChild(h('div.inline', { style: 'gap:8px' }, [
        h('button.btn', { style: 'flex:1', onClick: () => Views.openDayEditor(iso) }, '📝 Noter la journée'),
        h('button.btn.subtle', { style: 'flex:1', onClick: () => (Views.openCalendar ? Views.openCalendar() : App.go('journal')) }, '📅 Calendrier')
      ]));

      // 2) Les repas du jour — matin + soir réunis, déroulants (résumé compact par défaut)
      root.appendChild(h('div.section-title', null, 'Repas du jour'));
      root.appendChild(h('div.card.meals', null, [
        mealSlot('matin', 'Matin', '🌅', iso),
        h('div.meal-sep'),
        mealSlot('soir', 'Soir', '🌙', iso)
      ]));
      root.appendChild(rationCard(iso));

      // 3) À faire — soins en retard, soins du jour et tâches, réunis dans une seule carte
      root.appendChild(h('div.section-title', null, 'À faire'));
      root.appendChild(aFaireCard(iso));
    }
  };
})();
