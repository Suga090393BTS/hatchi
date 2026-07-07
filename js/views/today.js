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

  function mealSlot(slot, label, ic, iso) {
    const planned = Store.itemsForDay(iso, slot);
    const fed = Store.fedForSlot(iso, slot);
    const entry = Store.dayEntry(iso);
    const done = !!fed || !!entry[slot === 'matin' ? 'repasMatin' : 'repasSoir'];
    // le prévu de la rotation sert de pré-remplissage — modifiable librement à la saisie
    const presetItems = planned.map((it) => ({ ingredientId: it.ingredientId, qty: it.qty }));

    return h('div', { class: 'meal-slot' + (done ? ' done' : '') }, [
      h('div.slot-label', null, [h('span', null, ic), h('span', null, label),
        done ? h('span.badge.ok', { style: 'margin-left:auto' }, '✓ donné') : null]),
      h('div.slot-body', null,
        fed ? itemLines(fed.items)
            : planned.length
              ? [h('div.muted.small', { style: 'margin-bottom:4px' }, 'Suggestion (rotation) :')].concat(itemLines(planned))
              : h('div.muted.small', null, 'Note ce que tu donnes, même sans planification.')),
      fed
        ? h('button.btn.sm.subtle', { style: 'margin-top:10px;width:100%', onClick: () => Views.openFedEditor(fed) }, 'Modifier ce qui a été donné')
        : h('button.btn.sm.ghost', { style: 'margin-top:10px;width:100%', onClick: () => Views.openFedEditor(null, { date: iso, slot, presetItems }) }, '🍽 J\'ai donné…')
    ]);
  }

  // Rappels de soins urgents/à venir — renvoie null s'il n'y a rien (pas de bloc inutile)
  function reminders(iso) {
    const due = Store.get().treatments
      .map((t) => ({ t, st: Store.dueStatus(t, iso) }))
      .filter((x) => x.st.state === 'overdue' || x.st.state === 'soon')
      .sort((a, b) => (a.st.days ?? 999) - (b.st.days ?? 999));

    if (!due.length) return null;
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

  // Fenêtre « qui y est allé ? » — s'ouvre automatiquement quand on coche une sortie
  function openWhoModal(iso, s) {
    const people = Store.get().people;
    const entry = Store.dayEntry(iso);
    const sel = new Set((entry.who || {})[s.key] || []);
    const chips = people.map((p) => {
      const c = h('button', {
        class: 'chip' + (sel.has(p.id) ? ' on' : ''),
        onClick: () => { if (sel.has(p.id)) sel.delete(p.id); else sel.add(p.id); c.classList.toggle('on'); }
      }, p.name);
      return c;
    });
    const save = () => {
      const cur = Store.dayEntry(iso);
      const who = Object.assign({}, cur.who);
      who[s.key] = [...sel];
      Store.updateDay(iso, { who });
      UI.closeModal();
    };
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 12px' }, 'Qui y est allé avec ' + (Store.get().settings.dogName || 'Hatchi') + ' ?'),
      h('div.chip-row', null, chips),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Passer'),
        h('button.btn', { onClick: save }, 'Valider')
      ])
    ]);
    UI.modal({ title: s.ic + ' ' + s.label + ' — avec qui ?', body });
  }

  function sortiesCard(iso) {
    const entry = Store.dayEntry(iso);
    const sorties = entry.sorties || {};
    const hasPeople = Store.get().people.length > 0;

    // Sous chaque sortie cochée : avec qui, et un lien pour modifier
    const whoLines = hasPeople ? SORTIES.filter((s) => sorties[s.key]).map((s) => {
      const ids = (entry.who || {})[s.key] || [];
      const names = ids.map((id) => { const p = Store.person(id); return p ? p.name : null; }).filter(Boolean);
      return h('div.inline', { style: 'gap:6px;margin-top:8px;font-size:13px' }, [
        h('span', null, s.ic),
        h('span', { class: names.length ? '' : 'muted' }, names.length ? 'avec ' + names.join(', ') : 'avec qui ?'),
        h('button.linkbtn', { style: 'margin-left:auto', onClick: () => openWhoModal(iso, s) }, 'modifier')
      ]);
    }) : [];

    return h('div.card', null, [
      h('div.chip-row', null, SORTIES.map((s) =>
        h('button', {
          class: 'chip' + (sorties[s.key] ? ' on' : ''),
          onClick: () => {
            const on = !sorties[s.key];
            const ns = Object.assign({}, sorties, { [s.key]: on });
            const patch = { sorties: ns };
            if (!on) {
              // décoché : on retire aussi les personnes associées
              const who = Object.assign({}, entry.who);
              who[s.key] = [];
              patch.who = who;
            }
            Store.updateDay(iso, patch);
            if (on && hasPeople) openWhoModal(iso, s);
          }
        }, [h('span', null, s.ic), h('span', null, s.label)])
      )),
      whoLines.length ? h('div', { style: 'margin-top:4px' }, whoLines) : null
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

  // « À faire » : soins quotidiens à cocher + tâches libres, réunis dans une seule carte
  function aFaireCard(iso) {
    const entry = Store.dayEntry(iso);
    const soins = entry.soins || [];
    const daily = Store.get().treatments.filter((t) => t.unit === 'jours');
    const card = h('div.card');
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

  // Choses à faire : tâches libres, cochables (les faites disparaissent le lendemain)
  function todosCard() {
    const todos = Store.todosVisible();
    const card = h('div.card');
    todos.forEach((t) => {
      card.appendChild(h('div.inline', { style: 'gap:10px;padding:5px 2px;align-items:center' }, [
        h('button', { style: 'border:0;background:none;font-size:19px;padding:0;cursor:pointer', onClick: () => Store.toggleTodo(t.id) }, t.done ? '✅' : '⬜'),
        h('span', { style: 'flex:1;font-size:14.5px' + (t.done ? ';text-decoration:line-through;opacity:.55' : ''), onClick: () => Store.toggleTodo(t.id) }, t.text),
        h('button.delete-x', { onClick: () => Store.removeTodo(t.id) }, '✕')
      ]));
    });
    if (!todos.length) card.appendChild(h('div.muted.small', { style: 'padding:2px 2px 4px' }, 'Ajoute ici ce que tu ne veux pas oublier (RDV véto, harnais à racheter…).'));
    card.appendChild(h('datalist', { id: 'hatchi-todos' }, Store.todoTexts().map((t) => h('option', { value: t }))));
    const inp = h('input.input', { placeholder: 'Ex. prendre RDV véto…', style: 'flex:1', list: 'hatchi-todos' });
    const add = () => {
      if (!inp.value.trim()) { UI.toast('Écris la tâche d\'abord'); return; }
      Store.addTodo(inp.value);
      inp.value = '';
      inp.blur(); // déclenche le rafraîchissement différé
    };
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

      // 1) Alerte stock (uniquement si besoin)
      const alert = lowStockAlert();
      if (alert) root.appendChild(alert);

      // 2) Les repas du jour — l'action principale (matin + soir réunis dans une seule carte)
      root.appendChild(h('div.section-title', null, 'Repas du jour'));
      root.appendChild(h('div.card.meals', null, [
        mealSlot('matin', 'Matin', '🌅', iso),
        h('div.meal-sep'),
        mealSlot('soir', 'Soir', '🌙', iso)
      ]));
      root.appendChild(rationCard(iso));

      // 3) Rappels de soins — seulement s'il y a quelque chose d'urgent
      const rem = reminders(iso);
      if (rem) { root.appendChild(h('div.section-title', null, 'Rappels soins')); root.appendChild(rem); }

      // 4) À faire — soins du jour + tâches, dans une seule carte
      root.appendChild(h('div.section-title', null, 'À faire'));
      root.appendChild(aFaireCard(iso));

      // 5) La journée — tout le reste (sorties, humeur, note, photo) se saisit dans la fiche
      root.appendChild(h('div.section-title', null, 'La journée'));
      root.appendChild(h('div.inline', { style: 'gap:8px' }, [
        h('button.btn', { style: 'flex:1', onClick: () => Views.openDayEditor(iso) }, '📝 Noter la journée'),
        h('button.btn.subtle', { style: 'flex:1', onClick: () => (Views.openCalendar ? Views.openCalendar() : App.go('journal')) }, '📅 Calendrier')
      ]));
    }
  };
})();
