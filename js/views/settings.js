/* ============================================================
   Vue Réglages — profil, ingrédients, sync, sauvegarde
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h } = UI;

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

  /* ---------- Intitulés « choses à faire » (suggestions) ---------- */
  function openTodoTextsList() {
    const texts = Store.todoTexts();
    const card = h('div.card.flush');
    if (!texts.length) card.appendChild(h('div.empty', { style: 'padding:18px' }, 'Aucun intitulé — ils s\'ajoutent tout seuls quand tu crées une tâche.'));
    texts.forEach((t) => {
      card.appendChild(h('div.row', null, [
        h('div.row-ic', null, '📝'),
        h('div.row-main', null, h('strong', null, t)),
        h('div.row-end', null, h('div.inline', { style: 'gap:4px' }, [
          h('button.btn.ghost.icon', { onClick: () => { UI.closeModal(); setTimeout(() => openTodoTextEditor(t), 50); } }, '✎'),
          h('button.delete-x', { onClick: async () => {
            if (await UI.confirm('Retirer « ' + t + ' » des suggestions ?', { danger: true, ok: 'Retirer' })) {
              Store.removeTodoText(t); UI.closeModal(); setTimeout(openTodoTextsList, 50);
            }
          } }, '✕')
        ]))
      ]));
    });
    const body = h('div', null, [
      h('p.muted.small', { style: 'margin:0 0 10px' }, 'Chaque tâche créée sur « Aujourd\'hui » enregistre son intitulé ici — ils te sont resuggérés pour garder les mêmes libellés.'),
      card,
      h('button.btn.block', { style: 'margin-top:10px', onClick: () => { UI.closeModal(); setTimeout(() => openTodoTextEditor(null), 50); } }, '+ Ajouter un intitulé')
    ]);
    UI.modal({ title: '📝 Choses à faire', body });
  }
  function openTodoTextEditor(text) {
    let name = text || '';
    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Intitulé'), h('input.input', { value: name, placeholder: 'Ex. Prendre RDV véto', onInput: (e) => name = e.target.value })]),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => { UI.closeModal(); setTimeout(openTodoTextsList, 50); } }, 'Annuler'),
        h('button.btn', { onClick: () => {
          if (!name.trim()) { UI.toast('Écris l\'intitulé'); return; }
          if (text) Store.renameTodoText(text, name);
          else if (!Store.addTodoText(name)) { UI.toast('Cet intitulé existe déjà'); return; }
          UI.closeModal(); setTimeout(openTodoTextsList, 50);
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: text ? 'Modifier l\'intitulé' : 'Nouvel intitulé', body });
  }

  /* ---------- Sync ---------- */
  // Restauration en un geste depuis les sauvegardes automatiques du cloud (aucun fichier à gérer)
  async function openCloudBackups() {
    UI.toast('Chargement des sauvegardes…');
    let list;
    try { list = await Store.backups(); }
    catch (e) { UI.toast('Erreur : ' + (e.message || 'lecture impossible')); return; }
    if (!list.length) { UI.toast('Aucune sauvegarde automatique pour le moment'); return; }
    const rows = list.map((b) => h('div.inline', { style: 'justify-content:space-between;gap:10px;padding:9px 2px;border-bottom:1px solid var(--line)' }, [
      h('div', null, [h('strong', null, UI.fmtShortYear ? UI.fmtShortYear(b.day) : b.day), h('div.muted.small', null, 'sauvegarde automatique')]),
      h('button.btn.sm', { onClick: () => confirmRestore(b) }, 'Restaurer')
    ]));
    UI.modal({ title: '↺ Sauvegardes du cloud', body: h('div', null, [
      h('p.muted.small', { style: 'margin:0 4px 10px' }, 'Choisis une date pour remettre tes données telles qu’elles étaient ce jour-là. Tes appareils se mettront à jour automatiquement.'),
      h('div', null, rows)
    ]) });
  }
  function confirmRestore(b) {
    const body = h('div', null, [
      h('p', { style: 'margin:0 4px 14px' }, 'Restaurer la sauvegarde du ' + b.day + ' ? Tes données actuelles seront remplacées par celles de cette date.'),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: async () => {
          UI.toast('Restauration…');
          try { await Store.restoreBackup(b.id); UI.closeModal(); UI.toast('Restauré ✓'); App.go('today'); }
          catch (e) { UI.toast('Échec : ' + (e.message || 'réessaie')); }
        } }, 'Restaurer')
      ])
    ]);
    UI.modal({ title: 'Confirmer la restauration', body });
  }

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
      connected ? h('p.muted.small', { style: 'margin:10px 4px 4px' }, '🛡️ Tes données sont sauvegardées automatiquement dans le cloud, chaque jour (14 derniers jours). Rien à exporter à la main.') : null,
      connected ? h('button.btn.subtle.sm', { style: 'margin-top:4px', onClick: openCloudBackups }, '↺ Restaurer une sauvegarde') : null,
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

      // Réglages n'a plus d'onglet : on y entre par le ⚙️ du bandeau, on en sort par ce retour.
      root.appendChild(UI.subHead('Réglages', () => App.go('today')));

      // Personnes
      root.appendChild(h('div.section-title', null, 'Personnes (qui s’occupe des chiens)'));
      root.appendChild(peopleCard());

      // Intitulés des choses à faire
      root.appendChild(h('div.section-title', null, 'Choses à faire (intitulés)'));
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between' }, [
          h('div', null, [h('strong', null, Store.todoTexts().length + ' intitulé' + (Store.todoTexts().length > 1 ? 's' : '')), h('div.muted.small', null, 'Suggestions à la saisie d\'une tâche')]),
          h('button.btn.ghost.sm', { onClick: openTodoTextsList }, 'Gérer')
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
      h('p.muted.small', { style: 'margin:0 0 12px' }, 'Reçoit une alerte des soins en retard à l’ouverture de l’app (une fois par jour). Pour des rappels fiables même app fermée — surtout sur iPhone — utilisez « Ajouter au calendrier » sur chaque soin (Chien › Soins).'),
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
