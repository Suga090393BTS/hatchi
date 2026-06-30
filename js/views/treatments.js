/* ============================================================
   Vue Soins — traitements & rappels
   ============================================================ */
(function () {
  'use strict';
  window.Views = window.Views || {};
  const { h, fmtShortYear, relDays } = UI;

  const TYPES = [
    { v: 'collier', l: 'Collier anti-puces', ic: '🦟' },
    { v: 'vermifuge', l: 'Vermifuge', ic: '🪱' },
    { v: 'vaccin', l: 'Vaccin', ic: '💉' },
    { v: 'yeux', l: 'Yeux', ic: '👁️' },
    { v: 'oreilles', l: 'Oreilles', ic: '👂' },
    { v: 'dents', l: 'Dents', ic: '🦷' },
    { v: 'griffes', l: 'Griffes', ic: '🐾' },
    { v: 'toilettage', l: 'Toilettage', ic: '🛁' },
    { v: 'autre', l: 'Autre', ic: '💊' }
  ];
  const icon = (t) => (TYPES.find((x) => x.v === t) || { ic: '💊' }).ic;

  function row(t) {
    const st = Store.dueStatus(t);
    const due = st.due;
    let badge = null;
    if (st.state === 'overdue') badge = h('span.badge.due', null, 'En retard');
    else if (st.state === 'soon') badge = h('span.badge.soon', null, relDays(st.days));
    else if (st.state === 'ok') badge = h('span.badge.ok', null, relDays(st.days));
    else badge = h('span.badge.info', null, 'À planifier');

    return h('div.row', null, [
      h('div.row-ic', null, icon(t.type)),
      h('div.row-main', { onClick: () => openEditor(t) }, [
        h('strong', null, t.name),
        h('small', null, [
          `Tous les ${t.every} ${t.unit}`,
          t.last ? ` · dernier ${fmtShortYear(t.last)}` : ' · jamais fait',
          due ? ` · prochain ${fmtShortYear(due)}` : ''
        ].join(''))
      ]),
      h('div.row-end', null, [
        badge,
        h('button.btn.sm', { onClick: () => { Store.markTreatmentDone(t.id); UI.toast(t.name + ' ✓'); } }, 'Fait')
      ])
    ]);
  }

  function openEditor(t) {
    const isNew = !t;
    let d = t ? JSON.parse(JSON.stringify(t)) : { name: '', type: 'autre', every: 1, unit: 'mois', last: null, notes: '' };

    const body = h('div', null, [
      h('div.field', null, [h('label', null, 'Nom'), h('input.input', { value: d.name, placeholder: 'Ex. Collier anti-puces', onInput: (e) => d.name = e.target.value })]),
      h('div.field', null, [
        h('label', null, 'Type'),
        h('select.input', { onChange: (e) => { d.type = e.target.value; const found = TYPES.find((x) => x.v === d.type); if (isNew && !d.name && found) { d.name = found.l; nameInput.value = found.l; } } },
          TYPES.map((x) => h('option', { value: x.v, selected: x.v === d.type }, x.ic + '  ' + x.l)))
      ]),
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Fréquence'), h('input.input', { type: 'number', min: '1', value: d.every, onInput: (e) => d.every = +e.target.value || 1 })]),
        h('div.field', null, [h('label', null, 'Unité'),
          h('select.input', { onChange: (e) => d.unit = e.target.value }, ['jours', 'mois', 'ans'].map((u) => h('option', { value: u, selected: u === d.unit }, u)))])
      ]),
      h('div.field', null, [h('label', null, 'Dernier fait le'), h('input.input', { type: 'date', value: d.last || '', max: Store.todayISO(), onChange: (e) => d.last = e.target.value || null })]),
      h('div.field', null, [h('label', null, 'Notes'), h('textarea.input', { value: d.notes || '', placeholder: 'Marque, dosage…', onInput: (e) => d.notes = e.target.value })]),
      t && t.history && t.history.length ? h('div.field', null, [
        h('label', null, 'Historique'),
        h('div.tag-list', null, t.history.slice().reverse().map((iso) => h('span.badge.info', null, fmtShortYear(iso))))
      ]) : null,
      !isNew ? h('button.btn.subtle.block', { style: 'margin-bottom:6px', onClick: () => {
        UI.download('rappel-' + (t.name || 'soin').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.ics', Store.icsForTreatment(t), 'text/calendar');
        UI.toast('Ouvrez le fichier pour l’ajouter au calendrier');
      } }, '📅 Ajouter au calendrier (rappel récurrent)') : null,
      h('div.modal-actions', null, [
        !isNew ? h('button.btn.danger', { onClick: async () => { if (await UI.confirm('Supprimer ce soin ?', { danger: true, ok: 'Supprimer' })) { Store.removeTreatment(t.id); UI.closeModal(); } } }, '🗑')
               : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          if (!d.name.trim()) { UI.toast('Donnez un nom'); return; }
          if (isNew) Store.addTreatment(d); else Store.updateTreatment(t.id, d);
          UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    const nameInput = body.querySelector('input.input');
    UI.modal({ title: isNew ? 'Nouveau soin' : 'Modifier', body });
  }

  let tab = 'soins'; // 'soins' | 'poids'

  /* ---------- Poids ---------- */
  function weightChart(data) {
    // data: [{date, kg}] trié
    const W = 320, H = 150, pad = { l: 30, r: 12, t: 12, b: 22 };
    const xs = data.map((d, i) => i);
    const kgs = data.map((d) => d.kg);
    let min = Math.min.apply(null, kgs), max = Math.max.apply(null, kgs);
    if (min === max) { min -= 1; max += 1; } else { const m = (max - min) * 0.15; min -= m; max += m; }
    const px = (i) => pad.l + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (W - pad.l - pad.r));
    const py = (kg) => pad.t + (1 - (kg - min) / (max - min)) * (H - pad.t - pad.b);
    const ptsArr = data.map((d, i) => [px(i), py(d.kg)]);
    const line = ptsArr.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${px(data.length - 1).toFixed(1)} ${(H - pad.b)} L${pad.l} ${H - pad.b} Z`;

    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const el = (n, attrs) => { const x = document.createElementNS(NS, n); for (const k in attrs) x.setAttribute(k, attrs[k]); return x; };
    // grilles min/max
    [min, max].forEach((v) => {
      svg.appendChild(el('line', { x1: pad.l, y1: py(v), x2: W - pad.r, y2: py(v), stroke: '#e7e1d6', 'stroke-width': 1 }));
      const t = el('text', { x: 2, y: py(v) + 4, 'font-size': 9, fill: '#5d6b66' }); t.textContent = v.toFixed(1); svg.appendChild(t);
    });
    svg.appendChild(el('path', { d: area, fill: 'rgba(31,111,92,.12)' }));
    svg.appendChild(el('path', { d: line, fill: 'none', stroke: '#1f6f5c', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    ptsArr.forEach((p, i) => {
      svg.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.5, fill: '#fff', stroke: '#1f6f5c', 'stroke-width': 2 }));
      if (i === data.length - 1) { const t = el('text', { x: p[0], y: p[1] - 8, 'font-size': 11, 'font-weight': 700, fill: '#185647', 'text-anchor': 'end' }); t.textContent = data[i].kg + ' kg'; svg.appendChild(t); }
    });
    return h('div.chart-wrap', null, svg);
  }

  function openWeightEditor(existing) {
    let d = existing ? { date: existing.date, kg: existing.kg } : { date: Store.todayISO(), kg: '' };
    const body = h('div', null, [
      h('div.grid2', null, [
        h('div.field', null, [h('label', null, 'Date'), h('input.input', { type: 'date', value: d.date, max: Store.todayISO(), onChange: (e) => d.date = e.target.value })]),
        h('div.field', null, [h('label', null, 'Poids (kg)'), h('input.input', { type: 'number', step: '0.1', min: '0', value: d.kg, onInput: (e) => d.kg = e.target.value })])
      ]),
      h('div.modal-actions', null, [
        existing ? h('button.btn.danger', { onClick: async () => { if (await UI.confirm('Supprimer cette pesée ?', { danger: true, ok: 'Supprimer' })) { Store.removeWeight(existing.id); UI.closeModal(); } } }, '🗑')
                 : h('button.btn.subtle', { onClick: () => UI.closeModal() }, 'Annuler'),
        h('button.btn', { style: 'flex:2', onClick: () => {
          const kg = parseFloat(d.kg);
          if (!kg || kg <= 0) { UI.toast('Poids invalide'); return; }
          Store.addWeight(d.date, kg); UI.closeModal();
        } }, 'Enregistrer')
      ])
    ]);
    UI.modal({ title: existing ? 'Modifier la pesée' : 'Nouvelle pesée', body });
  }

  function weightView(root) {
    const data = Store.weightsSorted();
    const last = data.length ? data[data.length - 1] : null;

    if (data.length) {
      const prev = data.length > 1 ? data[data.length - 2] : null;
      const delta = prev ? (last.kg - prev.kg) : 0;
      root.appendChild(h('div.card', null, [
        h('div.inline', { style: 'justify-content:space-between;margin-bottom:6px' }, [
          h('div', null, [h('div.muted.small', null, 'Poids actuel'), h('div', { style: 'font-size:26px;font-weight:800;color:var(--green-700)' }, last.kg + ' kg')]),
          prev ? h('span', { class: 'badge ' + (delta > 0 ? 'soon' : delta < 0 ? 'info' : 'ok') }, (delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '= ') + Math.abs(delta).toFixed(1) + ' kg') : null
        ]),
        data.length >= 2 ? weightChart(data) : h('div.muted.small', null, 'Ajoutez une 2ᵉ pesée pour voir la courbe.')
      ]));

      root.appendChild(h('div.section-title', null, 'Historique'));
      root.appendChild(h('div.card.flush', null, data.slice().reverse().map((w) =>
        h('div.row', { onClick: () => openWeightEditor(w) }, [
          h('div.row-ic', null, '⚖️'),
          h('div.row-main', null, [h('strong', null, w.kg + ' kg'), h('small', null, UI.fmtLong(w.date))]),
          h('div.row-end', null, h('span.muted', null, '›'))
        ])
      )));
    } else {
      root.appendChild(h('div.card', null, UI.emptyState('⚖️', 'Aucune pesée', 'Suivez le poids de votre chien pour visualiser sa courbe.')));
    }
    root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openWeightEditor(null) }, '+ Ajouter une pesée'));
  }

  Views.treatments = {
    render(root) {
      root.appendChild(h('div.seg', { style: 'margin-bottom:14px' }, [
        h('button', { class: tab === 'soins' ? 'on' : '', onClick: () => { tab = 'soins'; App.rerender(); } }, '💊 Traitements'),
        h('button', { class: tab === 'poids' ? 'on' : '', onClick: () => { tab = 'poids'; App.rerender(); } }, '⚖️ Poids')
      ]));
      if (tab === 'poids') { weightView(root); return; }

      const ts = Store.get().treatments.slice().sort((a, b) => {
        const da = Store.dueStatus(a).days, db = Store.dueStatus(b).days;
        return (da == null ? 9999 : da) - (db == null ? 9999 : db);
      });

      const overdue = ts.filter((t) => Store.dueStatus(t).state === 'overdue');
      if (overdue.length) {
        root.appendChild(h('div.card', { style: 'background:var(--red-100);border-color:#e6b9ad' }, [
          h('div.inline', null, [h('span', { style: 'font-size:22px' }, '⚠️'),
            h('div', null, [h('strong', null, `${overdue.length} soin${overdue.length > 1 ? 's' : ''} en retard`), h('div.small', null, overdue.map((t) => t.name).join(', '))])])
        ]));
      }

      if (!ts.length) root.appendChild(h('div.card', null, UI.emptyState('💊', 'Aucun soin', 'Ajoutez les traitements à suivre.')));
      else root.appendChild(h('div.card.flush', null, ts.map(row)));

      root.appendChild(h('button.btn.block', { style: 'margin-top:8px', onClick: () => openEditor(null) }, '+ Ajouter un soin'));
    }
  };
})();
