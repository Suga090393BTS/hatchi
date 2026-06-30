/* ============================================================
   Hatchi — Store (état, persistance locale, sync Supabase)
   Global: window.Store
   ============================================================ */
(function () {
  'use strict';

  const LS_KEY = 'hatchi.state.v1';
  const uid = () => 'id' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  // Date locale au format ISO (évite le décalage de fuseau de toISOString sur un minuit local)
  const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const todayISO = () => isoLocal(new Date());

  /* ---------- Données seed ---------- */
  // Catalogue d'ingrédients (issu du sheet HATCHI 2026). Prix éditables.
  // unit: 'g' => prix au kilo ; 'piece' => prix à l'unité.
  function seedIngredients() {
    const V = (name, cat, unit, price) => ({ id: uid(), name, category: cat, unit, price });
    return [
      V('Poulet (filet)', 'viande', 'g', 8.50),
      V('Dinde', 'viande', 'g', 0),
      V('Bœuf', 'viande', 'g', 15.90),
      V('Agneau', 'viande', 'g', 0),
      V('Lapin', 'viande', 'g', 0),
      V('Saumon', 'viande', 'g', 0),
      V('Côte de broutard', 'viande', 'g', 9.50),
      V('Abats (lot)', 'abats', 'g', 15.00),
      V('Foie', 'abats', 'g', 0),
      V('Cœur', 'abats', 'g', 0),
      V('Rognons', 'abats', 'g', 0),
      V('Os charnu', 'os', 'piece', 1.00),
      V('Œuf', 'oeuf', 'piece', 0.40),
      V('Carotte', 'legume', 'g', 2.00),
      V('Brocoli', 'legume', 'g', 2.50),
      V('Haricot vert', 'legume', 'g', 3.00),
      V('Courgette', 'legume', 'g', 2.00),
      V('Potiron', 'legume', 'g', 2.00),
      V('Épinard', 'legume', 'g', 3.00),
      V('Petit pois', 'legume', 'g', 2.50),
      V('Patate douce', 'legume', 'g', 2.50)
    ];
  }

  // Traitements/soins pré-remplis (l'utilisatrice veut les rappels). Modifiables.
  function seedTreatments() {
    const t = (name, type, every, unit, last, notes) =>
      ({ id: uid(), name, type, every, unit, last: last || null, history: last ? [last] : [], notes: notes || '' });
    return [
      t('Collier anti-puces', 'collier', 8, 'mois', '2025-06-27', 'Type Seresto — durée ~8 mois.'),
      t('Vermifuge', 'vermifuge', 3, 'mois', '2026-05-28', 'Drontal 1 cp et demi.'),
      t('Vaccin annuel', 'vaccin', 12, 'mois', '2026-03-26', 'RDV véto.'),
      t('Nettoyage des yeux', 'yeux', 7, 'jours', null, '2 yeux.'),
      t('Nettoyage des oreilles', 'oreilles', 7, 'jours', null, '2 oreilles.')
    ];
  }

  // Personnes qui s'occupent du chien (repris du sheet HATCHI 2026). Modifiables.
  function seedPeople() {
    return ['Flo', 'Fanny', 'Alex', 'Noune'].map((n) => ({ id: uid(), name: n }));
  }

  function emptyState() {
    return {
      version: 1,
      updatedAt: Date.now(),
      settings: {
        dogName: 'Hatchi',
        dogBirthdate: '',
        cycleWeeks: 1,            // nb de semaines dans la rotation
        anchorMonday: mondayOf(todayISO()), // 1er lundi de la rotation
        rationPct: 2.5,          // % du poids corporel / jour (ration ménagère)
        stockAlertDays: 3,       // seuil d'alerte de réapprovisionnement (jours)
        supabaseUrl: '',
        supabaseKey: '',
        spaceId: 'hatchi'
      },
      ingredients: seedIngredients(),
      meals: [],                 // repas-types : {id,name,items:[{ingredientId,qty}]}
      rotation: {},              // clé "w{week}-{dayIdx}-{slot}" => [mealId...]  (slot: 'matin'|'soir')
      treatments: seedTreatments(),
      journal: {},               // dateISO => {repasMatin,repasSoir,selles,humeur,sorties:{},who:{},promeneur,temp,soins:[],notes,photo}
      weights: [],               // [{id, date, kg}]
      stock: {},                 // ingredientId => quantité en stock (g ou pièces)
      people: seedPeople(),      // [{id, name}]
      purchases: []              // [{id, date, items:[{ingredientId, qty}], cost}]
    };
  }

  /* ---------- Helpers dates ---------- */
  function mondayOf(iso) {
    const d = new Date(iso + 'T00:00:00');
    const day = (d.getDay() + 6) % 7; // 0 = lundi
    d.setDate(d.getDate() - day);
    return isoLocal(d);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  }
  function addUnit(iso, every, unit) {
    const d = new Date(iso + 'T00:00:00');
    if (unit === 'jours') d.setDate(d.getDate() + every);
    else if (unit === 'mois') d.setMonth(d.getMonth() + every);
    else if (unit === 'ans') d.setFullYear(d.getFullYear() + every);
    return isoLocal(d);
  }

  /* ---------- Helpers BARF / besoins ---------- */
  // Classe BARF d'un ingrédient pour le ratio 80/10/10
  function barfClass(ing) {
    if (!ing) return 'autre';
    switch (ing.category) {
      case 'viande': return 'muscle';
      case 'oeuf': return 'muscle';
      case 'os': return 'os';
      case 'abats': return 'abats';
      case 'legume': return 'legume';
      default: return 'autre';
    }
  }
  function listDates(range, fromState) {
    const today = new Date(fromState.__today || todayISO());
    const out = [];
    if (range === 'week') {
      const monday = new Date(mondayOf(todayISO()) + 'T00:00:00');
      for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(d.getDate() + i); out.push(isoLocal(d)); }
    } else {
      const base = new Date(todayISO() + 'T00:00:00');
      const n = range === 'month' ? 30 : (typeof range === 'number' ? range : 7);
      for (let i = 0; i < n; i++) { const d = new Date(base); d.setDate(d.getDate() + i); out.push(isoLocal(d)); }
    }
    return out;
  }
  function applyMealsToStock(s, meals, sign) {
    meals.forEach((m) => (m.items || []).forEach((it) => {
      s.stock[it.ingredientId] = (s.stock[it.ingredientId] || 0) + sign * (it.qty || 0);
    }));
  }

  /* ---------- State management ---------- */
  let state = load();
  const listeners = new Set();
  let saveTimer = null;
  let supa = null;          // supabase client
  let syncStatus = 'local'; // local | syncing | synced | error
  const syncListeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return migrate(JSON.parse(raw));
    } catch (e) { /* ignore */ }
    return emptyState();
  }
  function migrate(s) {
    const base = emptyState();
    s.settings = Object.assign({}, base.settings, s.settings || {});
    if (!Array.isArray(s.ingredients)) s.ingredients = base.ingredients;
    if (!Array.isArray(s.meals)) s.meals = [];
    if (!Array.isArray(s.treatments)) s.treatments = base.treatments;
    if (typeof s.rotation !== 'object' || !s.rotation) s.rotation = {};
    if (typeof s.journal !== 'object' || !s.journal) s.journal = {};
    if (!Array.isArray(s.weights)) s.weights = [];
    if (typeof s.stock !== 'object' || !s.stock) s.stock = {};
    if (!Array.isArray(s.people)) s.people = seedPeople();
    if (!Array.isArray(s.purchases)) s.purchases = [];
    return s;
  }

  function persistLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function emit() { listeners.forEach((fn) => fn(state)); }
  function setSync(s) { syncStatus = s; syncListeners.forEach((fn) => fn(s)); }

  // Mutate state then persist + (debounced) push to cloud
  function commit(mutator, opts) {
    opts = opts || {};
    mutator(state);
    state.updatedAt = Date.now();
    persistLocal();
    emit();
    if (!opts.silentCloud) schedulePush();
  }

  function schedulePush() {
    if (!supa) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, 800);
  }

  /* ---------- Supabase sync (blob unique par spaceId) ---------- */
  function loadSupabaseLib() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve(window.supabase);
      const s = document.createElement('script');
      s.src = window.__SUPABASE_CDN__;
      s.onload = () => resolve(window.supabase);
      s.onerror = () => reject(new Error('Chargement de Supabase impossible (hors-ligne ?)'));
      document.head.appendChild(s);
    });
  }

  async function initSync(opts) {
    opts = opts || {};
    const { supabaseUrl, supabaseKey } = state.settings;
    if (!supabaseUrl || !supabaseKey) { supa = null; setSync('local'); return; }
    try {
      setSync('syncing');
      const lib = await loadSupabaseLib();
      supa = lib.createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      await pull(opts.preferRemote);
      setSync('synced');
    } catch (e) {
      console.warn('Sync init error', e);
      supa = null;
      setSync('error');
    }
  }

  async function pull(preferRemote) {
    if (!supa) return;
    const { data, error } = await supa
      .from('hatchi_state')
      .select('data, updated_at')
      .eq('id', state.settings.spaceId)
      .maybeSingle();
    if (error) throw error;
    if (data && data.data) {
      const remote = data.data;
      const remoteTs = remote.updatedAt || 0;
      if (preferRemote || remoteTs > state.updatedAt) {
        // remote wins (garder les clés de connexion locales)
        const keepConn = {
          supabaseUrl: state.settings.supabaseUrl,
          supabaseKey: state.settings.supabaseKey,
          spaceId: state.settings.spaceId
        };
        state = migrate(remote);
        state.settings = Object.assign(state.settings, keepConn);
        persistLocal();
        emit();
      } else if (state.updatedAt > remoteTs) {
        await push();
      }
    } else {
      await push(); // première écriture
    }
  }

  async function push() {
    if (!supa) return;
    try {
      setSync('syncing');
      const payload = Object.assign({}, state);
      // ne pas pousser les secrets de connexion dans le blob partagé
      payload.settings = Object.assign({}, state.settings, { supabaseUrl: '', supabaseKey: '' });
      const { error } = await supa
        .from('hatchi_state')
        .upsert({ id: state.settings.spaceId, data: payload, updated_at: new Date().toISOString() });
      if (error) throw error;
      setSync('synced');
    } catch (e) {
      console.warn('push error', e);
      setSync('error');
    }
  }

  async function testConnection(url, key, spaceId) {
    const lib = await loadSupabaseLib();
    const client = lib.createClient(url, key, { auth: { persistSession: false } });
    const { error } = await client.from('hatchi_state').select('id').limit(1);
    if (error) throw error;
    return true;
  }

  /* ---------- API publique ---------- */
  const Store = {
    /* lecture */
    get: () => state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    onSync(fn) { syncListeners.add(fn); fn(syncStatus); return () => syncListeners.delete(fn); },
    syncStatus: () => syncStatus,

    /* helpers exposés */
    uid, todayISO, mondayOf, daysBetween, addUnit, isoLocal,

    commit,
    replaceState(newState) {
      const keepConn = {
        supabaseUrl: state.settings.supabaseUrl,
        supabaseKey: state.settings.supabaseKey,
        spaceId: state.settings.spaceId
      };
      state = migrate(newState);
      state.settings = Object.assign({}, state.settings, keepConn);
      state.updatedAt = Date.now();
      persistLocal(); emit(); schedulePush();
    },

    /* ---- Settings ---- */
    updateSettings(patch) { commit((s) => Object.assign(s.settings, patch)); },

    /* ---- Ingrédients ---- */
    ingredient: (id) => state.ingredients.find((i) => i.id === id),
    addIngredient(data) { const i = Object.assign({ id: uid(), price: 0, unit: 'g', category: 'autre' }, data); commit((s) => s.ingredients.push(i)); return i; },
    updateIngredient(id, patch) { commit((s) => { const i = s.ingredients.find((x) => x.id === id); if (i) Object.assign(i, patch); }); },
    removeIngredient(id) { commit((s) => { s.ingredients = s.ingredients.filter((x) => x.id !== id); }); },

    /* ---- Repas-types ---- */
    meal: (id) => state.meals.find((m) => m.id === id),
    addMeal(data) { const m = Object.assign({ id: uid(), name: '', items: [] }, data); commit((s) => s.meals.push(m)); return m; },
    updateMeal(id, patch) { commit((s) => { const m = s.meals.find((x) => x.id === id); if (m) Object.assign(m, patch); }); },
    removeMeal(id) {
      commit((s) => {
        s.meals = s.meals.filter((x) => x.id !== id);
        Object.keys(s.rotation).forEach((k) => { s.rotation[k] = (s.rotation[k] || []).filter((mid) => mid !== id); });
      });
    },

    /* ---- Rotation ---- */
    rotationKey: (week, dayIdx, slot) => `w${week}-${dayIdx}-${slot}`,
    getRotation(week, dayIdx, slot) { return state.rotation[`w${week}-${dayIdx}-${slot}`] || []; },
    setRotation(week, dayIdx, slot, mealIds) {
      commit((s) => { s.rotation[`w${week}-${dayIdx}-${slot}`] = mealIds.slice(); });
    },

    // Quelle semaine de cycle + quel jour pour une date donnée
    cyclePosition(iso) {
      const anchor = state.settings.anchorMonday || mondayOf(iso);
      const cw = Math.max(1, state.settings.cycleWeeks || 1);
      const monday = mondayOf(iso);
      const weeksFromAnchor = Math.floor(daysBetween(anchor, monday) / 7);
      let week = ((weeksFromAnchor % cw) + cw) % cw; // 0-based, sûr pour négatifs
      const dayIdx = (new Date(iso + 'T00:00:00').getDay() + 6) % 7; // 0=lundi
      return { week: week + 1, dayIdx };
    },
    mealsForDay(iso, slot) {
      const { week, dayIdx } = this.cyclePosition(iso);
      const ids = this.getRotation(week, dayIdx, slot);
      return ids.map((id) => this.meal(id)).filter(Boolean);
    },

    /* ---- Traitements ---- */
    treatment: (id) => state.treatments.find((t) => t.id === id),
    addTreatment(data) {
      const t = Object.assign({ id: uid(), name: '', type: 'autre', every: 1, unit: 'mois', last: null, history: [], notes: '' }, data);
      commit((s) => s.treatments.push(t)); return t;
    },
    updateTreatment(id, patch) { commit((s) => { const t = s.treatments.find((x) => x.id === id); if (t) Object.assign(t, patch); }); },
    removeTreatment(id) { commit((s) => { s.treatments = s.treatments.filter((x) => x.id !== id); }); },
    markTreatmentDone(id, iso) {
      iso = iso || todayISO();
      commit((s) => {
        const t = s.treatments.find((x) => x.id === id);
        if (!t) return;
        t.last = iso;
        t.history = t.history || [];
        if (!t.history.includes(iso)) t.history.push(iso);
        t.history.sort();
      });
    },
    nextDue(t) { return t.last ? addUnit(t.last, t.every, t.unit) : null; },
    dueStatus(t, refISO) {
      refISO = refISO || todayISO();
      const due = this.nextDue(t);
      if (!due) return { state: 'never', due: null, days: null };
      const days = daysBetween(refISO, due);
      let st = 'ok';
      if (days < 0) st = 'overdue';
      else if (days <= 7) st = 'soon';
      return { state: st, due, days };
    },

    /* ---- Journal ---- */
    dayEntry(iso) {
      return state.journal[iso] || { repasMatin: false, repasSoir: false, selles: '', humeur: '', sorties: {}, promeneur: '', temp: '', soins: [], notes: '' };
    },
    updateDay(iso, patch) {
      commit((s) => {
        const cur = s.journal[iso] || { sorties: {}, soins: [] };
        s.journal[iso] = Object.assign({ sorties: {}, soins: [] }, cur, patch);
      });
    },
    toggleDaySoin(iso, treatmentId) {
      commit((s) => {
        const cur = s.journal[iso] || { sorties: {}, soins: [] };
        const set = new Set(cur.soins || []);
        if (set.has(treatmentId)) set.delete(treatmentId); else set.add(treatmentId);
        cur.soins = [...set];
        s.journal[iso] = cur;
      });
    },
    // Qui fait quoi : activity ∈ 'balade'|'educ'|'veto'
    toggleDayWho(iso, activity, personId) {
      commit((s) => {
        const cur = s.journal[iso] || { sorties: {}, soins: [] };
        cur.who = cur.who || {};
        const set = new Set(cur.who[activity] || []);
        if (set.has(personId)) set.delete(personId); else set.add(personId);
        cur.who[activity] = [...set];
        // cohérence avec les cases sorties
        cur.sorties = cur.sorties || {};
        if (activity === 'educ') cur.sorties.educ = cur.who.educ.length > 0 || cur.sorties.educ;
        if (activity === 'veto') cur.sorties.veto = cur.who.veto.length > 0 || cur.sorties.veto;
        s.journal[iso] = cur;
      });
    },

    /* ---- Personnes ---- */
    person: (id) => state.people.find((p) => p.id === id),
    personName(id) { const p = this.person(id); return p ? p.name : '?'; },
    addPerson(name) { const p = { id: uid(), name: (name || '').trim() || 'Sans nom' }; commit((s) => s.people.push(p)); return p; },
    updatePerson(id, name) { commit((s) => { const p = s.people.find((x) => x.id === id); if (p) p.name = name; }); },
    removePerson(id) {
      commit((s) => {
        s.people = s.people.filter((x) => x.id !== id);
        Object.values(s.journal).forEach((d) => { if (d.who) Object.keys(d.who).forEach((a) => { d.who[a] = (d.who[a] || []).filter((pid) => pid !== id); }); });
      });
    },
    // Compte par personne sur une plage : {personId: {balade, educ, veto, total}}
    whoStats(days) {
      const out = {};
      state.people.forEach((p) => { out[p.id] = { balade: 0, educ: 0, veto: 0, total: 0 }; });
      days.forEach((iso) => {
        const w = (state.journal[iso] || {}).who || {};
        ['balade', 'educ', 'veto'].forEach((a) => (w[a] || []).forEach((pid) => {
          if (out[pid]) { out[pid][a]++; out[pid].total++; }
        }));
      });
      return out;
    },

    /* ---- Poids ---- */
    weightsSorted() { return state.weights.slice().sort((a, b) => a.date.localeCompare(b.date)); },
    lastWeight() { const w = this.weightsSorted(); return w.length ? w[w.length - 1] : null; },
    addWeight(date, kg) {
      commit((s) => {
        date = date || todayISO();
        const ex = s.weights.find((w) => w.date === date);
        if (ex) ex.kg = kg; else s.weights.push({ id: uid(), date, kg });
      });
    },
    removeWeight(id) { commit((s) => { s.weights = s.weights.filter((w) => w.id !== id); }); },

    /* ---- Ration & équilibre BARF ---- */
    recommendedRation() {
      const w = this.lastWeight();
      if (!w) return null;
      const pct = state.settings.rationPct || 2.5;
      return Math.round(w.kg * 1000 * pct / 100); // g / jour
    },
    dayPlannedGrams(iso) {
      let g = 0;
      ['matin', 'soir'].forEach((slot) => this.mealsForDay(iso, slot).forEach((m) =>
        (m.items || []).forEach((it) => { const ing = this.ingredient(it.ingredientId); if (ing && ing.unit === 'g') g += (it.qty || 0); })));
      return g;
    },
    // Répartition BARF sur une plage ('week' = semaine en cours, 'month' = 30 j)
    barfBalance(range) {
      const acc = { muscle: 0, os: 0, abats: 0, legume: 0, autre: 0, osPieces: 0 };
      listDates(range || 'week', {}).forEach((iso) => {
        ['matin', 'soir'].forEach((slot) => this.mealsForDay(iso, slot).forEach((m) =>
          (m.items || []).forEach((it) => {
            const ing = this.ingredient(it.ingredientId);
            if (!ing) return;
            const cls = barfClass(ing);
            if (ing.unit === 'piece') { if (cls === 'os') acc.osPieces += (it.qty || 0); else acc[cls] += 0; }
            else acc[cls] += (it.qty || 0);
          })));
      });
      const base = acc.muscle + acc.abats; // muscle vs abats (os en pièces géré à part)
      acc.musclePct = base ? Math.round(acc.muscle / base * 100) : 0;
      acc.abatsPct = base ? Math.round(acc.abats / base * 100) : 0;
      return acc;
    },

    /* ---- Stock congélateur ---- */
    stockOf(id) { return Math.max(0, Math.round(state.stock[id] || 0)); },
    setStock(id, val) { commit((s) => { s.stock[id] = Math.max(0, val || 0); }); },
    adjustStock(id, delta) { commit((s) => { s.stock[id] = Math.max(0, (s.stock[id] || 0) + delta); }); },
    // Besoins agrégés sur une plage => {id: qty}
    needs(range) {
      const totals = {};
      listDates(range || 'week', {}).forEach((iso) => {
        ['matin', 'soir'].forEach((slot) => this.mealsForDay(iso, slot).forEach((m) =>
          (m.items || []).forEach((it) => { totals[it.ingredientId] = (totals[it.ingredientId] || 0) + (it.qty || 0); })));
      });
      return totals;
    },
    restockFromNeeds(range) { const n = this.needs(range); commit((s) => { Object.keys(n).forEach((id) => { s.stock[id] = (s.stock[id] || 0) + n[id]; }); }); },
    // Jours de couverture d'un ingrédient selon la conso moyenne du cycle
    coverageDays(id) {
      const cycleDays = Math.max(1, (state.settings.cycleWeeks || 1) * 7);
      const cycleNeed = this.needs(cycleDays)[id] || 0; // sur la durée du cycle
      const perDay = cycleNeed / cycleDays;
      if (perDay <= 0) return Infinity;
      return this.stockOf(id) / perDay;
    },
    lowStock() {
      const seuil = state.settings.stockAlertDays || 3;
      return state.ingredients
        .map((ing) => ({ ing, days: this.coverageDays(ing.id) }))
        .filter((x) => x.days !== Infinity && x.days < seuil);
    },
    /* ---- Achats (ajoutent au stock) ---- */
    addPurchase({ date, items, cost }) {
      const clean = (items || []).filter((it) => it.ingredientId && it.qty > 0);
      if (!clean.length) return null;
      const purchase = { id: uid(), date: date || todayISO(), items: clean.map((it) => { const o = { ingredientId: it.ingredientId, qty: it.qty }; if (it.cut) o.cut = it.cut; return o; }), cost: cost ? +cost : 0 };
      commit((s) => {
        clean.forEach((it) => { s.stock[it.ingredientId] = (s.stock[it.ingredientId] || 0) + it.qty; });
        s.purchases.push(purchase);
      });
      return purchase;
    },
    removePurchase(id, { restock } = {}) {
      commit((s) => {
        const p = s.purchases.find((x) => x.id === id);
        if (p && restock === false) { /* on ne retire pas du stock */ }
        else if (p) { p.items.forEach((it) => { s.stock[it.ingredientId] = Math.max(0, (s.stock[it.ingredientId] || 0) - it.qty); }); }
        s.purchases = s.purchases.filter((x) => x.id !== id);
      });
    },
    purchasesSorted() { return state.purchases.slice().sort((a, b) => b.date.localeCompare(a.date)); },
    spentInMonth(yearMonth) { // 'YYYY-MM' ; défaut = mois courant
      const ym = yearMonth || todayISO().slice(0, 7);
      return state.purchases.filter((p) => p.date.slice(0, 7) === ym).reduce((sum, p) => sum + (p.cost || 0), 0);
    },

    // Marquer un repas donné + déduire/réintégrer le stock (idempotent)
    setMealGiven(iso, slot, given) {
      const meals = this.mealsForDay(iso, slot);
      commit((s) => {
        const day = s.journal[iso] || { sorties: {}, soins: [] };
        const key = slot === 'matin' ? 'repasMatin' : 'repasSoir';
        const dedKey = slot === 'matin' ? '_dedMatin' : '_dedSoir';
        day[key] = given;
        if (given && !day[dedKey]) { applyMealsToStock(s, meals, -1); day[dedKey] = true; }
        else if (!given && day[dedKey]) { applyMealsToStock(s, meals, +1); day[dedKey] = false; }
        s.journal[iso] = day;
      });
    },

    /* ---- Rotation type (d'après le sheet HATCHI 2026) ---- */
    loadExampleRotation() {
      commit((s) => {
        const byName = {};
        s.ingredients.forEach((i) => { byName[i.name] = i.id; });
        const I = (n) => byName[n];
        const item = (n, q) => ({ ingredientId: I(n), qty: q });
        const ensure = (name, items) => {
          let m = s.meals.find((x) => x.name === name);
          if (m) { m.items = items; return m.id; }
          m = { id: uid(), name, items };
          s.meals.push(m);
          return m.id;
        };
        // Repas-types réutilisables
        const pouletOeuf = ensure('Poulet + œuf (matin)', [item('Poulet (filet)', 500), item('Œuf', 1)]);
        const pouletOs   = ensure('Poulet + os (matin)', [item('Poulet (filet)', 500), item('Os charnu', 1)]);
        const poulet     = ensure('Poulet (matin)', [item('Poulet (filet)', 500)]);
        const dinde      = ensure('Dinde (matin)', [item('Dinde', 500)]);
        const dindeOs    = ensure('Dinde + os (matin)', [item('Dinde', 500), item('Os charnu', 1)]);
        const dindeAbats = ensure('Dinde + abats (soir)', [item('Dinde', 300), item('Abats (lot)', 200)]);
        const boeuf400   = ensure('Bœuf + œuf (soir)', [item('Bœuf', 400), item('Œuf', 1)]);
        const boeuf300   = ensure('Bœuf + abats (soir)', [item('Bœuf', 300), item('Abats (lot)', 200)]);
        const agneau400  = ensure('Agneau + œuf (soir, 400 g)', [item('Agneau', 400), item('Œuf', 1)]);
        const agneau500  = ensure('Agneau + œuf (soir, 500 g)', [item('Agneau', 500), item('Œuf', 1)]);
        const pouletAbats = ensure('Poulet + abats (soir)', [item('Poulet (filet)', 500), item('Abats (lot)', 200)]);

        // Rotation 1 semaine (0=lundi … 6=dimanche), matin / soir
        const plan = {
          0: { matin: [pouletOeuf], soir: [dindeAbats] },   // Lundi
          1: { matin: [pouletOs],   soir: [boeuf400] },     // Mardi
          2: { matin: [dinde],      soir: [boeuf300] },     // Mercredi
          3: { matin: [pouletOs],   soir: [agneau400] },    // Jeudi
          4: { matin: [dinde],      soir: [agneau500] },    // Vendredi
          5: { matin: [poulet],     soir: [pouletAbats] },  // Samedi
          6: { matin: [dindeOs],    soir: [boeuf400] }      // Dimanche
        };
        for (let d = 0; d < 7; d++) {
          s.rotation[`w1-${d}-matin`] = plan[d].matin.slice();
          s.rotation[`w1-${d}-soir`] = plan[d].soir.slice();
        }
        s.settings.cycleWeeks = 1;
      });
    },

    /* ---- Export calendrier (.ics) pour un traitement ---- */
    icsForTreatment(t) {
      const due = this.nextDue(t) || todayISO();
      const dt = due.replace(/-/g, '');
      const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
      const dog = state.settings.dogName || 'Hatchi';
      const esc = (x) => String(x || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, ' ');
      return [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hatchi//FR//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        'UID:hatchi-' + t.id + '-' + dt + '@hatchi.local',
        'DTSTAMP:' + stamp,
        'DTSTART:' + dt + 'T090000',
        'DTEND:' + dt + 'T093000',
        'RRULE:FREQ=' + (t.unit === 'jours' ? 'DAILY' : t.unit === 'ans' ? 'YEARLY' : 'MONTHLY') + ';INTERVAL=' + (t.every || 1),
        'SUMMARY:' + esc('🐾 ' + dog + ' — ' + t.name),
        'DESCRIPTION:' + esc(t.notes || ('Soin : ' + t.name)),
        'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(t.name), 'END:VALARM',
        'END:VEVENT', 'END:VCALENDAR'
      ].join('\r\n');
    },

    /* ---- Sync ---- */
    initSync,
    forcePull: () => pull(true),
    forcePush: () => push(),
    testConnection,

    /* ---- Backup ---- */
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(text) {
      const obj = JSON.parse(text);
      this.replaceState(obj);
    },
    resetAll() {
      const conn = {
        supabaseUrl: state.settings.supabaseUrl,
        supabaseKey: state.settings.supabaseKey,
        spaceId: state.settings.spaceId
      };
      state = emptyState();
      Object.assign(state.settings, conn);
      persistLocal(); emit(); schedulePush();
    }
  };

  window.Store = Store;
})();
