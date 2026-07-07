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
      V('Poulet entier', 'entier', 'g', 0),
      V('Lapin entier', 'entier', 'g', 0),
      V('Poussin', 'entier', 'piece', 0),
      V('Caille', 'entier', 'piece', 0),
      V('Sardine entière', 'entier', 'g', 0),
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

  // Morceaux proposés à la saisie d'un achat (viandes/abats). Modifiables dans Réglages.
  function seedCuts() {
    return ['filet', 'blanc', 'cuisse', 'haut de cuisse', 'pilon', 'aile', 'manchon', 'escalope',
      'bavette', 'paleron', 'gîte', 'basse côte', 'collier', 'jarret', 'joue', 'macreuse', 'plat de côtes', 'tendron',
      'épaule', 'gigot', 'côte', 'foie', 'cœur', 'rognons', 'gésier', 'poumon', 'rate', 'tripes'];
  }

  // Humeurs/forme proposées dans le journal. Modifiables dans Réglages.
  function seedMoods() {
    return ['😀 En forme', '😐 Calme', '😟 Fatigué', '😴 Épuisé', '🤩 Excité', '😰 Stressé', '😠 Agressif', '🤢 Malade'];
  }

  // Pharmacie : fiches produits structurées — principes actifs [{name, amount}] avec milligrammage,
  // posologie décomposée (posoQty quantité, posoForm forme, posoEvery+posoUnit fréquence, posoNote précisions).
  function seedPharmacy() {
    const M = (name, actives, poso, notes) => Object.assign({ id: uid(), name, actives, notes: notes || '' }, poso);
    return [
      M('Drontal (vermifuge)',
        [{ name: 'praziquantel', amount: '50 mg' }, { name: 'pyrantel (embonate)', amount: '144 mg' }, { name: 'fébantel', amount: '150 mg' }],
        { posoQty: 1.5, posoForm: 'comprimé', posoEvery: 3, posoUnit: 'mois', posoNote: 'avec ou sans nourriture' },
        'Vermifuge large spectre (vers ronds et plats). Dosages par comprimé — 1 comprimé pour 10 kg.'),
      M('Seresto (collier anti-puces/tiques)',
        [{ name: 'imidaclopride', amount: '4,50 g' }, { name: 'fluméthrine', amount: '2,03 g' }],
        { posoQty: 1, posoForm: 'collier', posoEvery: 8, posoUnit: 'mois', posoNote: 'modèle grand chien (> 8 kg)' },
        'Retirer pour les baignades prolongées.'),
      M('Biseptine',
        [{ name: 'chlorhexidine (digluconate)', amount: '0,25 g/100 ml' }, { name: 'chlorure de benzalkonium', amount: '0,025 g/100 ml' }],
        { posoQty: 1, posoForm: 'application', posoEvery: 3, posoUnit: 'fois par jour', posoNote: 'sur peau propre' },
        'Antiseptique cutané — éviter les yeux.')
    ];
  }

  // Personnes qui s'occupent du chien (repris du sheet HATCHI 2026). Modifiables.
  function seedPeople() {
    return ['Flo', 'Fanny', 'Alex', 'Noune'].map((n) => ({ id: uid(), name: n }));
  }

  // Fiches de référence du carnet (type carnet de santé vétérinaire). Modifiables/supprimables.
  function seedHealthPages() {
    const P = (icon, title, content) => ({ id: uid(), icon, title, content, updatedAt: todayISO() });
    return [
      P('💉', 'Vaccins & rappels',
`Protocole classique (à valider avec votre vétérinaire) :
• Primo-vaccination chiot : 8 semaines (CHP), 12 semaines (CHPL + rage si besoin), parfois 16 semaines.
• Rappel à 1 an, puis :
  – Carré, Hépatite, Parvovirose : tous les 1 à 3 ans
  – Leptospirose : tous les ans
  – Rage : tous les 1 à 3 ans selon le vaccin (obligatoire pour voyager)
  – Toux du chenil : tous les ans si pension, expo ou contacts fréquents
• Notez chaque injection et son rappel dans l'onglet Vaccins.`),
      P('🦠', 'Maladies infectieuses principales',
`• Maladie de Carré : virus grave (fièvre, troubles digestifs, respiratoires puis nerveux). Le vaccin protège très bien.
• Parvovirose : gastro-entérite hémorragique très contagieuse, dangereuse surtout pour les chiots.
• Hépatite de Rubarth : atteinte du foie, rare grâce à la vaccination.
• Leptospirose : bactérie transmise par les urines de rongeurs et les eaux stagnantes. Transmissible à l'homme. Vaccin annuel.
• Rage : mortelle, transmissible à l'homme. Vaccin obligatoire pour voyager.
• Toux du chenil : trachéo-bronchite très contagieuse (chenils, pensions, expositions).
• Piroplasmose : transmise par les tiques — abattement, fièvre, urines foncées → urgence vétérinaire.`),
      P('🪱', 'Parasites intestinaux',
`• Vers ronds (ascaris, ankylostomes) : fréquents chez le chiot — amaigrissement, diarrhée, ventre gonflé.
• Vers plats (ténia, Dipylidium transmis par les puces) : petits segments « grains de riz » dans les selles.
• Giardia : diarrhées chroniques.
Prévention :
• Vermifuge tous les 3 mois chez l'adulte (ex. Drontal), tous les mois jusqu'à 6 mois chez le chiot.
• Traiter aussi contre les puces (cycle du ténia) et ramasser les selles.`),
      P('🦟', 'Puces & tiques',
`• Puces : démangeaisons, allergie (DAPP), transmettent le ténia. Protection toute l'année : collier (type Seresto, ~8 mois), pipettes ou comprimés. En cas d'infestation, traiter aussi la maison (paniers, plinthes).
• Tiques : transmettent piroplasmose, maladie de Lyme, ehrlichiose. Inspecter le chien après chaque balade en forêt ou hautes herbes ; retirer avec un crochet à tiques (jamais d'éther), puis désinfecter.
• Dans les jours qui suivent une morsure, surveiller fièvre, abattement, urines foncées → vétérinaire.`),
      P('✈️', 'Voyager à l\'étranger',
`Union européenne :
• Puce électronique (ou tatouage lisible d'avant juillet 2011)
• Passeport européen délivré par le vétérinaire
• Vaccin rage en cours de validité, fait au moins 21 jours avant le départ
• Vermifuge contre l'échinocoque 1 à 5 jours avant l'entrée en Irlande, à Malte, en Finlande, en Norvège (et Royaume-Uni).
Hors UE : se renseigner tôt — titrage antirabique parfois exigé, avec des délais de 3 à 4 mois. Pour revenir en France depuis certains pays, le titrage doit être fait AVANT le départ.
Vérifier les règles à jour auprès du vétérinaire (ou anivetvoyage.com).`),
      P('🚗', 'Voyager avec son chien',
`Voiture : harnais attaché à la ceinture, caisse ou filet de séparation. Pause toutes les 2 h (eau + besoins). Ne jamais laisser le chien seul dans une voiture au soleil — coup de chaleur mortel même vitres entrouvertes.
Train (SNCF) : billet « animal », muselière exigible pour les grands chiens, carnet à jour.
Avion : cabine pour les petits gabarits (selon compagnie), sinon soute pressurisée en caisse aux normes IATA. Éviter les fortes chaleurs, se renseigner tôt.
À emporter : eau + gamelle, sacs, carnet de santé/passeport, tapis, jouet familier, trousse (tire-tique, désinfectant).`)
    ];
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
      meals: [],                 // (hérité) anciens repas-types nommés
      doses: {},                 // quantités types par aliment : ingredientId => {matin: qty, soir: qty}
      rotation: {},              // clé "w{week}-{dayIdx}-{slot}" => [{ingredientId, qty}...]  (slot: 'matin'|'soir')
      treatments: seedTreatments(),
      journal: {},               // dateISO => {repasMatin,repasSoir,selles,humeur,sorties:{},who:{},promeneur,temp,soins:[],notes,photo}
      weights: [],               // [{id, date, kg}]
      stock: {},                 // congélateur : ingredientId => quantité (g ou pièces)
      fridge: {},                // frigo (décongelé / frais) : ingredientId => quantité
      people: seedPeople(),      // [{id, name}]
      purchases: [],             // [{id, date, items:[{ingredientId, qty}], cost}]
      cuts: seedCuts(),          // morceaux suggérés (['cuisse', 'bavette', …])
      fed: [],                   // repas réellement donnés : [{id, date, slot, items:[{ingredientId, qty}]}]
      todos: [],                 // choses à faire : [{id, text, done, doneAt}]
      moods: seedMoods(),        // humeurs proposées dans le journal
      pharmacy: seedPharmacy(),  // fiches médicaments/produits : [{id, name, dose, actives, notes}]
      identity: { chipNumber: '', chipPhoto: '', identDate: '', identVet: '', prevOwner: '', prevVet: '' }, // puce, véto identificateur, ancien détenteur/véto
      vetCurrent: { name: '', phone: '', address: '' },  // vétérinaire actuel
      vetEmergency: { name: '', phone: '', address: '' }, // urgences vétérinaires (garde 24h/24)
      documents: [],             // papiers du chien : [{id, name, mime, size, dataURL, addedAt}]
      vaccinations: [],          // [{id, name, date, booster, vet, notes}]
      healthPages: seedHealthPages() // fiches de référence du carnet
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

  // Produits « frais » (rangés au frigo à l'achat plutôt qu'au congélo)
  const isFresh = (ing) => !!ing && (ing.category === 'oeuf' || ing.category === 'legume');

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
    return migrate(emptyState());
  }
  // Repas types du tableau « Ex S1 » du sheet HATCHI 2026 (BARF viande maison) :
  // matin = viande 500 g + légume ; soir = viande 300-500 g + légume + abats/œuf/os.
  // Idempotent (par nom). Renvoie {clé: mealId} pour construire la rotation type.
  function ensureSheetMeals(s) {
    const ingByName = {};
    s.ingredients.forEach((i) => { ingByName[i.name.toLowerCase()] = i; });
    const ing = (name, cat, unit) => {
      let i = ingByName[name.toLowerCase()];
      if (!i) { i = { id: uid(), name, category: cat, unit, price: 0 }; s.ingredients.push(i); ingByName[name.toLowerCase()] = i; }
      return i.id;
    };
    ing('Riz cuit', 'autre', 'g'); // féculent, à ajouter aux repas selon les besoins
    const it = (name, cat, unit, qty) => ({ ingredientId: ing(name, cat, unit), qty });
    const V = (n, q) => it(n, 'viande', 'g', q);
    const L = (n, q) => it(n, 'legume', 'g', q);
    const OEUF = () => it('Œuf', 'oeuf', 'piece', 1);
    const OS = () => it('Os charnu', 'os', 'piece', 1);
    const AB = (q) => it('Abats (lot)', 'abats', 'g', q);
    const mealByName = {};
    s.meals.forEach((m) => { mealByName[(m.name || '').toLowerCase()] = m.id; });
    const meal = (name, slot, items) => {
      const k = name.toLowerCase();
      if (!mealByName[k]) { const m = { id: uid(), name, slot, items }; s.meals.push(m); mealByName[k] = m.id; }
      return mealByName[k];
    };
    return {
      // le matin : 300 g de viande (Hatchi mange moins le matin)
      pouletOeufCarotte:     meal('Poulet + œuf + carotte', 'matin', [V('Poulet (filet)', 300), OEUF(), L('Carotte', 200)]),
      pouletCarotte:         meal('Poulet + carotte', 'matin', [V('Poulet (filet)', 300), L('Carotte', 100)]),
      dindeCourgette:        meal('Dinde + courgette', 'matin', [V('Dinde', 300), L('Courgette', 100)]),
      pouletOsHaricots:      meal('Poulet + os + haricots verts', 'matin', [V('Poulet (filet)', 300), OS(), L('Haricot vert', 100)]),
      dindeBrocoli:          meal('Dinde + brocoli', 'matin', [V('Dinde', 300), L('Brocoli', 100)]),
      pouletEpinards:        meal('Poulet + épinards', 'matin', [V('Poulet (filet)', 300), L('Épinard', 100)]),
      dindeOsCourgette:      meal('Dinde + os + courgette', 'matin', [V('Dinde', 300), OS(), L('Courgette', 100)]),
      lapinCarotte:          meal('Lapin + carotte', 'matin', [V('Lapin', 300), L('Carotte', 100)]),
      dindeAbatsBrocoli:     meal('Dinde + abats + brocoli', 'soir', [V('Dinde', 300), AB(200), L('Brocoli', 100)]),
      boeufOsOeufHaricots:   meal('Bœuf + os + œuf + haricots verts', 'soir', [V('Bœuf', 400), OS(), OEUF(), L('Haricot vert', 100)]),
      boeufAbatsPotiron:     meal('Bœuf + abats + potiron', 'soir', [V('Bœuf', 300), AB(200), L('Potiron', 100)]),
      agneauOeufCourgette:   meal('Agneau + œuf + courgette', 'soir', [V('Agneau', 400), OEUF(), L('Courgette', 100)]),
      agneauOeufCarotte:     meal('Agneau + œuf + carotte', 'soir', [V('Agneau', 500), OEUF(), L('Carotte', 100)]),
      pouletAbatsPetitsPois: meal('Poulet + abats + petits pois', 'soir', [V('Poulet (filet)', 500), AB(200), L('Petit pois', 100)]),
      boeufOeufPatateDouce:  meal('Bœuf + œuf + patate douce', 'soir', [V('Bœuf', 400), OEUF(), L('Patate douce', 100)]),
      lapinAbatsEpinards:    meal('Lapin + abats + épinards', 'soir', [V('Lapin', 300), AB(200), L('Épinard', 100)]),
      saumonCourgette:       meal('Saumon + courgette', 'soir', [V('Saumon', 400), L('Courgette', 100)]),
      coteBroutardBrocoli:   meal('Côte de broutard + brocoli', 'soir', [V('Côte de broutard', 400), L('Brocoli', 100)])
    };
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
    if (typeof s.fridge !== 'object' || !s.fridge) s.fridge = {};
    if (!Array.isArray(s.people)) s.people = seedPeople();
    if (!Array.isArray(s.purchases)) s.purchases = [];
    if (!Array.isArray(s.cuts)) s.cuts = seedCuts();
    if (!Array.isArray(s.fed)) s.fed = [];
    if (!Array.isArray(s.moods)) s.moods = seedMoods();
    if (!Array.isArray(s.todos)) s.todos = [];
    if (!Array.isArray(s.pharmacy)) s.pharmacy = [];
    s.identity = Object.assign({}, base.identity, s.identity || {});
    s.vetCurrent = Object.assign({}, base.vetCurrent, s.vetCurrent || {});
    s.vetEmergency = Object.assign({}, base.vetEmergency, s.vetEmergency || {});
    if (!Array.isArray(s.documents)) s.documents = [];
    if (!Array.isArray(s.vaccinations)) s.vaccinations = [];
    if (!Array.isArray(s.healthPages)) s.healthPages = [];
    // Onglet « Animaux entiers » : ajoute les articles par défaut aux données existantes
    if (!s.ingredients.some((i) => i.category === 'entier')) s.ingredients = s.ingredients.concat(base.ingredients.filter((i) => i.category === 'entier'));
    // Créneau matin/soir des repas : déduit du nom « … (matin) » / « … (soir…) », puis nettoyé
    s.meals.forEach((m) => {
      if (m.slot) return;
      const match = (m.name || '').match(/\s*\((matin|soir)[^)]*\)\s*$/i);
      m.slot = match ? match[1].toLowerCase() : 'matin';
      if (match) m.name = m.name.replace(/\s*\((matin|soir)[^)]*\)\s*$/i, '');
    });
    // Repas types : créés une seule fois (supprimables ensuite sans qu'ils reviennent)
    if (typeof s.seeded !== 'object' || !s.seeded) s.seeded = {};
    if (!s.seeded.mealsExS1) {
      // Fini les boudins DogChef : on retire les repas/ingrédients « boudins » seedés par la v10
      const boudinMeals = ['Boudin porc (400 g)', 'Boudin poulet (400 g)', 'Boudin bœuf (400 g)', 'Boudin canard (400 g)',
        'Boudin poisson (400 g)', 'Pâtée (400 g)', 'Moitié boudin poulet (200 g)', 'Moitié boudin canard (200 g)', 'Moitié boudin porc (200 g)'];
      const removedIds = s.meals.filter((m) => boudinMeals.includes(m.name)).map((m) => m.id);
      s.meals = s.meals.filter((m) => !boudinMeals.includes(m.name));
      Object.keys(s.rotation).forEach((k) => { s.rotation[k] = (s.rotation[k] || []).filter((id) => !removedIds.includes(id)); });
      const boudinIngs = ['Boudin porc', 'Boudin poulet', 'Boudin bœuf', 'Boudin canard', 'Boudin poisson', 'Pâtée'];
      s.ingredients = s.ingredients.filter((i) => !(boudinIngs.includes(i.name)
        && !(s.stock[i.id] > 0)
        && !s.purchases.some((p) => (p.items || []).some((x) => x.ingredientId === i.id))
        && !s.meals.some((m) => (m.items || []).some((x) => x.ingredientId === i.id))));
      s.seeded.mealsExS1 = true;
    }
    // Repas des rotations 4 semaines (lapin, saumon, côte de broutard…) : seedés une fois
    if (!s.seeded.mealsRotation4) { ensureSheetMeals(s); s.seeded.mealsRotation4 = true; }
    // Matins allégés (06/07/2026) : les repas types du matin passent de 500 g à 300 g de viande
    if (!s.seeded.matin300) {
      s.meals.forEach((m) => {
        if ((m.slot || 'matin') !== 'matin') return;
        (m.items || []).forEach((it) => {
          const ing = s.ingredients.find((i) => i.id === it.ingredientId);
          if (ing && ing.category === 'viande' && it.qty === 500) it.qty = 300;
        });
      });
      s.seeded.matin300 = true;
    }
    // Pharmacie : seedée une fois + liaison automatique aux soins existants (vermifuge → Drontal, collier → Seresto)
    if (!s.seeded.pharmacy) {
      const have = new Set(s.pharmacy.map((p) => p.name.toLowerCase()));
      s.pharmacy = s.pharmacy.concat(seedPharmacy().filter((p) => !have.has(p.name.toLowerCase())));
      const byType = { vermifuge: 'drontal', collier: 'seresto' };
      s.treatments.forEach((t) => {
        if (t.medId || !byType[t.type]) return;
        const med = s.pharmacy.find((p) => p.name.toLowerCase().includes(byType[t.type]));
        if (med) t.medId = med.id;
      });
      s.seeded.pharmacy = true;
    }
    // Pharmacie v2 : passage au format structuré (actifs avec dosage, posologie décomposée)
    if (!s.seeded.pharmacyV2) {
      const V20 = { // valeurs seedées en v20 : si intactes, on remplace par la fiche structurée complète
        'drontal (vermifuge)': ['1 comprimé et demi, tous les 3 mois', 'praziquantel, pyrantel, fébantel'],
        'seresto (collier anti-puces/tiques)': ['1 collier, efficace environ 8 mois', 'imidaclopride, fluméthrine'],
        'biseptine': ['Application locale 2 à 3 fois par jour, sur peau propre', 'chlorhexidine, chlorure de benzalkonium']
      };
      const structured = seedPharmacy();
      s.pharmacy = s.pharmacy.map((p) => {
        if (Array.isArray(p.actives)) return p; // déjà au nouveau format
        const key = (p.name || '').toLowerCase();
        const neuf = structured.find((x) => x.name.toLowerCase() === key);
        if (neuf && V20[key] && p.dose === V20[key][0] && p.actives === V20[key][1]) return Object.assign({}, neuf, { id: p.id });
        // conversion générique : rien n'est perdu (ancienne posologie → précisions, actifs → lignes sans dosage)
        return Object.assign({}, p, {
          actives: p.actives ? String(p.actives).split(',').map((a) => ({ name: a.trim(), amount: '' })) : [],
          posoQty: '', posoForm: 'autre', posoEvery: '', posoUnit: 'jours', posoNote: p.dose || ''
        });
      });
      s.seeded.pharmacyV2 = true;
    }
    // Rotation v2 : les créneaux stockent directement les aliments+quantités (plus de repas nommés)
    if (typeof s.doses !== 'object' || !s.doses) s.doses = {};
    if (!s.seeded.rotationItems) {
      Object.keys(s.rotation).forEach((k) => {
        const v = s.rotation[k] || [];
        if (v.length && typeof v[0] === 'string') {
          const items = [];
          v.forEach((mid) => {
            const m = s.meals.find((x) => x.id === mid);
            if (m) (m.items || []).forEach((x) => items.push({ ingredientId: x.ingredientId, qty: x.qty }));
          });
          s.rotation[k] = items;
        }
      });
      s.seeded.rotationItems = true;
    }
    // Quantités types : dérivées une fois des anciens repas-types (modifiables dans Repas → Quantités)
    if (!s.seeded.dosesV1) {
      s.meals.forEach((m) => {
        const slot = m.slot === 'soir' ? 'soir' : 'matin';
        (m.items || []).forEach((it) => {
          const d = s.doses[it.ingredientId] || (s.doses[it.ingredientId] = {});
          if (d[slot] == null) d[slot] = it.qty;
        });
      });
      s.seeded.dosesV1 = true;
    }
    // Fiches du carnet de référence : seedées une fois (modifiables/supprimables ensuite)
    if (!s.seeded.healthPages) {
      const have = new Set(s.healthPages.map((p) => p.title.toLowerCase()));
      s.healthPages = s.healthPages.concat(seedHealthPages().filter((p) => !have.has(p.title.toLowerCase())));
      s.seeded.healthPages = true;
    }
    // Frigo v1 : les œufs et légumes déjà en stock déménagent du congélo vers le frigo (une fois)
    if (!s.seeded.fridgeV1) {
      s.ingredients.forEach((i) => {
        if ((i.category === 'oeuf' || i.category === 'legume') && s.stock[i.id] > 0) {
          s.fridge[i.id] = (s.fridge[i.id] || 0) + s.stock[i.id];
          delete s.stock[i.id];
        }
      });
      s.seeded.fridgeV1 = true;
    }
    // Production maison : les œufs à prix 0 deviennent « coût zéro € » + ajout de l'œuf de caille
    if (!s.seeded.homemadeEggs) {
      s.ingredients.forEach((i) => { if (i.category === 'oeuf' && !i.price) i.free = true; });
      if (!s.ingredients.some((i) => i.name.toLowerCase() === 'œuf de caille')) {
        s.ingredients.push({ id: uid(), name: 'Œuf de caille', category: 'oeuf', unit: 'piece', price: 0, free: true });
      }
      s.seeded.homemadeEggs = true;
    }
    // Fiche « Contacts vétérinaires » du carnet : ancien véto, urgences près de chez moi, ancien détenteur
    if (!s.seeded.contactsPage) {
      s.healthPages.unshift({
        id: uid(), icon: '📞', title: 'Contacts vétérinaires', updatedAt: todayISO(),
        content:
`Vétérinaire actuel : renseigné dans Soins → Identité (bouton 📞 en haut de l'app pour appeler).

Urgences vétérinaires près de chez moi (24h/24) :
• Clinique de garde : ………………… — tél : …………………
• Centre hospitalier vétérinaire : ………………… — tél : …………………

Ancien vétérinaire (quand elle était bébé) : …………………
Ancien détenteur (qui me l'a cédée) : …………………

En cas d'urgence : appeler AVANT de partir (l'équipe prépare l'arrivée), transporter au calme, ne rien donner à manger ni à boire sans avis vétérinaire.`
      });
      s.seeded.contactsPage = true;
    }
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
    addMeal(data) { const m = Object.assign({ id: uid(), name: '', slot: 'matin', items: [] }, data); commit((s) => s.meals.push(m)); return m; },
    updateMeal(id, patch) { commit((s) => { const m = s.meals.find((x) => x.id === id); if (m) Object.assign(m, patch); }); },
    removeMeal(id) {
      commit((s) => {
        s.meals = s.meals.filter((x) => x.id !== id);
        Object.keys(s.rotation).forEach((k) => { s.rotation[k] = (s.rotation[k] || []).filter((mid) => mid !== id); });
      });
    },

    /* ---- Quantités types (doses par aliment, par créneau) ---- */
    doses: () => state.doses,
    // Dose type d'un aliment pour un créneau ; à défaut, valeur raisonnable selon la catégorie
    doseFor(ingId, slot) {
      const d = state.doses[ingId];
      if (d && d[slot] != null && d[slot] !== '') return d[slot];
      const ing = this.ingredient(ingId);
      if (!ing) return 100;
      if (ing.unit === 'piece') return 1;
      if (ing.category === 'viande' || ing.category === 'entier') return slot === 'soir' ? 400 : 300;
      if (ing.category === 'abats') return 200;
      return 100;
    },
    setDose(ingId, slot, qty) { commit((s) => { const d = s.doses[ingId] || (s.doses[ingId] = {}); d[slot] = qty; }); },
    removeDose(ingId, slot) {
      commit((s) => {
        const d = s.doses[ingId];
        if (d) { delete d[slot]; if (!Object.keys(d).length) delete s.doses[ingId]; }
      });
    },

    /* ---- Rotation (les créneaux contiennent directement les aliments + quantités) ---- */
    rotationKey: (week, dayIdx, slot) => `w${week}-${dayIdx}-${slot}`,
    getRotation(week, dayIdx, slot) {
      return (state.rotation[`w${week}-${dayIdx}-${slot}`] || []).filter((x) => x && typeof x === 'object');
    },
    setRotation(week, dayIdx, slot, items) {
      commit((s) => {
        s.rotation[`w${week}-${dayIdx}-${slot}`] = (items || [])
          .filter((it) => it.ingredientId && it.qty > 0)
          .map((it) => ({ ingredientId: it.ingredientId, qty: +it.qty }));
      });
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
    // Aliments prévus par la rotation pour une date/créneau : [{ingredientId, qty}]
    itemsForDay(iso, slot) {
      const { week, dayIdx } = this.cyclePosition(iso);
      return this.getRotation(week, dayIdx, slot);
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
      const add = (cat, pids) => (pids || []).forEach((pid) => { if (out[pid]) { out[pid][cat]++; out[pid].total++; } });
      days.forEach((iso) => {
        const w = (state.journal[iso] || {}).who || {};
        add('balade', w.ville); add('balade', w.foret); add('balade', w.balade); // balade = ville + forêt (+ ancien)
        add('educ', w.educ); add('veto', w.veto);
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
      ['matin', 'soir'].forEach((slot) => this.itemsForDay(iso, slot).forEach((it) => {
        const ing = this.ingredient(it.ingredientId); if (ing && ing.unit === 'g') g += (it.qty || 0);
      }));
      return g;
    },
    // Répartition BARF sur une plage ('week' = semaine en cours, 'month' = 30 j)
    barfBalance(range) {
      const acc = { muscle: 0, os: 0, abats: 0, legume: 0, autre: 0, osPieces: 0 };
      listDates(range || 'week', {}).forEach((iso) => {
        ['matin', 'soir'].forEach((slot) => this.itemsForDay(iso, slot).forEach((it) => {
          const ing = this.ingredient(it.ingredientId);
          if (!ing) return;
          const cls = barfClass(ing);
          if (ing.unit === 'piece') { if (cls === 'os') acc.osPieces += (it.qty || 0); }
          else acc[cls] += (it.qty || 0);
        }));
      });
      const base = acc.muscle + acc.abats; // muscle vs abats (os en pièces géré à part)
      acc.musclePct = base ? Math.round(acc.muscle / base * 100) : 0;
      acc.abatsPct = base ? Math.round(acc.abats / base * 100) : 0;
      return acc;
    },

    /* ---- Stock : congélateur + frigo (décongelé/frais) ---- */
    congeloOf(id) { return Math.max(0, Math.round(state.stock[id] || 0)); },
    fridgeOf(id) { return Math.max(0, Math.round(state.fridge[id] || 0)); },
    stockOf(id) { return this.congeloOf(id) + this.fridgeOf(id); }, // total disponible
    setStock(id, val, loc) { commit((s) => { (loc === 'frigo' ? s.fridge : s.stock)[id] = Math.max(0, val || 0); }); },
    adjustStock(id, delta, loc) { commit((s) => { const t = loc === 'frigo' ? s.fridge : s.stock; t[id] = Math.max(0, (t[id] || 0) + delta); }); },
    // Transfert congélo ⇄ frigo (ex. sortir 500 g à décongeler)
    transferStock(id, qty, toFridge) {
      commit((s) => {
        const from = toFridge ? s.stock : s.fridge;
        const to = toFridge ? s.fridge : s.stock;
        const q = Math.min(Math.max(0, qty || 0), from[id] || 0);
        if (!q) return;
        from[id] -= q;
        to[id] = (to[id] || 0) + q;
      });
    },
    // Besoins agrégés sur une plage => {id: qty}
    needs(range) {
      const totals = {};
      listDates(range || 'week', {}).forEach((iso) => {
        ['matin', 'soir'].forEach((slot) => this.itemsForDay(iso, slot).forEach((it) => {
          totals[it.ingredientId] = (totals[it.ingredientId] || 0) + (it.qty || 0);
        }));
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
    /* ---- Identité (puce, véto) & documents ---- */
    updateIdentity(patch) { commit((s) => Object.assign(s.identity, patch)); },
    updateVet(patch) { commit((s) => Object.assign(s.vetCurrent, patch)); },
    updateVetEmergency(patch) { commit((s) => Object.assign(s.vetEmergency, patch)); },
    addDocument(doc) { const d = Object.assign({ id: uid(), addedAt: todayISO() }, doc); commit((s) => s.documents.push(d)); return d; },
    removeDocument(id) { commit((s) => { s.documents = s.documents.filter((x) => x.id !== id); }); },

    /* ---- Vaccinations ---- */
    addVaccination(data) { const v = Object.assign({ id: uid(), name: '', date: todayISO(), booster: '', vet: '', notes: '' }, data); commit((s) => s.vaccinations.push(v)); return v; },
    updateVaccination(id, patch) { commit((s) => { const v = s.vaccinations.find((x) => x.id === id); if (v) Object.assign(v, patch); }); },
    removeVaccination(id) { commit((s) => { s.vaccinations = s.vaccinations.filter((x) => x.id !== id); }); },
    vaccinationsSorted() { return state.vaccinations.slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')); },

    /* ---- Carnet de référence (fiches) ---- */
    addHealthPage(data) { const p = Object.assign({ id: uid(), icon: '📄', title: '', content: '', updatedAt: todayISO() }, data); commit((s) => s.healthPages.push(p)); return p; },
    updateHealthPage(id, patch) { commit((s) => { const p = s.healthPages.find((x) => x.id === id); if (p) { Object.assign(p, patch); p.updatedAt = todayISO(); } }); },
    removeHealthPage(id) { commit((s) => { s.healthPages = s.healthPages.filter((x) => x.id !== id); }); },

    /* ---- Suggestion de repas selon le stock (petit « agent » local) ----
       Compose viande + légume (+ os/abats/œuf selon l'équilibre BARF de la semaine)
       uniquement avec ce qui est réellement en stock. */
    suggestMealFromStock(slot) {
      slot = slot || 'matin';
      const stock = (id) => this.stockOf(id);
      const inStock = (cat) => state.ingredients.filter((i) => i.category === cat && stock(i.id) > 0);
      const meats = inStock('viande');
      if (!meats.length) return { error: 'Aucune viande en stock — enregistre d\'abord un achat.' };
      // viande avec le plus de réserve (favorise l'écoulement du congélateur)
      const meat = meats.slice().sort((a, b) => stock(b.id) - stock(a.id))[0];
      const items = [{ ingredientId: meat.id, qty: Math.min(slot === 'soir' ? 400 : 300, stock(meat.id)) }];
      const nameParts = [meat.name.replace(/\s*\(.*\)\s*$/, '')];
      const bal = this.barfBalance('week');
      if (slot === 'soir') {
        const abats = inStock('abats')[0];
        const oeuf = inStock('oeuf')[0];
        if (abats && bal.abatsPct < 10) { items.push({ ingredientId: abats.id, qty: Math.min(200, stock(abats.id)) }); nameParts.push('abats'); }
        else if (oeuf) { items.push({ ingredientId: oeuf.id, qty: 1 }); nameParts.push('œuf'); }
      } else {
        const os = inStock('os')[0];
        if (os && bal.osPieces < 3) { items.push({ ingredientId: os.id, qty: 1 }); nameParts.push('os'); }
      }
      const legs = inStock('legume');
      if (legs.length) {
        const leg = legs[Math.floor(Math.random() * legs.length)];
        items.push({ ingredientId: leg.id, qty: Math.min(100, stock(leg.id)) });
        nameParts.push(leg.name.toLowerCase());
      }
      return { name: nameParts.join(' + '), slot, items };
    },

    /* ---- Pharmacie (fiches médicaments/produits) ---- */
    pharmacy: () => state.pharmacy.slice(),
    pharmaMed: (id) => state.pharmacy.find((p) => p.id === id),
    // Posologie lisible : « 1,5 comprimés · tous les 3 mois · avec le repas »
    pharmaPosology(p) {
      if (!p) return '';
      const parts = [];
      if (p.posoQty) {
        const qs = (+p.posoQty).toLocaleString('fr-FR');
        const f = p.posoForm || '';
        parts.push(f === 'g' || f === 'ml' ? qs + ' ' + f : (!f || f === 'autre') ? qs : qs + ' ' + f + (+p.posoQty > 1 ? 's' : ''));
      }
      if (p.posoEvery) parts.push(p.posoUnit === 'fois par jour' ? p.posoEvery + ' fois par jour' : 'tous les ' + p.posoEvery + ' ' + p.posoUnit);
      if (p.posoNote) parts.push(p.posoNote);
      if (!parts.length && p.dose) return p.dose; // ancien format
      return parts.join(' · ');
    },
    // Principes actifs lisibles : « praziquantel 50 mg, pyrantel 144 mg »
    pharmaActives(p) {
      if (!p) return '';
      if (Array.isArray(p.actives)) return p.actives.map((a) => a.name + (a.amount ? ' ' + a.amount : '')).join(', ');
      return p.actives || '';
    },
    addPharmaMed(data) { const p = Object.assign({ id: uid(), name: '', actives: [], posoQty: '', posoForm: 'comprimé', posoEvery: '', posoUnit: 'mois', posoNote: '', notes: '' }, data); commit((s) => s.pharmacy.push(p)); return p; },
    updatePharmaMed(id, patch) { commit((s) => { const p = s.pharmacy.find((x) => x.id === id); if (p) Object.assign(p, patch); }); },
    removePharmaMed(id) {
      commit((s) => {
        s.pharmacy = s.pharmacy.filter((x) => x.id !== id);
        s.treatments.forEach((t) => { if (t.medId === id) t.medId = null; }); // les journées gardent le nom copié
      });
    },

    /* ---- Choses à faire (tableau de bord) ---- */
    // Visibles : non faites, ou faites aujourd'hui (elles disparaissent le lendemain)
    todosVisible() { const today = todayISO(); return state.todos.filter((t) => !t.done || t.doneAt === today); },
    addTodo(text) {
      text = (text || '').trim();
      if (!text) return null;
      const t = { id: uid(), text, done: false, doneAt: '' };
      commit((s) => s.todos.push(t));
      return t;
    },
    toggleTodo(id) {
      commit((s) => {
        const t = s.todos.find((x) => x.id === id);
        if (t) { t.done = !t.done; t.doneAt = t.done ? todayISO() : ''; }
      });
    },
    removeTodo(id) { commit((s) => { s.todos = s.todos.filter((x) => x.id !== id); }); },

    /* ---- Humeurs (liste modifiable du journal) ---- */
    moods: () => state.moods.slice(),
    addMood(name) {
      name = (name || '').trim();
      if (!name || state.moods.some((m) => m.toLowerCase() === name.toLowerCase())) return false;
      commit((s) => s.moods.push(name));
      return true;
    },
    renameMood(oldName, newName) {
      newName = (newName || '').trim();
      if (!newName) return;
      commit((s) => {
        const i = s.moods.indexOf(oldName);
        if (i >= 0) s.moods[i] = newName;
        // met à jour les journées déjà notées avec l'ancien libellé
        Object.values(s.journal).forEach((d) => { if (d.humeur === oldName) d.humeur = newName; });
      });
    },
    removeMood(name) { commit((s) => { s.moods = s.moods.filter((m) => m !== name); }); },

    /* ---- Morceaux (suggestions pour les achats) ---- */
    cuts: () => state.cuts.slice(),
    hasCut(name) { return state.cuts.some((c) => c.toLowerCase() === (name || '').trim().toLowerCase()); },
    addCut(name) {
      name = (name || '').trim();
      if (!name || this.hasCut(name)) return false;
      commit((s) => s.cuts.push(name));
      return true;
    },
    renameCut(oldName, newName) {
      newName = (newName || '').trim();
      if (!newName) return;
      commit((s) => { const i = s.cuts.indexOf(oldName); if (i >= 0) s.cuts[i] = newName; });
    },
    removeCut(name) { commit((s) => { s.cuts = s.cuts.filter((c) => c !== name); }); },

    /* ---- Achats (ajoutent au stock) ---- */
    addPurchase({ date, items, cost }) {
      const clean = (items || []).filter((it) => it.ingredientId && it.qty > 0);
      if (!clean.length) return null;
      const purchase = { id: uid(), date: date || todayISO(), items: clean.map((it) => { const o = { ingredientId: it.ingredientId, qty: it.qty }; if (it.cut) o.cut = it.cut; if (it.price) o.price = +it.price; return o; }), cost: cost ? +cost : 0 };
      commit((s) => {
        // viandes/os → congélo ; œufs & légumes (frais) → frigo
        clean.forEach((it) => {
          const ing = s.ingredients.find((i) => i.id === it.ingredientId);
          const t = isFresh(ing) ? s.fridge : s.stock;
          t[it.ingredientId] = (t[it.ingredientId] || 0) + it.qty;
        });
        // un morceau inconnu rejoint automatiquement la liste des suggestions
        clean.forEach((it) => {
          const cut = (it.cut || '').trim();
          if (cut && !s.cuts.some((c) => c.toLowerCase() === cut.toLowerCase())) s.cuts.push(cut);
        });
        s.purchases.push(purchase);
      });
      return purchase;
    },
    removePurchase(id, { restock } = {}) {
      commit((s) => {
        const p = s.purchases.find((x) => x.id === id);
        if (p && restock === false) { /* on ne retire pas du stock */ }
        else if (p) {
          p.items.forEach((it) => {
            const ing = s.ingredients.find((i) => i.id === it.ingredientId);
            const first = isFresh(ing) ? s.fridge : s.stock;
            const second = isFresh(ing) ? s.stock : s.fridge;
            let q = it.qty;
            const take = Math.min(q, first[it.ingredientId] || 0);
            if (take) first[it.ingredientId] -= take;
            q -= take;
            if (q) second[it.ingredientId] = Math.max(0, (second[it.ingredientId] || 0) - q);
          });
        }
        s.purchases = s.purchases.filter((x) => x.id !== id);
      });
    },
    purchasesSorted() { return state.purchases.slice().sort((a, b) => b.date.localeCompare(a.date)); },
    spentInMonth(yearMonth) { // 'YYYY-MM' ; défaut = mois courant
      const ym = yearMonth || todayISO().slice(0, 7);
      return state.purchases.filter((p) => p.date.slice(0, 7) === ym).reduce((sum, p) => sum + (p.cost || 0), 0);
    },

    /* ---- Repas réellement donnés (journal alimentaire) ---- */
    // Enregistre ce qui a VRAIMENT été donné (peut différer de la rotation) : déduit le stock, coche le journal
    logFed({ date, slot, items }) {
      const clean = (items || []).filter((it) => it.ingredientId && it.qty > 0);
      if (!clean.length) return null;
      const entry = { id: uid(), date: date || todayISO(), slot: slot || 'matin', items: clean.map((it) => ({ ingredientId: it.ingredientId, qty: +it.qty })) };
      commit((s) => {
        // on pioche d'abord dans le frigo (décongelé/frais), puis au congélo
        entry.items.forEach((it) => {
          let q = it.qty;
          const f = s.fridge[it.ingredientId] || 0;
          const take = Math.min(f, q);
          if (take) s.fridge[it.ingredientId] = f - take;
          q -= take;
          if (q) s.stock[it.ingredientId] = Math.max(0, (s.stock[it.ingredientId] || 0) - q);
        });
        s.fed.push(entry);
        const day = s.journal[entry.date] || { sorties: {}, soins: [] };
        if (entry.slot === 'matin') day.repasMatin = true;
        if (entry.slot === 'soir') day.repasSoir = true;
        s.journal[entry.date] = day;
      });
      return entry;
    },
    // Supprime une entrée (réintègre le stock, décoche le journal si plus rien sur le créneau)
    removeFed(id) {
      commit((s) => {
        const e = s.fed.find((x) => x.id === id);
        if (!e) return;
        // réintégré au frigo (c'est de là que ça venait en pratique)
        e.items.forEach((it) => { s.fridge[it.ingredientId] = (s.fridge[it.ingredientId] || 0) + it.qty; });
        s.fed = s.fed.filter((x) => x.id !== id);
        const others = s.fed.some((x) => x.date === e.date && x.slot === e.slot);
        if (!others && s.journal[e.date]) {
          if (e.slot === 'matin') s.journal[e.date].repasMatin = false;
          if (e.slot === 'soir') s.journal[e.date].repasSoir = false;
        }
      });
    },
    fedForDay(date) { return state.fed.filter((e) => e.date === date); },
    fedForSlot(date, slot) { return state.fed.find((e) => e.date === date && e.slot === slot) || null; },
    fedGramsForDay(date) {
      let g = 0;
      this.fedForDay(date).forEach((e) => e.items.forEach((it) => {
        const ing = this.ingredient(it.ingredientId);
        if (ing && ing.unit === 'g') g += it.qty;
      }));
      return g;
    },
    fedSorted() { return state.fed.slice().sort((a, b) => b.date.localeCompare(a.date) || (a.slot === 'soir' ? 1 : -1) - (b.slot === 'soir' ? 1 : -1)); },

    // Bilan « agent » sur les N derniers jours : stats + conseils sur ce qui a réellement été donné
    fedAnalysis(days) {
      days = days || 7;
      const dates = [];
      const baseDate = new Date(todayISO() + 'T00:00:00');
      for (let i = 0; i < days; i++) { const d = new Date(baseDate); d.setDate(d.getDate() - i); dates.push(isoLocal(d)); }
      const inWindow = new Set(dates);
      const acc = { muscle: 0, abats: 0, os: 0, legume: 0, autre: 0, osPieces: 0, oeufs: 0, grams: 0,
        gramsByDay: {}, dates: dates.slice().reverse(), fish: false, entries: 0 };
      const proteins = new Set(); const daysWithFood = new Set();
      state.fed.forEach((e) => {
        if (!inWindow.has(e.date)) return;
        acc.entries++;
        e.items.forEach((it) => {
          const ing = state.ingredients.find((i) => i.id === it.ingredientId);
          if (!ing) return;
          daysWithFood.add(e.date);
          const cls = ing.category === 'entier' ? 'muscle' : barfClass(ing);
          if (ing.unit === 'piece') {
            if (cls === 'os') acc.osPieces += it.qty;
            else if (ing.category === 'oeuf') acc.oeufs += it.qty;
          } else {
            acc[cls] = (acc[cls] || 0) + it.qty;
            acc.grams += it.qty;
            acc.gramsByDay[e.date] = (acc.gramsByDay[e.date] || 0) + it.qty;
          }
          if (cls === 'muscle' && ing.category !== 'oeuf' && ing.unit === 'g') proteins.add(ing.name.replace(/\s*\(.*\)\s*$/, ''));
          if (/saumon|sardine|poisson|maquereau|truite/i.test(ing.name)) acc.fish = true;
        });
      });
      const viande = acc.muscle + acc.abats;
      acc.abatsPct = viande ? Math.round(acc.abats / viande * 100) : 0;
      acc.nDays = daysWithFood.size;
      acc.reco = this.recommendedRation();
      acc.proteins = [...proteins];
      acc.avgPerDay = acc.nDays ? Math.round(acc.grams / acc.nDays) : 0;

      const advice = [];
      if (!acc.entries) {
        advice.push('Note les repas donnés (bouton « J\'ai donné… » sur Aujourd\'hui) pour obtenir un bilan.');
      } else {
        if (acc.reco && acc.nDays >= 1) {
          if (acc.avgPerDay < acc.reco * 0.8) advice.push('⚠️ Petites rations : ~' + acc.avgPerDay + ' g/jour donnés, ~' + acc.reco + ' g conseillés — Hatchi mange peu.');
          else if (acc.avgPerDay > acc.reco * 1.25) advice.push('⚠️ Rations copieuses : ~' + acc.avgPerDay + ' g/jour donnés, ~' + acc.reco + ' g conseillés.');
          else advice.push('✅ Bonnes quantités : ~' + acc.avgPerDay + ' g/jour (conseillé ~' + acc.reco + ' g).');
        } else if (!acc.reco) {
          advice.push('⚖️ Ajoute une pesée (Soins → Poids) pour comparer aux quantités conseillées.');
        }
        if (acc.nDays >= 3) {
          if (viande > 0 && !acc.abats) advice.push('🫀 Aucun abat sur ' + acc.nDays + ' jours — il manque les vitamines (A, fer, cuivre). Viser ~10 % de la viande.');
          else if (viande > 0 && acc.abatsPct < 8) advice.push('🫀 Abats à ~' + acc.abatsPct + ' % seulement — viser ~10 % pour les vitamines.');
          else if (acc.abatsPct > 15) advice.push('🫀 Beaucoup d\'abats (~' + acc.abatsPct + ' %) — risque de selles molles, viser ~10 %.');
          if (!acc.osPieces && !acc.os) advice.push('🦴 Aucun os charnu sur ' + acc.nDays + ' jours — il manque le calcium (2-3 os crus par semaine).');
          if (acc.proteins.length === 1) advice.push('🔁 Une seule viande (' + acc.proteins[0] + ') — varie les protéines dès que possible.');
          if (!acc.legume) advice.push('🥕 Aucun légume — fibres et vitamines en plus.');
          if (!acc.fish && days >= 7) advice.push('🐟 Pas de poisson sur la période — pense aux oméga-3 (1×/semaine).');
          if (advice.every((a) => a.startsWith('✅'))) advice.push('🌟 Alimentation équilibrée — continue comme ça !');
        } else {
          advice.push('Encore ' + (3 - acc.nDays) + ' jour(s) de notes et le bilan complet s\'affichera.');
        }
      }
      acc.advice = advice;
      return acc;
    },

    // Analyse d'une semaine du plan de rotation (prévision) : stats + conseils
    rotationAnalysis(week) {
      week = week || 1;
      const acc = { muscle: 0, abats: 0, os: 0, legume: 0, autre: 0, osPieces: 0, oeufs: 0, grams: 0, daysPlanned: 0 };
      const proteins = new Set(); let fish = false;
      for (let d = 0; d < 7; d++) {
        let dayHas = false;
        ['matin', 'soir'].forEach((slot) => this.getRotation(week, d, slot).forEach((it) => {
          const ing = this.ingredient(it.ingredientId);
          if (!ing) return;
          dayHas = true;
          const cls = ing.category === 'entier' ? 'muscle' : barfClass(ing);
          if (ing.unit === 'piece') {
            if (cls === 'os') acc.osPieces += it.qty;
            else if (ing.category === 'oeuf') acc.oeufs += it.qty;
          } else { acc[cls] += it.qty; acc.grams += it.qty; }
          if (cls === 'muscle' && ing.category !== 'oeuf' && ing.unit === 'g') proteins.add(ing.name.replace(/\s*\(.*\)\s*$/, ''));
          if (/saumon|sardine|poisson|maquereau|truite/i.test(ing.name)) fish = true;
        }));
        if (dayHas) acc.daysPlanned++;
      }
      const viande = acc.muscle + acc.abats;
      acc.abatsPct = viande ? Math.round(acc.abats / viande * 100) : 0;
      acc.proteins = [...proteins];
      acc.fish = fish;
      acc.reco = this.recommendedRation();
      acc.avgPerDay = acc.daysPlanned ? Math.round(acc.grams / acc.daysPlanned) : 0;

      const advice = [];
      if (!acc.daysPlanned) {
        advice.push('Compose tes journées ci-dessus (matin/soir) pour obtenir l\'analyse du plan.');
      } else {
        if (acc.reco) {
          if (acc.avgPerDay < acc.reco * 0.8) advice.push('⚠️ Plan léger : ~' + acc.avgPerDay + ' g/jour prévus pour ~' + acc.reco + ' g conseillés.');
          else if (acc.avgPerDay > acc.reco * 1.25) advice.push('⚠️ Plan copieux : ~' + acc.avgPerDay + ' g/jour prévus pour ~' + acc.reco + ' g conseillés.');
          else advice.push('✅ Quantités correctes : ~' + acc.avgPerDay + ' g/jour prévus (conseillé ~' + acc.reco + ' g).');
        } else {
          advice.push('⚖️ Ajoute une pesée (Soins → Poids) pour comparer le plan aux besoins.');
        }
        if (viande > 0 && !acc.abats) advice.push('🫀 Aucun abat prévu — viser ~10 % de la viande (vitamines A, fer, cuivre).');
        else if (viande > 0 && acc.abatsPct < 8) advice.push('🫀 Abats à ~' + acc.abatsPct + ' % — viser ~10 %.');
        else if (acc.abatsPct > 15) advice.push('🫀 Abats à ~' + acc.abatsPct + ' % — un peu beaucoup, viser ~10 %.');
        else if (viande > 0) advice.push('✅ Abats à ~' + acc.abatsPct + ' % : bon ratio.');
        if (!acc.osPieces && !acc.os) advice.push('🦴 Aucun os charnu prévu — calcium (2 à 3 os crus par semaine).');
        else if (acc.osPieces === 1) advice.push('🦴 1 seul os prévu — viser 2 à 3 par semaine.');
        else if (acc.osPieces) advice.push('✅ ' + acc.osPieces + ' os dans la semaine.');
        if (acc.proteins.length === 1) advice.push('🔁 Une seule viande prévue (' + acc.proteins[0] + ') — varie sur la semaine ou le cycle.');
        if (!acc.legume) advice.push('🥕 Aucun légume prévu.');
        if (!acc.fish) advice.push('🐟 Pas de poisson prévu — 1×/semaine pour les oméga-3.');
      }
      acc.advice = advice;
      return acc;
    },

    /* ---- Rotation type 4 semaines (base : tableau « Ex S1 » du sheet HATCHI 2026) ----
       Bien-être : rotation des protéines sur le mois (poulet/dinde/bœuf/agneau/lapin/saumon/broutard),
       poisson 1×/semaine (oméga-3), abats 3×200 g et 3 os par semaine, légumes variés. */
    loadExampleRotation() {
      commit((s) => {
        const byName = {};
        s.ingredients.forEach((i) => { byName[i.name] = i.id; });
        const it = (n, q) => byName[n] ? { ingredientId: byName[n], qty: q } : null;
        const D = (arr) => arr.filter(Boolean);
        // aliments (matin : viande 300 g ; soir : 300-500 g)
        const P = (q) => it('Poulet (filet)', q), DI = (q) => it('Dinde', q), B = (q) => it('Bœuf', q),
          A = (q) => it('Agneau', q), LA = (q) => it('Lapin', q), SA = (q) => it('Saumon', q), CB = (q) => it('Côte de broutard', q);
        const OEUF = () => it('Œuf', 1), OS = () => it('Os charnu', 1), AB = () => it('Abats (lot)', 200);
        const L = (n, q) => it(n, q || 100);
        // menus réutilisés (composés d'aliments, pas de repas nommés)
        const m = {
          pOeufCar: () => D([P(300), OEUF(), L('Carotte', 200)]),
          pCar: () => D([P(300), L('Carotte')]),
          dCour: () => D([DI(300), L('Courgette')]),
          pOsHar: () => D([P(300), OS(), L('Haricot vert')]),
          dBro: () => D([DI(300), L('Brocoli')]),
          pEpi: () => D([P(300), L('Épinard')]),
          dOsCour: () => D([DI(300), OS(), L('Courgette')]),
          laCar: () => D([LA(300), L('Carotte')]),
          dAbBro: () => D([DI(300), AB(), L('Brocoli')]),
          bOsOeufHar: () => D([B(400), OS(), OEUF(), L('Haricot vert')]),
          bAbPot: () => D([B(300), AB(), L('Potiron')]),
          aOeufCour: () => D([A(400), OEUF(), L('Courgette')]),
          aOeufCar: () => D([A(500), OEUF(), L('Carotte')]),
          pAbPois: () => D([P(500), AB(), L('Petit pois')]),
          bOeufPat: () => D([B(400), OEUF(), L('Patate douce')]),
          laAbEpi: () => D([LA(300), AB(), L('Épinard')]),
          saCour: () => D([SA(400), L('Courgette')]),
          cbBro: () => D([CB(400), L('Brocoli')])
        };
        // 4 semaines × 7 jours (0=lundi … 6=dimanche)
        const weeks = [
          { 0: [m.pOeufCar, m.dAbBro], 1: [m.pCar, m.bOsOeufHar], 2: [m.dCour, m.bAbPot], 3: [m.pOsHar, m.aOeufCour], 4: [m.dBro, m.aOeufCar], 5: [m.pEpi, m.pAbPois], 6: [m.dOsCour, m.bOeufPat] },
          { 0: [m.dBro, m.laAbEpi], 1: [m.pOsHar, m.saCour], 2: [m.laCar, m.bOeufPat], 3: [m.dCour, m.bAbPot], 4: [m.pOeufCar, m.aOeufCour], 5: [m.dOsCour, m.pAbPois], 6: [m.pEpi, m.bOsOeufHar] },
          { 0: [m.pCar, m.cbBro], 1: [m.dCour, m.pAbPois], 2: [m.pOsHar, m.aOeufCar], 3: [m.laCar, m.dAbBro], 4: [m.dOsCour, m.saCour], 5: [m.pOeufCar, m.bAbPot], 6: [m.pEpi, m.bOsOeufHar] },
          { 0: [m.dCour, m.bOeufPat], 1: [m.pCar, m.laAbEpi], 2: [m.pOsHar, m.dAbBro], 3: [m.dBro, m.saCour], 4: [m.pOeufCar, m.cbBro], 5: [m.dOsCour, m.bAbPot], 6: [m.pEpi, m.bOsOeufHar] }
        ];
        weeks.forEach((plan, w) => {
          for (let d = 0; d < 7; d++) {
            s.rotation[`w${w + 1}-${d}-matin`] = plan[d][0]();
            s.rotation[`w${w + 1}-${d}-soir`] = plan[d][1]();
          }
        });
        s.settings.cycleWeeks = 4;
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
