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
      const active = Store.dogsList().find((x) => x.active) || {};

      // Fiche résumé du chien affiché (lecture, bouton Modifier)
      const age = dogAge(s.dogBirthdate);
      const lastW = Store.lastWeight();
      const norm = lastW ? Store.weightNormAt(lastW.date) : null;
      const wStatus = lastW ? (lastW.kg < norm.min ? ['⚠️ sous la norme', 'due'] : lastW.kg > norm.max ? ['⚠️ au-dessus', 'soon'] : ['✅ dans la norme', 'ok']) : null;
      root.appendChild(h('div.card', { style: 'display:flex;gap:14px;align-items:center' }, [
        h('div', { style: 'width:52px;height:52px;border-radius:16px;display:grid;place-items:center;font-size:28px;flex:none;background:' + (active.color || 'var(--sand)') }, active.emoji || '🐕'),
        h('div', { style: 'flex:1;min-width:0' }, [
          h('strong', { style: 'font-size:18px' }, (s.dogName || 'Mon chien') + (s.dogSex === 'femelle' ? ' ♀' : s.dogSex === 'male' ? ' ♂' : '')),
          h('div.muted.small', null, [s.dogBreed, age].filter(Boolean).join(' · ') || 'Renseigne sa fiche'),
          lastW ? h('div.inline', { style: 'gap:6px;margin-top:4px' }, [h('strong.small', null, lastW.kg + ' kg'), h('span', { class: 'badge ' + wStatus[1] }, wStatus[0])]) : null
        ]),
        h('button.btn.ghost.sm', { onClick: () => openDogEditor(active) }, 'Modifier')
      ]));

      // Menu : le carnet du chien (chaque ligne ouvre sa section)
      const menu = [
        ['📓', 'Journal & tendances', 'Repas, selles, humeur, sorties, photos', () => App.go('journal')],
        ['💊', 'Soins & rappels', 'Vermifuge, collier, soins réguliers', () => Views.goTreatmentsTab('soins')],
        ['💉', 'Vaccins', 'Historique et rappels à venir', () => Views.goTreatmentsTab('vaccins')],
        ['⚖️', 'Poids & courbe', 'Suivi et couloir de norme', () => Views.goTreatmentsTab('poids')],
        ['🪪', 'Identité & papiers', 'Puce, véto, documents PDF', () => Views.goTreatmentsTab('identite')],
        ['📖', 'Carnet santé', 'Fiches de référence (maladies, voyages…)', () => Views.goTreatmentsTab('carnet')]
      ];
      root.appendChild(h('div.section-title', null, 'Le carnet de ' + (s.dogName || 'mon chien')));
      root.appendChild(h('div.card.flush', null, menu.map(([ic, title, sub, go]) =>
        h('div.row', { onClick: go }, [
          h('div.row-ic', null, ic),
          h('div.row-main', null, [h('strong', null, title), h('small', null, sub)]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ]))));

      // L'alimentation (ration, cycle, rotation, ingrédients) vit entièrement dans l'onglet Repas :
      // elle était auparavant éclatée entre Chien, Repas et Réglages — cycleWeeks était même
      // éditable ici ET dans Repas.

      // Mes chiens (changer / ajouter)
      root.appendChild(h('div.section-title', null, 'Mes chiens'));
      root.appendChild(dogsCard());
    }
  };

  // Âge lisible à partir de la date de naissance
  function dogAge(birth) {
    if (!birth) return '';
    const months = Math.max(0, Math.round(Store.daysBetween(birth, Store.todayISO()) / 30.44));
    if (months < 1) return 'nouveau-né';
    if (months < 24) return months + ' mois';
    return Math.floor(months / 12) + ' ans';
  }
})();
