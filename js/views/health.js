/* ============================================================
   Vue Santé — vaccins, identité (puce, papiers), carnet de référence
   Sections affichées dans l'onglet Soins (voir treatments.js).
   Global: window.Views.health
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, fmtShortYear, relDays } = UI;

  /* ---------- Fichiers : redimensionnement & lecture ---------- */
  function resizeImage(file, maxDim, quality, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const r = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * r); height = Math.round(height * r);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function readAsDataURL(file, cb) {
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  }
  // Ouvre un document stocké en dataURL dans un nouvel onglet (via blob, iOS-friendly)
  function openDoc(doc) {
    try {
      const parts = doc.dataURL.split(',');
      const mime = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
      const bin = atob(parts[1]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([arr], { type: mime }));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { UI.toast('Impossible d\'ouvrir le document'); }
  }
  const sizeLabel = (bytes) => bytes > 1024 * 1024 ? (bytes / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(bytes / 1024)) + ' Ko';

  /* ============================ VACCINS ============================ */
  const VACC_NAMES = ['CHPPiL (Carré, Hépatite, Parvo, Parainfluenza, Lepto)', 'Leptospirose (rappel annuel)',
    'Rage', 'Toux du chenil (Bordetella)', 'Piroplasmose', 'Leishmaniose', 'Maladie de Lyme'];

  function openVaccEditor(v) {
    const isNew = !v;
    const vet = Store.get().vetCurrent;
    let d = v ? JSON.parse(JSON.stringify(v)) : { name: '', date: Store.todayISO(), booster: '', vet: vet.name || '', notes: '' };
    const body = h('div', null, [
      h('datalist', { id: 'hatchi-vaccs' }, VACC_NAMES.map((n) => h('option', { value: n }))),
      h('div.field', null, [h('label', null, 'Vaccin'),
        h('input.input', { value: d.name, list: 'hatchi-vaccs', placeholder: 'Ex. CHPPiL, Rage…', onInput: (e) => d.name = e.target.value })]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Fait le'), h('input.input', { type: 'date', value: d.date || '', onChange: (e) => d.date = e.target.value })]),
        h('div.field', null, [h('label', null, 'Rappel prévu le'), h('input.input', { type: 'date', value: d.booster || '', onChange: (e) => d.booster = e.target.value })])
      ]),
      h('div.field', null, [h('label', null, 'Vétérinaire'), h('input.input', { value: d.vet || '', placeholder: 'Qui a vacciné', onInput: (e) => d.vet = e.target.value })]),
      h('div.field', null, [h('label', null, 'Notes'), h('textarea.input', { value: d.notes || '', placeholder: 'N° de lot, réaction…', onInput: (e) => d.notes = e.target.value })]),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer cette vaccination ?', { danger: true, ok: 'Supprimer' })) { Store.removeVaccination(v.id); UI.closeModal(); }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.name.trim()) { UI.toast('Nom du vaccin requis'); return; }
          if (isNew) Store.addVaccination(d); else Store.updateVaccination(v.id, d);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouvelle vaccination' : 'Modifier la vaccination', body });
  }

  function vaccinsView(root) {
    const vet = Store.get().vetCurrent;
    root.appendChild(h('div.card', null, [
      h('div.inline', { style: 'justify-content:space-between' }, [
        h('div', null, [
          h('strong', null, '🏥 ' + (vet.name || 'Vétérinaire non renseigné')),
          h('div.muted.small', null, vet.name ? (vet.phone || 'Téléphone non renseigné') : 'Renseignez votre véto dans l\'onglet Identité')
        ]),
        vet.phone ? h('a.btn.sm', { href: 'tel:' + vet.phone.replace(/[^+0-9]/g, ''), style: 'text-decoration:none' }, '📞 Appeler') : null
      ])
    ]));

    const vaccs = Store.vaccinationsSorted();
    const today = Store.todayISO();
    const boosterInfo = (v) => {
      if (!v.booster) return null;
      const days = Store.daysBetween(today, v.booster);
      if (days < 0) return { badge: h('span.badge.due', null, 'Rappel en retard'), days };
      if (days <= 30) return { badge: h('span.badge.soon', null, 'Rappel ' + relDays(days)), days };
      return { badge: h('span.badge.info', null, 'Rappel ' + fmtShortYear(v.booster)), days };
    };
    const alerts = vaccs.filter((v) => { const b = boosterInfo(v); return b && b.days <= 30; });
    if (alerts.length) {
      root.appendChild(h('div.card', { style: 'background:var(--amber-100);border-color:#e8d5ae' }, [
        h('div.inline', null, [h('span', { style: 'font-size:22px' }, '💉'),
          h('div', null, [h('strong', null, 'Rappel' + (alerts.length > 1 ? 's' : '') + ' à prévoir'),
            h('div.small', null, alerts.map((v) => v.name + ' (' + fmtShortYear(v.booster) + ')').join(', '))])])
      ]));
    }

    if (!vaccs.length) {
      root.appendChild(h('div.card', null, UI.emptyState('💉', 'Aucune vaccination enregistrée', 'Reportez ici le carnet de santé : vaccins déjà faits et rappels prévus.')));
    } else {
      root.appendChild(h('div.card.flush', null, vaccs.map((v) => {
        const b = boosterInfo(v);
        return h('div.row', { onClick: () => openVaccEditor(v) }, [
          h('div.row-ic', null, '💉'),
          h('div.row-main', null, [
            h('strong', null, v.name),
            h('small', null, ['fait le ' + fmtShortYear(v.date), v.vet ? 'par ' + v.vet : null].filter(Boolean).join(' · '))
          ]),
          h('div.row-end', null, b ? b.badge : h('span.muted', null, '›'))
        ]);
      })));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openVaccEditor(null) }, '+ Ajouter une vaccination'));
  }

  /* ============================ IDENTITÉ ============================ */
  function chipPhotoField() {
    const idy = Store.get().identity;
    const wrap = h('div.field');
    wrap.appendChild(h('label', null, 'Photo du code-barres de la puce'));
    if (idy.chipPhoto) {
      wrap.appendChild(h('div', { style: 'position:relative' }, [
        h('img', { src: idy.chipPhoto, style: 'max-width:100%;max-height:180px;border-radius:12px;border:1px solid var(--line)', onClick: () => openDoc({ dataURL: idy.chipPhoto }) }),
        h('button.delete-x', { style: 'position:absolute;top:4px;right:4px;background:rgba(255,255,255,.9);border-radius:50%', onClick: async () => {
          if (await UI.confirm('Supprimer la photo du code-barres ?', { danger: true, ok: 'Supprimer' })) Store.updateIdentity({ chipPhoto: '' });
        } }, '✕')
      ]));
    } else {
      const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none', onChange: (e) => {
        const f = e.target.files[0];
        if (f) resizeImage(f, 1600, 0.85, (url) => { Store.updateIdentity({ chipPhoto: url }); UI.toast('Photo enregistrée ✓'); });
      } });
      wrap.appendChild(inp);
      wrap.appendChild(h('button.btn.subtle.block', { onClick: () => inp.click() }, '📷 Prendre / choisir la photo'));
    }
    return wrap;
  }

  function identityView(root) {
    const idy = Store.get().identity;
    const vet = Store.get().vetCurrent;

    root.appendChild(h('div.section-title', null, 'Identification'));
    root.appendChild(h('div.card', null, [
      h('div.field', null, [h('label', null, 'Numéro de puce (15 chiffres)'),
        h('input.input', { value: idy.chipNumber || '', inputmode: 'numeric', placeholder: '250 26…', onChange: (e) => Store.updateIdentity({ chipNumber: e.target.value.trim() }) })]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Identifié le'), h('input.input', { type: 'date', value: idy.identDate || '', onChange: (e) => Store.updateIdentity({ identDate: e.target.value }) })]),
        h('div.field', null, [h('label', null, 'Par (vétérinaire)'), h('input.input', { value: idy.identVet || '', placeholder: 'Véto de l\'identification', onChange: (e) => Store.updateIdentity({ identVet: e.target.value }) })])
      ]),
      chipPhotoField()
    ]));

    root.appendChild(h('div.section-title', null, 'Vétérinaire actuel'));
    root.appendChild(h('div.card', null, [
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Nom / clinique'), h('input.input', { value: vet.name || '', placeholder: 'Clinique des 4 pattes', onChange: (e) => Store.updateVet({ name: e.target.value }) })]),
        h('div.field', null, [h('label', null, 'Téléphone'), h('input.input', { type: 'tel', value: vet.phone || '', placeholder: '04…', onChange: (e) => Store.updateVet({ phone: e.target.value }) })])
      ]),
      h('div.field', null, [h('label', null, 'Adresse'), h('input.input', { value: vet.address || '', placeholder: 'Adresse de la clinique', onChange: (e) => Store.updateVet({ address: e.target.value }) })])
    ]));

    root.appendChild(h('div.section-title', null, 'Papiers du chien (PDF ou photos)'));
    const docs = Store.get().documents;
    if (!docs.length) {
      root.appendChild(h('div.card', null, UI.emptyState('📄', 'Aucun document', 'Carte d\'identification I-CAD, certificat, passeport… gardez tout sous la main.')));
    } else {
      root.appendChild(h('div.card.flush', null, docs.map((d) =>
        h('div.row', null, [
          h('div.row-ic', null, d.mime === 'application/pdf' ? '📄' : '🖼️'),
          h('div.row-main', { onClick: () => openDoc(d) }, [
            h('strong', null, d.name),
            h('small', null, [sizeLabel(d.size || d.dataURL.length), 'ajouté le ' + fmtShortYear(d.addedAt)].join(' · '))
          ]),
          h('div.row-end', null, h('button.delete-x', { onClick: async () => {
            if (await UI.confirm('Supprimer « ' + d.name + ' » ?', { danger: true, ok: 'Supprimer' })) Store.removeDocument(d.id);
          } }, '✕'))
        ]))));
    }
    const docInput = h('input', { type: 'file', accept: 'application/pdf,image/*', style: 'display:none', onChange: (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.type === 'application/pdf') {
        if (f.size > 3 * 1024 * 1024) { UI.toast('PDF trop lourd (max 3 Mo) — compressez-le d\'abord'); return; }
        readAsDataURL(f, (url) => { Store.addDocument({ name: f.name, mime: f.type, size: f.size, dataURL: url }); UI.toast('Document ajouté ✓'); });
      } else {
        resizeImage(f, 1600, 0.85, (url) => {
          Store.addDocument({ name: f.name || 'photo.jpg', mime: 'image/jpeg', size: Math.round(url.length * 0.75), dataURL: url });
          UI.toast('Document ajouté ✓');
        });
      }
      e.target.value = '';
    } });
    root.appendChild(docInput);
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => docInput.click() }, '+ Ajouter un document'));
  }

  /* ============================ CARNET ============================ */
  function openPageView(p) {
    const body = h('div', null, [
      h('div', { style: 'white-space:pre-wrap;line-height:1.55;font-size:14.5px;max-height:55vh;overflow-y:auto;padding:0 2px' }, p.content || 'Fiche vide.'),
      h('p.muted.small', { style: 'margin:10px 4px 0' }, 'Mis à jour le ' + fmtShortYear(p.updatedAt)),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Fermer'),
        h('button.btn', { onClick: () => { UI.closeModal(); setTimeout(() => openPageEditor(p), 50); } }, '✎ Modifier')
      ])
    ]);
    UI.modal({ title: (p.icon || '📄') + ' ' + p.title, body });
  }

  function openPageEditor(p) {
    const isNew = !p;
    let d = p ? JSON.parse(JSON.stringify(p)) : { icon: '📄', title: '', content: '' };
    const body = h('div', null, [
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Icône (emoji)'), h('input.input', { value: d.icon || '', placeholder: '📄', onInput: (e) => d.icon = e.target.value })]),
        h('div.field', null, [h('label', null, 'Titre'), h('input.input', { value: d.title, placeholder: 'Ex. Piroplasmose', onInput: (e) => d.title = e.target.value })])
      ]),
      h('div.field', null, [h('label', null, 'Contenu'),
        h('textarea.input', { value: d.content || '', rows: 12, style: 'min-height:220px', placeholder: 'Votre fiche de référence…', onInput: (e) => d.content = e.target.value })]),
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => {
          if (await UI.confirm('Supprimer cette fiche ?', { danger: true, ok: 'Supprimer' })) { Store.removeHealthPage(p.id); UI.closeModal(); }
        } }, '🗑') : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.title.trim()) { UI.toast('Donnez un titre'); return; }
          if (isNew) Store.addHealthPage(d); else Store.updateHealthPage(p.id, d);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: isNew ? 'Nouvelle fiche' : 'Modifier la fiche', body });
  }

  function carnetView(root) {
    root.appendChild(h('p.muted.small', { style: 'margin:0 4px 10px' },
      'Fiches de référence type carnet de santé — appuyez pour lire, modifiez-les ou ajoutez les vôtres.'));
    const pages = Store.get().healthPages;
    if (!pages.length) {
      root.appendChild(h('div.card', null, UI.emptyState('📖', 'Aucune fiche', 'Créez vos fiches de référence (maladies, voyages, parasites…).')));
    } else {
      root.appendChild(h('div.card.flush', null, pages.map((p) =>
        h('div.row', { onClick: () => openPageView(p) }, [
          h('div.row-ic', null, p.icon || '📄'),
          h('div.row-main', null, [
            h('strong', null, p.title),
            h('small', null, (p.content || '').split('\n')[0].slice(0, 70))
          ]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ]))));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openPageEditor(null) }, '+ Nouvelle fiche'));
  }

  Views.health = { vaccinsView, identityView, carnetView };
})();
