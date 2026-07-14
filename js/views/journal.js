/* ============================================================
   Vue Journal — suivi quotidien + historique
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, fmtLong, fmtShort } = UI;

  const SORTIES = [
    { key: 'ville', label: 'Ville', ic: '🏙️' },
    { key: 'foret', label: 'Forêt', ic: '🌲' },
    { key: 'educ', label: 'Éduc', ic: '🎓' },
    { key: 'veto', label: 'Véto', ic: '🏥' }
  ];
  const SELLES = ['Normales', 'Molles', 'Liquides', 'Dures', 'Aucune'];

  let selectedDate = Store.todayISO();

  function dayCard(iso) {
    const e = Store.dayEntry(iso);
    const tags = [];
    if (e.repasMatin) tags.push('🌅');
    if (e.repasSoir) tags.push('🌙');
    SORTIES.forEach((s) => { if (e.sorties && e.sorties[s.key]) tags.push(s.ic); });
    if (e.meds && e.meds.length) tags.push('💊');
    if (e.photo) tags.push('📷');
    const hasContent = e.notes || e.selles || e.humeur || tags.length || (e.soins && e.soins.length) || e.photo || (e.meds && e.meds.length);
    return h('div.row', { onClick: () => openEditor(iso) }, [
      h('div.row-ic', null, new Date(iso + 'T00:00:00').getDate()),
      h('div.row-main', null, [
        h('strong', null, fmtLong(iso)),
        h('small', null, hasContent
          ? [e.humeur ? e.humeur.split(' ')[0] + ' ' : '', e.selles ? '💩 ' + e.selles + '  ' : '', e.notes ? e.notes.slice(0, 40) : ''].join('')
          : 'Rien noté')
      ]),
      h('div.row-end', null, h('span.small', null, tags.join(' ')))
    ]);
  }

  // Activités = sorties + qui s'en occupe (fusionnées)
  const ACTS = [
    { key: 'ville', label: '🏙️ Ville' },
    { key: 'foret', label: '🌲 Forêt' },
    { key: 'educ', label: '🎓 Éducateur' },
    { key: 'veto', label: '🏥 Véto' }
  ];

  function activitiesSection(draft) {
    const people = Store.get().people;
    const wrap = h('div.field', null, [h('label', null, 'Sorties & activités')]);
    ACTS.forEach((act) => {
      draft.sorties = draft.sorties || {};
      draft.who = draft.who || {};
      draft.who[act.key] = draft.who[act.key] || [];
      const sel = draft.who[act.key];

      const peopleRow = people.length ? h('div.chip-row', { style: 'margin:6px 0 0 10px' + (draft.sorties[act.key] ? '' : ';display:none') },
        people.map((p) => {
          const c = h('button', { class: 'chip' + (sel.includes(p.id) ? ' on' : ''), onClick: () => {
            const i = sel.indexOf(p.id);
            if (i >= 0) sel.splice(i, 1);
            else { sel.push(p.id); draft.sorties[act.key] = true; actChip.classList.add('on'); peopleRow.style.display = ''; }
            c.classList.toggle('on');
          } }, p.name);
          return c;
        })) : null;

      const actChip = h('button', { class: 'chip' + (draft.sorties[act.key] ? ' on' : ''), onClick: () => {
        draft.sorties[act.key] = !draft.sorties[act.key];
        actChip.classList.toggle('on', draft.sorties[act.key]);
        if (peopleRow) peopleRow.style.display = draft.sorties[act.key] ? '' : 'none';
      } }, act.label);

      wrap.appendChild(h('div', { style: 'margin-bottom:10px' }, [actChip, peopleRow]));
    });
    if (!people.length) wrap.appendChild(h('div.muted.small', { style: 'margin-top:4px' }, ['Astuce : ajoute des personnes dans ', h('strong', null, 'Réglages'), ' pour noter qui promène Hatchi.']));
    return wrap;
  }

  function openEditor(iso) {
    const e = Store.dayEntry(iso);
    let draft = JSON.parse(JSON.stringify(e));
    draft.sorties = draft.sorties || {};
    draft.who = draft.who || {};

    const body = h('div', null, [
      h('div.field', null, [
        h('label', null, 'Repas'),
        h('div.chip-row', null, [
          chip('🌅 Matin donné', draft.repasMatin, () => draft.repasMatin = !draft.repasMatin),
          chip('🌙 Soir donné', draft.repasSoir, () => draft.repasSoir = !draft.repasSoir)
        ])
      ]),
      h('div.field', null, [
        h('label', null, 'Selles'),
        h('div.chip-row', null, SELLES.map((v) => chip(v, draft.selles === v, () => draft.selles = (draft.selles === v ? '' : v))))
      ]),
      humeurField(draft),
      medsField(draft),
      activitiesSection(draft),
      h('div.field', null, [h('label', null, 'Température (°C)'), h('input.input', { type: 'number', step: '0.1', value: draft.temp || '', onInput: (ev) => draft.temp = ev.target.value })]),
      h('div.field', null, [
        h('label', null, 'Notes'),
        h('textarea.input', { value: draft.notes || '', placeholder: 'Observations, blessures, vomissements, traitements ponctuels…', onInput: (ev) => draft.notes = ev.target.value })
      ]),
      photoField(draft),
      h('div.modal-actions', null, [
        h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { onClick: () => {
          draft.meds = (draft.meds || []).filter((m) => (m.name || '').trim() || (m.dose || '').trim())
            .map((m) => { const o = { name: m.name, dose: m.dose }; if (m.medId) o.medId = m.medId; return o; });
          Store.updateDay(iso, draft); UI.closeModal(); UI.toast('Journée enregistrée');
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: fmtLong(iso), body });
  }

  function resizeImage(file, maxDim, cb) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        cb(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function photoField(draft) {
    const wrap = h('div.field');
    const render = () => {
      UI.clear(wrap);
      wrap.appendChild(h('label', null, 'Photo'));
      if (draft.photo) {
        wrap.appendChild(h('div', { style: 'position:relative;display:inline-block' }, [
          h('img', { src: draft.photo, style: 'max-width:100%;max-height:200px;border-radius:12px;border:1px solid var(--line)' }),
          h('button.delete-x', { style: 'position:absolute;top:4px;right:4px;background:rgba(255,255,255,.9);border-radius:50%', onClick: () => { draft.photo = null; render(); } }, '✕')
        ]));
      } else {
        const inp = h('input', { type: 'file', accept: 'image/*', style: 'display:none', onChange: (e) => { const f = e.target.files[0]; if (f) resizeImage(f, 900, (url) => { draft.photo = url; render(); }); } });
        wrap.appendChild(inp);
        wrap.appendChild(h('button.btn.subtle.block', { onClick: () => inp.click() }, '📷 Ajouter une photo'));
      }
    };
    render();
    return wrap;
  }

  function chip(label, on, onToggle) {
    const el = h('button', { class: 'chip' + (on ? ' on' : ''), onClick: () => { on = !on; el.classList.toggle('on', on); onToggle(); } }, label);
    return el;
  }

  // Malade ? Médicaments & soins donnés ce jour-là — pioche dans la pharmacie (fiche ℹ️) ou saisie libre
  function medsField(draft) {
    const wrap = h('div.field');
    function render() {
      UI.clear(wrap);
      wrap.appendChild(h('label', null, '💊 Malade ? Médicaments & soins donnés'));
      draft.meds = draft.meds || [];
      const pharmacy = Store.pharmacy();
      if (!draft.meds.length) wrap.appendChild(h('div.muted.small', { style: 'margin-bottom:6px' },
        'Choisis un produit de ta pharmacie (fiches dans Chien › Soins) ou saisis librement.'));
      draft.meds.forEach((m, idx) => {
        const med = m.medId ? Store.pharmaMed(m.medId) : null;
        // sélecteur pharmacie pour les nouvelles lignes ; saisie libre sinon
        const useSelect = pharmacy.length && (m.medId || (!m.name && !m._free));
        const nameCtl = useSelect
          ? h('select.input', { style: 'flex:1.2', onChange: (e) => {
              const v = e.target.value;
              if (v === '__libre__') { m.medId = null; m.name = ''; m._free = true; }
              else if (v) { const p = Store.pharmaMed(v); m.medId = v; m.name = p.name; if (!m.dose) m.dose = Store.pharmaPosology(p); }
              render();
            } }, [
              h('option', { value: '', selected: !m.medId, disabled: true }, 'Choisir un produit…'),
              ...pharmacy.map((p) => h('option', { value: p.id, selected: p.id === m.medId }, p.name)),
              h('option', { value: '__libre__' }, 'Autre (saisie libre)…')
            ])
          : h('input.input', { style: 'flex:1.2', placeholder: 'Ex. Biseptine', value: m.name || '', onInput: (e) => m.name = e.target.value });
        const medPoso = Store.pharmaPosology(med), medActs = Store.pharmaActives(med);
        const info = med && (medPoso || medActs || med.notes)
          ? h('div.muted.small', { style: 'display:none;white-space:pre-wrap;background:var(--sand);padding:8px 10px;border-radius:10px;margin:4px 0 0' },
              [medPoso ? 'Posologie : ' + medPoso : null, medActs ? 'Principes actifs : ' + medActs : null, med.notes || null].filter(Boolean).join('\n'))
          : null;
        wrap.appendChild(h('div', { style: 'margin-bottom:8px' }, [
          h('div.inline', { style: 'align-items:flex-start' }, [
            nameCtl,
            h('input.input', { style: 'flex:1.4', placeholder: 'Posologie / où (ex. 2×/jour sur la patte)', value: m.dose || '', onInput: (e) => m.dose = e.target.value }),
            info ? h('button.btn.ghost.icon', { title: 'Fiche produit', onClick: () => { info.style.display = info.style.display === 'none' ? '' : 'none'; } }, 'ℹ️') : null,
            h('button.delete-x', { onClick: () => { draft.meds.splice(idx, 1); render(); } }, '✕')
          ]),
          info
        ]));
      });
      wrap.appendChild(h('button.btn.ghost.sm', { onClick: () => { draft.meds.push({ name: '', dose: '' }); render(); } }, '+ Médicament / soin donné'));
    }
    render();
    return wrap;
  }

  // Humeur/forme : liste modifiable (chips + ajout rapide « + » ; gestion complète dans Réglages)
  function humeurField(draft) {
    const wrap = h('div.field');
    function render() {
      UI.clear(wrap);
      wrap.appendChild(h('label', null, 'Humeur / forme'));
      const row = h('div.chip-row');
      Store.moods().forEach((v) => row.appendChild(chip(v, draft.humeur === v, () => draft.humeur = (draft.humeur === v ? '' : v))));
      let adding = false;
      const commitAdd = (val) => {
        if (adding) return; adding = true;
        val = (val || '').trim();
        if (val) { if (Store.addMood(val)) draft.humeur = val; else UI.toast('Cette humeur existe déjà'); }
        render();
      };
      row.appendChild(h('button.chip', { title: 'Ajouter une humeur', onClick: (e) => {
        e.currentTarget.disabled = true;
        const inp = h('input.input', { placeholder: 'Ex. 😤 Nerveux — Entrée pour valider', style: 'margin-top:8px' });
        inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); commitAdd(inp.value); } });
        inp.addEventListener('blur', () => commitAdd(inp.value));
        wrap.appendChild(inp);
        inp.focus();
      } }, '+'));
      wrap.appendChild(row);
      wrap.appendChild(h('button.linkbtn', { style: 'margin-top:2px', onClick: () => { UI.closeModal(); setTimeout(openMoodsList, 50); } }, 'Gérer la liste des humeurs'));
    }
    render();
    return wrap;
  }

  function recentDays(n) {
    const out = [];
    const base = new Date(Store.todayISO() + 'T00:00:00');
    for (let i = 0; i < n; i++) {
      const d = new Date(base); d.setDate(d.getDate() - i);
      out.push(Store.isoLocal(d));
    }
    return out;
  }

  let mode = 'mois'; // 'mois' | 'liste'
  let cursor = new Date(Store.todayISO() + 'T00:00:00'); cursor.setDate(1);

  function entryDots(iso) {
    const e = Store.dayEntry(iso);
    const dots = [];
    if (e.repasMatin || e.repasSoir) dots.push('var(--green)');
    if (e.sorties && Object.values(e.sorties).some(Boolean)) dots.push('var(--blue)');
    if (e.notes || e.selles || e.humeur) dots.push('var(--amber)');
    return dots;
  }

  function calendar() {
    const y = cursor.getFullYear(), m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const startIdx = (first.getDay() + 6) % 7; // 0 = lundi
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const todayISO = Store.todayISO();

    const cells = [];
    UI.DAYS_SHORT.forEach((d) => cells.push(h('div', { style: 'text-align:center;font-size:11px;font-weight:700;color:var(--ink-soft);padding:4px 0' }, d)));
    for (let i = 0; i < startIdx; i++) cells.push(h('div'));
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = iso === todayISO;
      const isFuture = iso > todayISO;
      const dots = entryDots(iso);
      // smiley de l'humeur du jour, en haut à droite de la case
      const emo = (Store.dayEntry(iso).humeur || '').split(' ')[0];
      const showEmo = emo && /\p{Extended_Pictographic}/u.test(emo);
      cells.push(h('button', {
        class: 'cal-cell' + (isToday ? ' today' : ''),
        disabled: isFuture,
        style: isFuture ? 'opacity:.35' : '',
        onClick: () => { if (!isFuture) openEditor(iso); }
      }, [
        showEmo ? h('span', { style: 'position:absolute;top:1px;right:2px;font-size:9px;line-height:1;opacity:.95' }, emo) : null,
        h('span', null, String(day)),
        h('div.cal-dots', null, dots.map((c) => h('i', { style: `background:${c}` })))
      ]));
    }

    return h('div.card', null, [
      h('div.inline', { style: 'justify-content:space-between;margin-bottom:10px' }, [
        h('button.btn.icon.subtle', { onClick: () => { cursor = new Date(y, m - 1, 1); App.rerender(); } }, '‹'),
        h('strong', { style: 'font-size:16px;text-transform:capitalize' }, `${UI.MONTHS[m]} ${y}`),
        h('button.btn.icon.subtle', { disabled: (y > new Date().getFullYear()) || (y === new Date().getFullYear() && m >= new Date().getMonth()), onClick: () => { cursor = new Date(y, m + 1, 1); App.rerender(); } }, '›')
      ]),
      h('div.cal-grid', null, cells),
      h('div.inline', { style: 'gap:14px;margin-top:12px;flex-wrap:wrap' }, [
        legend('var(--green)', 'Repas'), legend('var(--blue)', 'Sorties'), legend('var(--amber)', 'Notes')
      ])
    ]);
  }
  function legend(color, label) {
    return h('span.inline', { style: 'gap:5px;font-size:12px;color:var(--ink-soft)' }, [h('i', { style: `width:8px;height:8px;border-radius:50%;background:${color};display:inline-block` }), label]);
  }

  function rangeDays(n) {
    const out = [];
    const base = new Date(Store.todayISO() + 'T00:00:00');
    for (let i = 0; i < n; i++) { const d = new Date(base); d.setDate(d.getDate() - i); out.push(Store.isoLocal(d)); }
    return out;
  }
  let statsRange = 30;

  function barRow(label, value, max, color) {
    const pct = max ? Math.round(value / max * 100) : 0;
    return h('div', { style: 'margin-bottom:8px' }, [
      h('div.inline', { style: 'justify-content:space-between;font-size:13px' }, [h('span', null, label), h('strong', null, value)]),
      h('div', { style: 'height:7px;background:var(--sand);border-radius:99px;overflow:hidden;margin-top:3px' },
        h('div', { style: `height:100%;width:${pct}%;background:${color || 'var(--green)'};border-radius:99px` }))
    ]);
  }

  function statsView(root) {
    const days = rangeDays(statsRange);
    const entries = days.map((iso) => Store.dayEntry(iso));
    const sellesCount = {}, humeurCount = {}, sortiesCount = { ville: 0, foret: 0, educ: 0, veto: 0 };
    let repas = 0, photos = 0;
    entries.forEach((e) => {
      if (e.selles) sellesCount[e.selles] = (sellesCount[e.selles] || 0) + 1;
      if (e.humeur) humeurCount[e.humeur] = (humeurCount[e.humeur] || 0) + 1;
      if (e.repasMatin) repas++; if (e.repasSoir) repas++;
      if (e.photo) photos++;
      SORTIES.forEach((s) => { if (e.sorties && e.sorties[s.key]) sortiesCount[s.key]++; });
    });

    root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
      h('button', { class: statsRange === 30 ? 'on' : '', onClick: () => { statsRange = 30; App.rerender(); } }, '30 jours'),
      h('button', { class: statsRange === 90 ? 'on' : '', onClick: () => { statsRange = 90; App.rerender(); } }, '90 jours')
    ]));

    // KPIs
    const last = Store.lastWeight();
    root.appendChild(h('div.kpi-row', null, [
      h('div.kpi', null, [h('div.num', null, repas), h('div.lab', null, 'repas donnés')]),
      h('div.kpi', null, [h('div.num', null, Object.values(sortiesCount).reduce((a, b) => a + b, 0)), h('div.lab', null, 'sorties')]),
      h('div.kpi', null, [h('div.num', null, last ? last.kg : '—'), h('div.lab', null, 'poids (kg)')])
    ]));

    const sellesTotal = Object.values(sellesCount).reduce((a, b) => a + b, 0);
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, '💩 Selles')]),
      sellesTotal ? h('div', null, ['Normales', 'Molles', 'Liquides', 'Dures', 'Aucune'].filter((k) => sellesCount[k]).map((k) =>
        barRow(k, sellesCount[k] || 0, sellesTotal, k === 'Normales' ? 'var(--ok)' : (k === 'Liquides' || k === 'Molles') ? 'var(--amber)' : 'var(--ink-soft)'))) : h('div.muted.small', null, 'Aucune donnée notée.')
    ]));

    const maxS = Math.max(1, ...Object.values(sortiesCount));
    root.appendChild(h('div.card', null, [
      h('div.card-head', null, [h('h3', null, '🚶 Sorties')]),
      barRow('🏙️ Ville', sortiesCount.ville, maxS, 'var(--blue)'),
      barRow('🌲 Forêt', sortiesCount.foret, maxS, 'var(--green)'),
      barRow('🎓 Éduc', sortiesCount.educ, maxS, 'var(--amber)'),
      barRow('🏥 Véto', sortiesCount.veto, maxS, 'var(--red)')
    ]));

    // Qui s'en occupe
    const who = Store.whoStats(days);
    const people = Store.get().people.filter((p) => who[p.id] && who[p.id].total > 0);
    if (people.length) {
      const maxW = Math.max(1, ...people.map((p) => who[p.id].total));
      root.appendChild(h('div.card', null, [
        h('div.card-head', null, [h('h3', null, '👥 Qui s’en occupe'), h('span.muted.small', null, 'balade · éduc · véto')]),
        ...people.sort((a, b) => who[b.id].total - who[a.id].total).map((p) => {
          const w = who[p.id];
          return h('div', { style: 'margin-bottom:8px' }, [
            h('div.inline', { style: 'justify-content:space-between;font-size:13px' }, [
              h('span', null, p.name),
              h('strong', null, [w.total + '  ', h('span.muted', { style: 'font-weight:400' }, `(🦮${w.balade} · 🎓${w.educ} · 🏥${w.veto})`)])
            ]),
            h('div', { style: 'height:7px;background:var(--sand);border-radius:99px;overflow:hidden;margin-top:3px' },
              h('div', { style: `height:100%;width:${Math.round(w.total / maxW * 100)}%;background:var(--blue);border-radius:99px` }))
          ]);
        })
      ]));
    }

    if (Object.keys(humeurCount).length) {
      const maxH = Math.max(1, ...Object.values(humeurCount));
      root.appendChild(h('div.card', null, [
        h('div.card-head', null, [h('h3', null, '😊 Humeur')]),
        ...Object.keys(humeurCount).map((k) => barRow(k, humeurCount[k], maxH, 'var(--green)'))
      ]));
    }

    root.appendChild(h('button.btn.block', { style: 'margin-top:6px', onClick: () => buildVetReport(statsRange) }, '🩺 Export résumé pour le véto'));
  }

  function buildVetReport(n) {
    const days = rangeDays(n).reverse();
    const s = Store.get();
    const dog = s.settings.dogName || 'Hatchi';
    const esc = (x) => String(x == null ? '' : x).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const rows = [];
    days.forEach((iso) => {
      const e = Store.dayEntry(iso);
      const sorties = SORTIES.filter((x) => e.sorties && e.sorties[x.key]).map((x) => x.label).join(', ');
      const meds = (e.meds || []).map((m) => m.name + (m.dose ? ' (' + m.dose + ')' : '')).join(', ');
      const has = e.selles || e.humeur || e.notes || e.temp || sorties || meds;
      if (!has) return;
      rows.push(`<tr><td>${UI.fmtShortYear(iso)}</td><td>${esc(e.selles)}</td><td>${esc((e.humeur || '').replace(/^[^ ]+ /, ''))}</td><td>${esc(e.temp ? e.temp + '°C' : '')}</td><td>${esc(meds)}</td><td>${esc(sorties)}</td><td>${esc(e.notes)}</td></tr>`);
    });
    const weights = Store.weightsSorted().filter((w) => days.includes(w.date));
    const treatRows = s.treatments.map((t) => {
      const hist = (t.history || []).filter((d) => days.includes(d));
      const due = Store.nextDue(t);
      return `<tr><td>${esc(t.name)}</td><td>${t.last ? UI.fmtShortYear(t.last) : '—'}</td><td>${due ? UI.fmtShortYear(due) : '—'}</td><td>${hist.map((d) => UI.fmtShortYear(d)).join(', ')}</td></tr>`;
    }).join('');

    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Résumé santé — ${esc(dog)}</title>
<style>body{font-family:-apple-system,Arial,sans-serif;color:#23302c;max-width:760px;margin:24px auto;padding:0 16px}h1{color:#1f6f5c}h2{margin-top:26px;border-bottom:2px solid #e7e1d6;padding-bottom:4px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}th,td{border:1px solid #e7e1d6;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f6f1e7}.muted{color:#5d6b66}@media print{button{display:none}}</style></head><body>
<h1>🐾 ${esc(dog)} — résumé santé</h1>
<p class="muted">Période : ${UI.fmtShortYear(days[0])} → ${UI.fmtShortYear(days[days.length - 1])} · édité le ${UI.fmtShortYear(Store.todayISO())}</p>
${s.settings.dogBirthdate ? `<p class="muted">Né(e) le ${UI.fmtShortYear(s.settings.dogBirthdate)}</p>` : ''}
<button onclick="window.print()" style="padding:10px 16px;background:#1f6f5c;color:#fff;border:0;border-radius:8px;font-weight:700;cursor:pointer">Imprimer / PDF</button>
<h2>Poids</h2>${weights.length ? '<table><tr><th>Date</th><th>Poids</th></tr>' + weights.map((w) => `<tr><td>${UI.fmtShortYear(w.date)}</td><td>${w.kg} kg</td></tr>`).join('') + '</table>' : '<p class="muted">Aucune pesée sur la période.</p>'}
<h2>Traitements</h2><table><tr><th>Soin</th><th>Dernier</th><th>Prochain</th><th>Faits (période)</th></tr>${treatRows}</table>
<h2>Journal</h2>${rows.length ? '<table><tr><th>Date</th><th>Selles</th><th>Humeur</th><th>T°</th><th>Médicaments / soins</th><th>Sorties</th><th>Notes</th></tr>' + rows.join('') + '</table>' : '<p class="muted">Aucune note sur la période.</p>'}
</body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    const w = window.open(url, '_blank');
    if (!w) { UI.download('resume-veto-' + dog.toLowerCase() + '.html', html, 'text/html'); UI.toast('Résumé téléchargé'); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  Views.openDayEditor = openEditor; // utilisé par le tableau de bord (fiche du jour)
  Views.openCalendar = () => { mode = 'mois'; App.go('journal'); }; // bouton 📅 Calendrier

  Views.journal = {
    render(root) {
      root.appendChild(UI.subHead('Journal & tendances', () => App.go('dog')));
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: mode === 'mois' ? 'on' : '', onClick: () => { mode = 'mois'; App.rerender(); } }, '📅 Mois'),
        h('button', { class: mode === 'liste' ? 'on' : '', onClick: () => { mode = 'liste'; App.rerender(); } }, '📋 Liste'),
        h('button', { class: mode === 'stats' ? 'on' : '', onClick: () => { mode = 'stats'; App.rerender(); } }, '📊 Tendances')
      ]));

      if (mode === 'stats') {
        statsView(root);
      } else if (mode === 'mois') {
        root.appendChild(calendar());
      } else {
        root.appendChild(h('div.card', null, [
          h('div.inline', null, [
            h('input.input', { type: 'date', value: selectedDate, max: Store.todayISO(), onChange: (e) => { selectedDate = e.target.value; openEditor(selectedDate); } }),
            h('button.btn', { onClick: () => openEditor(selectedDate) }, 'Ouvrir')
          ])
        ]));
        root.appendChild(h('div.section-title', null, '14 derniers jours'));
        root.appendChild(h('div.card.flush', null, recentDays(14).map(dayCard)));
      }
    }
  };
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

  Views.openMoodsList = openMoodsList;

})();
