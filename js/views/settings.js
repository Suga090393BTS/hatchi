/* ============================================================
   Vue Réglages — profil, ingrédients, sync, sauvegarde
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, money } = UI;

  const SCHEMA_SQL =
`-- À coller dans Supabase › SQL Editor, puis "Run"
create table if not exists public.hatchi_state (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.hatchi_state enable row level security;
create policy "hatchi_all" on public.hatchi_state
  for all using (true) with check (true);`;

  /* ---------- Ingrédients / prix ---------- */
  function openIngredientEditor(ing) {
    const isNew = !ing;
    let d = ing ? JSON.parse(JSON.stringify(ing)) : { name: '', category: 'viande', unit: 'g', price: 0 };
    const CATS = [['viande', '🥩 Viande'], ['abats', '🫀 Abats'], ['os', '🦴 Os'], ['entier', '🐔 Animal entier'], ['oeuf', '🥚 Œuf'], ['legume', '🥕 Légume'], ['autre', '📦 Autre']];
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Nom'), h('input.input', { value: d.name, onInput: (e) => d.name = e.target.value })]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Catégorie'),
          h('select.input', { onChange: (e) => d.category = e.target.value }, CATS.map(([v, l]) => h('option', { value: v, selected: v === d.category }, l)))]),
        h('div.field', null, [h('label', null, 'Unité'),
          h('select.input', { onChange: (e) => d.unit = e.target.value }, [['g', 'grammes'], ['piece', 'pièce']].map(([v, l]) => h('option', { value: v, selected: v === d.unit }, l)))])
      ]),
      h('div.field', null, [h('label', null, d.unit === 'piece' ? 'Prix à l’unité (€)' : 'Prix au kilo (€/kg)'),
        h('input.input', { type: 'number', step: '0.01', min: '0', value: d.price, onInput: (e) => d.price = +e.target.value || 0 })]),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => { if (await UI.confirm('Supprimer cet ingrédient ?', { danger: true, ok: 'Supprimer' })) { Store.removeIngredient(ing.id); UI.closeModal(); } } }, '🗑')
               : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.name.trim()) { UI.toast('Nom requis'); return; }
          if (isNew) Store.addIngredient(d); else Store.updateIngredient(ing.id, d);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouvel ingrédient' : 'Modifier l’ingrédient', body });
  }

  function openIngredientsList() {
    const body = h('div', null, [
      h('div.card.flush', null, Store.get().ingredients.map((ing) =>
        h('div.row', { onClick: () => { UI.closeModal(); setTimeout(() => openIngredientEditor(ing), 50); } }, [
          h('div.row-ic', null, ({ viande: '🥩', abats: '🫀', os: '🦴', entier: '🐔', oeuf: '🥚', legume: '🥕' })[ing.category] || '📦'),
          h('div.row-main', null, [h('strong', null, ing.name), h('small', null, ing.price ? money(ing.price) + (ing.unit === 'piece' ? '/u.' : '/kg') : 'Prix non défini')]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ]))),
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openIngredientEditor(null), 50); } }, '+ Nouvel ingrédient')
    ]);
    UI.modal({ title: 'Ingrédients & prix', body });
  }

  /* ---------- Morceaux (suggestions pour les achats) ---------- */
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
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Suggestions proposées à la saisie d’un achat (viandes & abats). Un morceau inconnu saisi dans un achat s’ajoute automatiquement ici.'),
      card,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openCutEditor(null), 50); } }, '+ Ajouter un morceau')
    ]);
    UI.modal({ title: 'Morceaux', body });
  }
  function openCutEditor(cut) {
    let name = cut || '';
    const body = h('div', null, [
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
    ]);
    UI.modal({ title: cut ? 'Modifier le morceau' : 'Nouveau morceau', body });
  }

  /* ---------- Pharmacie (fiches médicaments/produits) ---------- */
  function openPharmacyList() {
    const meds = Store.pharmacy();
    const card = h('div.card.flush');
    if (!meds.length) card.appendChild(h('div.empty', { style: 'padding:18px' }, 'Aucun produit'));
    meds.forEach((p) => {
      card.appendChild(h('div.row', { onClick: () => { UI.closeModal(); setTimeout(() => openPharmaEditor(p), 50); } }, [
        h('div.row-ic', null, '💊'),
        h('div.row-main', null, [h('strong', null, p.name), h('small', null, p.dose || 'Posologie non renseignée')]),
        h('div.row-end', null, h('span.muted', null, '›'))
      ]));
    });
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Tes fiches produits : posologie, principes actifs, remarques. Proposées dans la fiche du jour (💊) et dans les soins.'),
      card,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openPharmaEditor(null), 50); } }, '+ Ajouter un produit')
    ]);
    UI.modal({ title: '💊 Pharmacie', body });
  }
  function openPharmaEditor(p) {
    const isNew = !p;
    let d = p ? JSON.parse(JSON.stringify(p)) : { name: '', dose: '', actives: '', notes: '' };
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Nom du produit'), h('input.input', { value: d.name, placeholder: 'Ex. Drontal, Biseptine…', onInput: (e) => d.name = e.target.value })]),
      h('div.field', null, [h('label', null, 'Posologie'), h('input.input', { value: d.dose || '', placeholder: 'Ex. 1 comprimé et demi, tous les 3 mois', onInput: (e) => d.dose = e.target.value })]),
      h('div.field', null, [h('label', null, 'Principes actifs / composition'), h('input.input', { value: d.actives || '', placeholder: 'Ex. praziquantel, pyrantel…', onInput: (e) => d.actives = e.target.value })]),
      h('div.field', null, [h('label', null, 'Remarques'), h('textarea.input', { value: d.notes || '', placeholder: 'Précautions, où l\'acheter, ordonnance…', onInput: (e) => d.notes = e.target.value })]),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer « ' + p.name + ' » de la pharmacie ?', { danger: true, ok: 'Supprimer' })) { Store.removePharmaMed(p.id); UI.closeModal(); setTimeout(openPharmacyList, 50); }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => { UI.closeModal(); setTimeout(openPharmacyList, 50); } }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.name.trim()) { UI.toast('Nom requis'); return; }
          if (isNew) Store.addPharmaMed(d); else Store.updatePharmaMed(p.id, d);
          UI.closeModal(); setTimeout(openPharmacyList, 50);
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouveau produit' : 'Fiche produit', body });
  }

  /* ---------- Humeurs (liste du journal) ---------- */
  function openMoodsList() {
    const moods = Store.moods();
    const card = h('div.card.flush');
    if (!moods.length) card.appendChild(h('div.empty', { style: 'padding:18px' }, 'Aucune humeur'));
    moods.forEach((m) => {
      card.appendChild(h('div.row', null, [
        h('div.row-ic', null, /^\p{Extended_Pictographic}/u.test(m) ? m.split(' ')[0] : '🙂'),
        h('div.row-main', null, h('strong', null, m)),
        h('div.row-end', null, h('div.inline', { style: 'gap:4px' }, [
          h('button.btn.ghost.icon', { onClick: () => { UI.closeModal(); setTimeout(() => openMoodEditor(m), 50); } }, '✎'),
          h('button.delete-x', { onClick: async () => {
            if (await UI.confirm('Supprimer « ' + m + ' » de la liste ? (les journées déjà notées la gardent)', { danger: true, ok: 'Supprimer' })) {
              Store.removeMood(m); UI.closeModal(); setTimeout(openMoodsList, 50);
            }
          } }, '✕')
        ]))
      ]));
    });
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Humeurs/forme proposées dans la fiche du jour (journal). Astuce : commence par un emoji.'),
      card,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openMoodEditor(null), 50); } }, '+ Ajouter une humeur')
    ]);
    UI.modal({ title: 'Humeurs & forme', body });
  }
  function openMoodEditor(mood) {
    let name = mood || '';
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Humeur'), h('input.input', { value: name, placeholder: 'Ex. 😰 Stressé', onInput: (e) => name = e.target.value })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => { UI.closeModal(); setTimeout(openMoodsList, 50); } }, 'Annuler'),
        h('button.btn', { onClick: () => {
          if (!name.trim()) { UI.toast('Nom requis'); return; }
          if (mood) Store.renameMood(mood, name);
          else if (!Store.addMood(name)) { UI.toast('Cette humeur existe déjà'); return; }
          UI.closeModal(); setTimeout(openMoodsList, 50);
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: mood ? 'Modifier l\'humeur' : 'Nouvelle humeur', body });
  }

  /* ---------- Sync ---------- */
  function syncCard() {
    const s = Store.get().settings;
    const connected = !!(s.supabaseUrl && s.supabaseKey);
    let url = s.supabaseUrl, key = s.supabaseKey, space = s.spaceId || 'hatchi';

    return h('div.card', null, [
      h('div.card-head', null, [h('h3', null, '☁️ Synchronisation'),
        h('span', { class: 'badge ' + (connected ? 'ok' : 'info') }, connected ? Store.syncStatus() === 'synced' ? 'Connecté' : Store.syncStatus() : 'Désactivée')]),
      h('p.muted.small', { style: 'margin:0 0 12px' }, 'Pour synchroniser téléphone + ordinateur, créez un projet gratuit Supabase, exécutez le script SQL ci-dessous, puis collez l’URL et la clé « anon ».'),
      h('div.field', null, [h('label', null, 'Project URL'), h('input.input', { value: url, placeholder: 'https://xxxx.supabase.co', onInput: (e) => url = e.target.value.trim() })]),
      h('div.field', null, [h('label', null, 'Clé anon (public)'), h('input.input', { value: key, placeholder: 'eyJhbGci…', onInput: (e) => key = e.target.value.trim() })]),
      h('div.field', null, [h('label', null, 'Identifiant d’espace (partagé entre vos appareils)'), h('input.input', { value: space, onInput: (e) => space = e.target.value.trim() || 'hatchi' })]),
      h('div.inline', null, [
        h('button.btn', { style: 'flex:1', onClick: async () => {
          if (!url || !key) { UI.toast('URL et clé requises'); return; }
          UI.toast('Connexion…');
          try {
            await Store.testConnection(url, key, space);
            Store.updateSettings({ supabaseUrl: url, supabaseKey: key, spaceId: space });
            await Store.initSync();
            UI.toast('Synchronisation activée ✓');
          } catch (e) { UI.toast('Échec : ' + (e.message || 'vérifiez la table/clé')); }
        } }, connected ? 'Reconnecter' : 'Activer la sync'),
        connected ? h('button.btn.subtle', { onClick: async () => { UI.toast('Récupération…'); try { await Store.forcePull(); UI.toast('À jour ✓'); } catch (e) { UI.toast('Erreur'); } } }, '↓ Tirer') : null,
        connected ? h('button.btn.subtle', { onClick: async () => { await Store.forcePush(); UI.toast('Envoyé ✓'); } }, '↑ Pousser') : null
      ]),
      h('details', { style: 'margin-top:12px' }, [
        h('summary', { style: 'cursor:pointer;font-weight:700;font-size:14px;color:var(--green)' }, 'Voir le script SQL à exécuter'),
        h('pre', { style: 'background:#1e2a26;color:#d6efe5;padding:12px;border-radius:10px;overflow:auto;font-size:12px;margin-top:8px' }, SCHEMA_SQL),
        h('button.btn.subtle.sm', { onClick: () => { navigator.clipboard && navigator.clipboard.writeText(SCHEMA_SQL); UI.toast('SQL copié'); } }, '📋 Copier le SQL')
      ]),
      connected ? h('button.linkbtn', { style: 'color:var(--red);margin-top:8px', onClick: () => { Store.updateSettings({ supabaseUrl: '', supabaseKey: '' }); UI.toast('Sync désactivée'); } }, 'Désactiver la synchronisation') : null
    ]);
  }

  Views.settings = {
    render(root) {
      const s = Store.get().settings;

      // Profil
      root.appendChild(h('div.section-title', null, 'Profil'));
      root.appendChild(h('div.card', null, [
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Nom du chien'), h('input.input', { value: s.dogName || '', onChange: (e) => Store.updateSettings({ dogName: e.target.value }) })]),
          h('div.field', null, [h('label', null, 'Date de naissance'), h('input.input', { type: 'date', value: s.dogBirthdate || '', onChange: (e) => Store.updateSettings({ dogBirthdate: e.target.value }) })])
        ])
      ]));

      // Personnes
      root.appendChild(h('div.section-title', null, 'Personnes (qui s’occupe d’Hatchi)'));
      root.appendChild(peopleCard());

      // Rotation
      root.appendChild(h('div.section-title', null, 'Rotation des repas'));
      root.appendChild(h('div.card', null, [
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Lundi de départ du cycle'),
            h('input.input', { type: 'date', value: s.anchorMonday || '', onChange: (e) => Store.updateSettings({ anchorMonday: Store.mondayOf(e.target.value) }) })]),
          h('div.field', null, [h('label', null, 'Semaines dans le cycle'),
            h('select.input', { onChange: (e) => Store.updateSettings({ cycleWeeks: +e.target.value }) }, [1, 2, 3, 4].map((n) => h('option', { value: n, selected: n === (s.cycleWeeks || 1) }, n)))])
        ]),
        h('p.muted.small', { style: 'margin:0 4px' }, 'Sert à calculer automatiquement le repas du jour. Modifiez la rotation dans l’onglet Repas.')
      ]));

      // Ration & stock
      root.appendChild(h('div.section-title', null, 'Ration & stock'));
      root.appendChild(h('div.card', null, [
        h('div.grid2', null, [
          h('div.field', null, [h('label', null, 'Ration (% du poids / jour)'),
            h('input.input', { type: 'number', step: '0.1', min: '1', max: '5', value: s.rationPct || 2.5, onChange: (e) => Store.updateSettings({ rationPct: +e.target.value || 2.5 }) })]),
          h('div.field', null, [h('label', null, 'Alerte stock (jours)'),
            h('input.input', { type: 'number', min: '1', value: s.stockAlertDays || 3, onChange: (e) => Store.updateSettings({ stockAlertDays: +e.target.value || 3 }) })])
        ]),
        h('p.muted.small', { style: 'margin:0 4px' }, 'Chien adulte : ~2–3 %. Chiot ou très actif : plus. La ration s’affiche dans « Aujourd’hui ».')
      ]));

      // Ingrédients
      root.appendChild(h('div.section-title', null, 'Ingrédients & prix'));
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('strong', null, Store.get().ingredients.length + ' ingrédients'), h('div.muted.small', null, 'Catalogue + prix pour le budget courses')]),
          h('button.btn.ghost.sm', { onClick: openIngredientsList }, 'Gérer')
        ])
      ]));

      // Morceaux
      root.appendChild(h('div.section-title', null, 'Morceaux (viandes & abats)'));
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('strong', null, Store.cuts().length + ' morceaux'), h('div.muted.small', null, 'Suggestions à la saisie d’un achat')]),
          h('button.btn.ghost.sm', { onClick: openCutsList }, 'Gérer')
        ])
      ]));

      // Pharmacie
      root.appendChild(h('div.section-title', null, 'Pharmacie'));
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('strong', null, Store.pharmacy().length + ' produits'), h('div.muted.small', null, 'Posologies & principes actifs — proposés dans la fiche du jour et les soins')]),
          h('button.btn.ghost.sm', { onClick: openPharmacyList }, 'Gérer')
        ])
      ]));

      // Humeurs
      root.appendChild(h('div.section-title', null, 'Humeurs & forme (journal)'));
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('strong', null, Store.moods().length + ' humeurs'), h('div.muted.small', null, 'Proposées dans la fiche du jour')]),
          h('button.btn.ghost.sm', { onClick: openMoodsList }, 'Gérer')
        ])
      ]));

      // Sync
      root.appendChild(h('div.section-title', null, 'Multi-appareils'));
      root.appendChild(syncCard());

      // Notifications
      root.appendChild(h('div.section-title', null, 'Rappels'));
      root.appendChild(notificationsCard());

      // Sauvegarde
      root.appendChild(h('div.section-title', null, 'Sauvegarde'));
      root.appendChild(h('div.card', null, [
        h('div.inline', null, [
          h('button.btn.subtle', { style: 'flex:1', onClick: exportBackup }, '⬇️ Exporter'),
          h('button.btn.subtle', { style: 'flex:1', onClick: importBackup }, '⬆️ Importer')
        ]),
        h('div.divider'),
        h('button.linkbtn', { style: 'color:var(--red)', onClick: async () => {
          if (await UI.confirm('Effacer toutes les données locales ? (la sync n’est pas touchée)', { danger: true, ok: 'Tout effacer' })) { Store.resetAll(); UI.toast('Réinitialisé'); App.go('today'); }
        } }, 'Réinitialiser l’application')
      ]));

      // Mise à jour
      root.appendChild(h('div.section-title', null, 'Mise à jour'));
      root.appendChild(h('div.card', null, [
        h('p.muted.small', { style: 'margin:0 0 10px' }, 'Si l’app semble en retard sur une nouveauté, forcez la mise à jour (les données ne sont pas touchées).'),
        h('button.btn.subtle.block', { onClick: () => { location.href = 'maj.html'; } }, '🔄 Forcer la mise à jour')
      ]));

      const footer = h('p.muted.small.center', { style: 'margin-top:18px' }, 'Hatchi · données stockées sur votre appareil' + (s.supabaseUrl ? ' + Supabase' : ''));
      // Affiche la version réellement chargée (nom du cache du service worker)
      if (window.caches) {
        caches.keys().then((keys) => {
          const nums = keys.map((k) => { const m = k.match(/^hatchi-v(\d+)$/); return m ? +m[1] : 0; });
          const v = Math.max.apply(null, nums.concat(0));
          if (v) footer.textContent += ' · version v' + v;
        }).catch(() => {});
      }
      root.appendChild(footer);
    }
  };

  function peopleCard() {
    const people = Store.get().people;
    const card = h('div.card.flush');
    if (!people.length) card.appendChild(h('div.empty', { style: 'padding:18px' }, 'Aucune personne'));
    people.forEach((p) => {
      card.appendChild(h('div.row', null, [
        h('div.row-ic', null, '👤'),
        h('div.row-main', null, h('strong', null, p.name)),
        h('div.row-end', null, h('div.inline', { style: 'gap:4px' }, [
          h('button.btn.ghost.icon', { onClick: () => openPersonEditor(p) }, '✎'),
          h('button.delete-x', { onClick: async () => { if (await UI.confirm('Supprimer ' + p.name + ' ?', { danger: true, ok: 'Supprimer' })) Store.removePerson(p.id); } }, '✕')
        ]))
      ]));
    });
    const wrap = h('div', null, [card, h('button.btn.block', { style: 'margin-top:8px', onClick: () => openPersonEditor(null) }, '+ Ajouter une personne')]);
    return wrap;
  }
  function openPersonEditor(p) {
    let name = p ? p.name : '';
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Prénom'), h('input.input', { value: name, placeholder: 'Ex. Flo', onInput: (e) => name = e.target.value })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => { if (!name.trim()) { UI.toast('Prénom requis'); return; } if (p) Store.updatePerson(p.id, name.trim()); else Store.addPerson(name.trim()); UI.closeModal(); } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: p ? 'Modifier' : 'Nouvelle personne', body });
  }

  function notificationsCard() {
    const supported = 'Notification' in window;
    const perm = supported ? Notification.permission : 'unsupported';
    const statusBadge =
      perm === 'granted' ? h('span.badge.ok', null, 'Activées') :
      perm === 'denied' ? h('span.badge.due', null, 'Bloquées') :
      perm === 'unsupported' ? h('span.badge.info', null, 'Non supporté') :
      h('span.badge.info', null, 'Désactivées');

    return h('div.card', null, [
      h('div.card-head', null, [h('h3', null, '🔔 Notifications'), statusBadge]),
      h('p.muted.small', { style: 'margin:0 0 12px' }, 'Reçoit une alerte des soins en retard à l’ouverture de l’app (une fois par jour). Pour des rappels fiables même app fermée — surtout sur iPhone — utilisez « Ajouter au calendrier » sur chaque soin (onglet Soins).'),
      perm === 'default' ? h('button.btn.block', { onClick: async () => {
        try { const r = await Notification.requestPermission(); UI.toast(r === 'granted' ? 'Notifications activées ✓' : 'Refusé'); App.rerender(); } catch (e) { UI.toast('Erreur'); }
      } }, 'Activer les notifications') : null,
      perm === 'granted' ? h('button.btn.subtle.block', { onClick: () => {
        new Notification('🐾 ' + (Store.get().settings.dogName || 'Hatchi'), { body: 'Les notifications fonctionnent !', icon: 'icon.svg' });
      } }, 'Tester une notification') : null,
      perm === 'denied' ? h('p.muted.small', { style: 'margin:0' }, 'Réautorisez les notifications pour ce site dans les réglages de votre navigateur.') : null
    ]);
  }

  function exportBackup() {
    const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hatchi-sauvegarde-${Store.todayISO()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importBackup() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = async () => {
        try { Store.importJSON(r.result); UI.toast('Importé ✓'); App.go('today'); }
        catch (e) { UI.toast('Fichier invalide'); }
      };
      r.readAsText(f);
    };
    inp.click();
  }
})();
