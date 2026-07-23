# Hatchi — mémoire projet

> App web (PWA) de suivi du **chien** : alimentation (viande maison / BARF), soins & traitements, courses & stock, journal de santé. **Hors-ligne, sans compte**, sync multi-appareils optionnelle via Supabase. Interface **en français**.

## Règles de travail

- **Répondre en français** (l'app et l'utilisatrice sont en français).
- **Aucun build, aucune dépendance npm** : HTML + CSS + JS classiques (scripts globaux, pas de modules ES, pas de bundler). Ne pas introduire d'outil de build sans demander.
- **À chaque modif de fichier listé dans `sw.js`** : incrémenter `const CACHE = 'hatchi-vNN'` (ligne 2 de `sw.js`) sinon les appareils gardent l'ancienne version en cache. Version actuelle : **v66**.
- Priorité forte de l'utilisatrice : **ne jamais perdre de données** (voir garde-fous synchro + sauvegardes cloud dans l'historique git). Prudence maximale sur `store.js` autour de la persistance et de la sync.

## Lancer / prévisualiser

```bash
python3 -m http.server 4173   # puis http://localhost:4173
```
(Ouvrir `index.html` en direct marche aussi, mais SW + sync sont limités en `file://`.)

## Architecture

Pas de framework. Un routeur maison, un store global, une vue par onglet. Tout est exposé sur `window` (`Store`, `UI`, `App`, `Views`).

```
index.html          ← shell, ordre de chargement des <script>, barre d'onglets
css/styles.css      ← styles (palette unique via :root, pas de thème au choix)
js/store.js  (~1560 l.) ← état, persistance localStorage, sync Supabase, données seed
js/ui.js            ← helpers DOM : h(), clear(), modal(), toast(), formats de date
js/app.js           ← routeur (hash), barre des chiens, header, pill de sync, boot
js/views/*.js       ← une vue par onglet, chacune expose Views.<nom> avec .render(el)
sw.js               ← service worker, cache app-shell (network-first + repli hors-ligne)
manifest.webmanifest, icon.svg
```

Routes : `today`, `meals`, `shopping`, `treatments`, `journal`, `dog`, `settings`.
Onglets visibles : Aujourd'hui 🏠 · Repas 🍖 · Courses 🛒 · Chien 🐕 · Réglages ⚙️.
`treatments` (Soins) et `journal` s'ouvrent **depuis** la vue Chien (l'onglet Chien reste surligné).

## Données (store.js)

- Clé localStorage : `hatchi.state.v1`. Fonctions clés : `Store.get()`, `Store.subscribe(fn)`, `Store.set*`, `Store.todayISO()`, `Store.dueStatus(t)`, `Store.dogsList()`, `Store.setCurrentDog(id)`, `Store.onSync(fn)`, `Store.initSync()`.
- **Multi-chiens** : la plupart des données sont par chien ; le **stock congélateur et les courses sont communs** à tous les chiens.
- Sync Supabase = **un seul blob JSON par espace**, stratégie **last-write-wins**. Jamais mis en cache par le SW (cross-origin ignoré). Table `public.hatchi_state` (schéma SQL dans README + Réglages → Synchronisation).
- Données seed pré-remplies et **toutes éditables** : ingrédients+prix, traitements (dates réelles issues du sheet HATCHI 2026), morceaux de viande, humeurs, pharmacie (principes actifs + posologie).
- Dates : `isoLocal()` maison pour éviter le décalage de fuseau de `toISOString()` à minuit local. Ne pas remplacer par `toISOString()`.

## Pièges connus

- **Re-render pendant une saisie** (`app.js`) : le store ne redessine pas la vue tant qu'un `input/textarea/select` a le focus (sinon iOS ferme le clavier/picker et perd la saisie) ; le rendu est différé au `focusout`. En tenir compte avant de toucher au cycle de rendu.
- **Rappels de soins** : notification web quotidienne à l'ouverture (limitée sur iPhone) + export `.ics` récurrent = méthode fiable recommandée.
- Sauvegarde manuelle : export/import JSON dans Réglages (ex. `hatchi-sauvegarde-RECUP-*.json` à la racine).

## Docs annexes

- `README.md` — présentation fonctionnelle complète + hébergement + setup Supabase.
- `GUIDE-TELEPHONE.md` — installation iPhone/Android pas à pas.
