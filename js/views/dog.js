/* ============================================================
   Vue Chien — tout ce qui concerne les chiens :
   liste/bascule, profil complet, alimentation, raccourcis santé.
   (Réglages garde les listes et options communes à la maison.)
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h } = UI;

  const DOG_SIZES = [['petit', 'Petit (< 10 kg)'], ['moyen', 'Moyen (10-25 kg)'], ['grand', 'Grand (25-45 kg)'], ['geant', 'Géant (> 45 kg)']];
  const DOG_SEXES = [['', '—'], ['femelle', '♀ Femelle'], ['male', '♂ Mâle']];
  const DOG_COLORS = ['', '#e0913a', '#c8553d', '#c2527b', '#7857c0', '#3a6ea5', '#0e9aa7', '#3f9d6b', '#8a6d3b'];

  // Nuancier : rond par couleur, anneau sur la sélection
  function colorSwatches(current, onPick) {
    return h('div.chip-row', null, DOG_COLORS.map((c) => h('button', {
      title: c ? c : 'Aucune couleur',
      style: 'width:34px;height:34px;border-radius:50%;padding:0;font-size:13px;border:3px solid ' + (current === c ? 'var(--ink)' : 'var(--line)') + ';background:' + (c || 'var(--card)'),
      onClick: () => onPick(c)
    }, c ? '' : '✕')));
  }

  /* ---------- Liste des chiens ---------- */
  function dogsCard() {
    const dogs = Store.dogsList();
    const card = h('div.card.flush');
    dogs.forEach((d) => {
      card.appendChild(h('div.row', null, [
        h('div.row-ic', null, d.emoji || '🐕'),
        h('div.row-main', { onClick: () => { if (!d.active) { Store.setCurrentDog(d.id); UI.toast('🐾 ' + d.name); } } }, [
          h('strong', null, d.name + (d.sex === 'femelle' ? ' ♀' : d.sex === 'male' ? ' ♂' : '')),
          h('small', null, [d.active ? 'Affiché actuellement' : 'Toucher pour afficher', d.breed ? ' · ' + d.breed : '', d.birthdate ? ' · né(e) le ' + UI.fmtShortYear(d.birthdate) : ''].join(''))
        ]),
        h('div.row-end', null, h('div.inline', { style: 'gap:4px' }, [
          d.color ? h('span', { style: `width:11px;height:11px;border-radius:50%;background:${d.color};display:inline-block` }) : null,
          d.active ? h('span.badge.ok', null, '✓') : null,
          h('button.btn.ghost.icon', { onClick: () => openDogEditor(d) }, '✎')
        ]))
      ]));
    });
    return h('div', null, [card, h('button.btn.block', { style: 'margin-top:8px', onClick: () => openDogEditor(null) }, '+ Ajouter un chien')]);
  }

  function openDogEditor(d) {
    const isNew = !d;
    let name = d ? d.name : '', birth = d ? d.birthdate : '', breed = d ? d.breed : '', size = d ? d.size : 'moyen', sex = d ? d.sex : '', emoji = d ? d.emoji : '🐕', color = d ? d.color : '';
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Nom du chien'), h('input.input', { value: name, placeholder: 'Ex. Nala', onInput: (e) => name = e.target.value })]),
      h('div.field', null, [h('label', null, 'Date de naissance'), h('input.input', { type: 'date', value: birth, onChange: (e) => birth = e.target.value })]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Race'), h('input.input', { value: breed, placeholder: 'Ex. Cavalier King Charles', onInput: (e) => breed = e.target.value })]),
        h('div.field', null, [h('label', null, 'Gabarit'),
          h('select.input', { onChange: (e) => size = e.target.value }, DOG_SIZES.map(([v, l]) => h('option', { value: v, selected: v === size }, l)))])
      ]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Sexe'),
          h('select.input', { onChange: (e) => sex = e.target.value }, DOG_SEXES.map(([v, l]) => h('option', { value: v, selected: v === sex }, l)))]),
        h('div.field', null, [h('label', null, 'Emoji du bouton'), h('input.input', { value: emoji, placeholder: '🐕', onInput: (e) => emoji = e.target.value })])
      ]),
      (() => {
        const wrapCol = h('div.field');
        const render = () => { UI.clear(wrapCol); wrapCol.appendChild(h('label', null, 'Couleur du chien')); wrapCol.appendChild(colorSwatches(color, (c) => { color = c; render(); })); };
        render();
        return wrapCol;
      })(),
      isNew ? h('p.muted.small', { style: 'margin:0 4px 10px' }, 'Le nouveau chien démarre avec ses propres soins, journal, poids, repas et identité — le stock, les courses et la pharmacie restent communs à la maison.') : null,
      h('div.modal-actions', null, [
        !isNew && Store.dogsList().length > 1 ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer ' + d.name + ' et TOUTES ses données (journal, vaccins, poids…) ? Irréversible.', { danger: true, ok: 'Supprimer' })) {
            Store.removeDog(d.id); UI.closeModal(); UI.toast(d.name + ' supprimé');
          }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!name.trim()) { UI.toast('Donne un nom'); return; }
          if (isNew) {
            const id = Store.addDog(name, birth);
            Store.updateDogMeta(id, { breed: breed.trim(), size, sex, emoji: (emoji || '🐕').trim(), color });
            UI.toast('🐾 Bienvenue ' + name.trim() + ' !');
          } else Store.updateDogMeta(d.id, { name: name.trim(), birthdate: birth, breed: breed.trim(), size, sex, emoji: (emoji || '🐕').trim(), color });
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? '🐾 Nouveau chien' : 'Modifier ' + d.name, body });
  }
  Views.openDogEditor = openDogEditor; // utilisé par la barre des chiens (bouton ＋)

  /* ---------- Rendu de l'onglet ---------- */
  Views.dog = {
    render(root) {
      const s = Store.get().settings;

      // Mes chiens
      root.appendChild(h('div.section-title', null, 'Mes chiens'));
      root.appendChild(dogsCard());

      // Profil du chien affiché
      root.appendChild(h('div.section-title', null, 'Profil de ' + (s.dogName || 'mon chien')));
      root.appendChild(h('div.card', null, [
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Nom du chien'), h('input.input', { value: s.dogName || '', onChange: (e) => Store.updateSettings({ dogName: e.target.value }) })]),
          h('div.field', null, [h('label', null, 'Date de naissance'), h('input.input', { type: 'date', value: s.dogBirthdate || '', onChange: (e) => Store.updateSettings({ dogBirthdate: e.target.value }) })])
        ]),
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Race'), h('input.input', { value: s.dogBreed || '', placeholder: 'Ex. Berger australien', onChange: (e) => Store.updateSettings({ dogBreed: e.target.value }) })]),
          h('div.field', null, [h('label', null, 'Gabarit'),
            h('select.input', { onChange: (e) => Store.updateSettings({ dogSize: e.target.value }) }, DOG_SIZES.map(([v, l]) => h('option', { value: v, selected: v === (s.dogSize || 'moyen') }, l)))])
        ]),
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Sexe'),
            h('select.input', { onChange: (e) => Store.updateSettings({ dogSex: e.target.value }) }, DOG_SEXES.map(([v, l]) => h('option', { value: v, selected: v === (s.dogSex || '') }, l)))]),
          h('div.field', null, [h('label', null, 'Emoji du bouton'),
            h('input.input', { value: s.dogEmoji || '🐕', placeholder: '🐕', onChange: (e) => Store.updateSettings({ dogEmoji: (e.target.value || '🐕').trim() }) })])
        ]),
        h('div.field', null, [h('label', null, 'Couleur du chien (son bouton et sa pastille)'),
          colorSwatches(s.dogColor || '', (c) => Store.updateSettings({ dogColor: c }))])
      ]));

      // Alimentation du chien affiché
      root.appendChild(h('div.section-title', null, 'Alimentation de ' + (s.dogName || 'mon chien')));
      root.appendChild(h('div.card', null, [
        h('div.field', null, [h('label', null, 'Ration (% du poids / jour)'),
          h('input.input', { type: 'number', step: '0.1', min: '1', max: '8', value: s.rationPct || 2.5, onChange: (e) => Store.updateSettings({ rationPct: +e.target.value || 2.5 }) })]),
        (() => {
          const sug = Store.suggestedRationPct();
          const cur = s.rationPct || 2.5;
          return h('div.inline', { style: 'justify-content:space-between;margin:0 4px;gap:8px' }, [
            h('p.muted.small', { style: 'margin:0;flex:1' }, '💡 Suggestion pour un ' + Store.sizeLabel(s.dogSize).toLowerCase() + (sug > 3 ? ' encore chiot' : '') + ' : ~' + sug + ' % (à valider avec le véto).'),
            sug !== cur ? h('button.btn.ghost.sm', { onClick: () => { Store.updateSettings({ rationPct: sug }); UI.toast('Ration réglée sur ' + sug + ' %'); } }, 'Appliquer') : null
          ]);
        })()
      ]));
      root.appendChild(h('div.card', null, [
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Lundi de départ du cycle'),
            h('input.input', { type: 'date', value: s.anchorMonday || '', onChange: (e) => Store.updateSettings({ anchorMonday: Store.mondayOf(e.target.value) }) })]),
          h('div.field', null, [h('label', null, 'Semaines dans le cycle'),
            h('select.input', { onChange: (e) => Store.updateSettings({ cycleWeeks: +e.target.value }) }, [1, 2, 3, 4].map((n) => h('option', { value: n, selected: n === (s.cycleWeeks || 1) }, n)))])
        ]),
        h('p.muted.small', { style: 'margin:0 4px' }, 'Sert à calculer le repas du jour. Compose la rotation dans l\'onglet Repas.')
      ]));

      // Raccourcis santé du chien affiché
      root.appendChild(h('div.section-title', null, 'Santé de ' + (s.dogName || 'mon chien')));
      root.appendChild(h('div.card', null, h('div.inline', { style: 'flex-wrap:wrap;gap:8px' }, [
        ['identite', '🪪 Identité'], ['vaccins', '💉 Vaccins'], ['soins', '💊 Soins'], ['carnet', '📖 Carnet'], ['poids', '⚖️ Poids']
      ].map(([t, l]) => h('button.chip', { onClick: () => Views.goTreatmentsTab(t) }, l)))));
    }
  };
})();
