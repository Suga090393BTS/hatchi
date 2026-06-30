# 🐾 Hatchi — Suivi du chien

Application web (PWA) pour gérer **l'alimentation**, **les traitements/soins**, **les activités** et **le journal de santé** de votre chien. Inspirée du Google Sheet *HATCHI 2026*, repensée pour une alimentation **viande maison** (les repas DogChef sont abandonnés).

Fonctionne **hors-ligne** et **sans compte**. Synchronisation multi-appareils **optionnelle** via Supabase.

---

## Fonctions

- **Aujourd'hui** — repas du jour (matin/soir) calculés automatiquement, **ration conseillée selon le poids**, **alerte de stock bas**, rappels de soins en retard/à venir, soins du jour à cocher, sorties (Ville/Forêt/Éduc/Véto), note rapide.
- **Repas** — créez vos *repas-types* (ex. « Poulet + os ») avec ingrédients et grammages, puis composez une **rotation** d'1 à 4 semaines. L'app en déduit le repas de chaque jour. Un bouton **« Charger la rotation type »** pré-remplit le plan viande maison repris de votre tableau HATCHI 2026.
- **Repas → Équilibre** — contrôle du ratio **BARF muscle / os / abats** sur la semaine, avec alerte si déséquilibré.
- **Courses** — deux onglets :
  - **Courses** : liste agrégée **automatiquement** (semaine ou 30 jours) à partir de la rotation, regroupée par catégorie, avec **budget estimé** et bouton « copier ».
  - **Stock** (congélateur) : suivi des stocks avec **jours de couverture**, déduction automatique quand un repas est marqué « donné », réapprovisionnement en un clic depuis les besoins, et **alerte de réappro**.
- **Soins** — deux onglets :
  - **Traitements** : vermifuge, collier anti-puces, vaccin, yeux, oreilles… avec **rappels** (en retard / bientôt) et historique. « Fait » enregistre la date et recalcule l'échéance. **« Ajouter au calendrier »** crée un rappel récurrent `.ics` (fiable même app fermée, idéal iPhone).
  - **Poids** : pesées + **courbe de croissance**.
- **Journal** — **calendrier mensuel** (pastilles repas/sorties/notes par jour), vue liste, et **Tendances** (stats selles/sorties/humeur sur 30–90 j). Pour chaque jour : repas donnés, selles, humeur, sorties, promeneur, température, notes et **photo**. Bouton **« Export résumé véto »** (rapport imprimable / PDF).
- **Réglages** — profil du chien, réglage de la rotation, **gestion des ingrédients & prix**, **notifications**, synchronisation, sauvegarde (export/import JSON).

### Rappels : notifications & calendrier
- **Notifications** (Réglages → Rappels) : alerte des soins en retard à l'ouverture de l'app, une fois par jour.
- **Calendrier `.ics`** (Soins → un traitement → « Ajouter au calendrier ») : crée un événement **récurrent** avec alarme dans votre app Agenda (iPhone/Android/Google). C'est la méthode la plus fiable pour être prévenu même quand l'app est fermée — recommandé sur iPhone où les notifications web sont limitées.

Les **traitements** sont pré-remplis (avec les dates issues du sheet : collier 27/06/2025, vermifuge 28/05/2026, vaccin 26/03/2026) et le **catalogue d'ingrédients + prix** est pré-chargé. Tout est modifiable.

---

## Lancer l'application

### Option A — Ouvrir directement (le plus simple)
Double-cliquez sur **`index.html`**. L'app s'ouvre dans le navigateur et fonctionne (données stockées localement).
> Note : en mode fichier, le mode « hors-ligne installé » et la sync sont limités. Pour tout activer, utilisez l'option B.

### Option B — Avec un petit serveur local
Dans le dossier `Hatchi`, ouvrez le Terminal et lancez :
```bash
python3 -m http.server 4173
```
Puis ouvrez **http://localhost:4173** dans Safari/Chrome.

### L'installer comme une app sur le téléphone (synchronisée)
👉 Suis le guide pas-à-pas : **[GUIDE-TELEPHONE.md](GUIDE-TELEPHONE.md)** (hébergement Netlify + installation iPhone/Android + synchro Supabase).

---

## Héberger en ligne (gratuit) — pour l'utiliser sur le téléphone

Faites glisser le dossier `Hatchi` sur l'un de ces services (aucune configuration) :
- **Netlify Drop** : https://app.netlify.com/drop
- **Vercel**, **Cloudflare Pages**, ou **GitHub Pages**.

Vous obtenez une adresse `https://…` à ouvrir sur tous vos appareils.

---

## Synchronisation multi-appareils (Supabase)

Pour que le téléphone et l'ordinateur partagent les mêmes données :

1. Créez un projet gratuit sur **https://supabase.com**.
2. Dans Supabase → **SQL Editor**, collez et exécutez le script fourni (visible dans **Réglages → Synchronisation → « Voir le script SQL »**) :
   ```sql
   create table if not exists public.hatchi_state (
     id text primary key,
     data jsonb not null,
     updated_at timestamptz not null default now()
   );
   alter table public.hatchi_state enable row level security;
   create policy "hatchi_all" on public.hatchi_state
     for all using (true) with check (true);
   ```
3. Dans Supabase → **Project Settings → API**, copiez **Project URL** et la clé **anon public**.
4. Dans l'app → **Réglages → Synchronisation**, collez l'URL, la clé, gardez le même *identifiant d'espace* sur chaque appareil, puis **Activer la sync**.

> ⚠️ Cette configuration simple convient à un usage personnel : toute personne disposant de l'URL + clé + identifiant d'espace pourrait accéder aux données. Ne partagez pas ces informations.

---

## Sauvegarde

**Réglages → Sauvegarde** permet d'exporter toutes les données dans un fichier `.json` et de les réimporter (utile pour changer d'appareil sans Supabase).

---

## Détails techniques

- Aucune dépendance ni build : HTML + CSS + JavaScript (scripts classiques).
- Données : `localStorage` (et Supabase si activé). Sync = blob JSON unique par espace, *last-write-wins*.
- `sw.js` : service worker pour le fonctionnement hors-ligne (actif uniquement quand l'app est servie en http/https).
- Structure :
  ```
  index.html
  css/styles.css
  js/store.js        ← données, persistance, sync, seed
  js/ui.js           ← helpers DOM / modales / formats
  js/app.js          ← routeur
  js/views/*.js      ← une vue par onglet
  sw.js, manifest.webmanifest, icon.svg
  ```
