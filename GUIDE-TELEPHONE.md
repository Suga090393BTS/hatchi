# 📱 Mettre Hatchi sur ton téléphone (et tout synchroniser)

Objectif : avoir l'app **sur l'iPhone**, **hors-ligne**, et **synchronisée** entre ton ordi et ton téléphone (et ceux qui promènent Hatchi).

Il y a **2 étapes** : (A) héberger l'app, (B) activer la synchro. Compte ~15 minutes, une seule fois.

---

## Étape A — Héberger l'app (gratuit, sans compte technique)

La plus simple : **Netlify Drop**.

1. Va sur **https://app.netlify.com/drop**
2. Ouvre le Finder sur le dossier **`Hatchi`** (sur ton Bureau).
3. **Glisse-dépose tout le dossier `Hatchi`** dans la zone de la page Netlify.
4. Au bout de quelques secondes, Netlify te donne une adresse du type **`https://un-nom-rigolo.netlify.app`**.
5. Ouvre cette adresse → c'est ton app en ligne ! 🎉

> 💡 Note bien cette adresse (mets-la en favori). C'est elle que tu ouvriras sur le téléphone.
> Pour mettre à jour l'app plus tard, il suffit de re-glisser le dossier au même endroit (crée un compte Netlify gratuit si tu veux garder la même adresse).

---

## Étape B — Installer sur l'iPhone

1. Sur l'iPhone, ouvre l'adresse `…netlify.app` dans **Safari**.
2. Appuie sur le bouton **Partager** (le carré avec une flèche vers le haut).
3. Choisis **« Sur l'écran d'accueil »**.
4. Valide. Une icône **Hatchi 🐾** apparaît comme une vraie app.

Sur **Android** : ouvre l'adresse dans Chrome → menu **⋮** → **« Installer l'application »**.

À ce stade, l'app marche déjà très bien (données sur le téléphone). Pour que téléphone et ordi partagent **les mêmes données**, fais l'étape C.

---

## Étape C — Synchroniser tous les appareils (Supabase, gratuit)

1. Crée un compte sur **https://supabase.com** → **New project** (choisis un nom, un mot de passe, la région Europe). Attends ~2 min que le projet soit prêt.
2. Dans le menu de gauche : **SQL Editor** → **New query**. Colle ceci puis clique **Run** :

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
   *(Ce script est aussi copiable depuis l'app : Réglages → Synchronisation → « Voir le script SQL ».)*

3. Toujours dans Supabase : **Project Settings (roue dentée) → API**. Repère :
   - **Project URL** (ex. `https://abcd.supabase.co`)
   - **Project API keys → `anon` `public`** (une longue clé qui commence par `eyJ…`)

4. Dans l'app Hatchi (sur l'ordi **ou** le téléphone) : **Réglages → Synchronisation**.
   - Colle l'**URL** et la **clé anon**.
   - Laisse l'**identifiant d'espace** sur `hatchi` (le **même sur tous les appareils**).
   - Appuie sur **« Activer la sync »**. Le badge en haut passe à **« Synchro »** ✅.

5. Répète le point 4 sur ton **autre appareil** avec **les mêmes infos**. Les données fusionnent : tout est partagé.

> 🔒 **Sécurité** : cette config simple suffit pour un usage perso, mais toute personne ayant l'URL + la clé + l'identifiant d'espace peut accéder aux données. Ne les partage qu'avec les personnes de confiance qui s'occupent d'Hatchi.

---

## Et les rappels ?

- **Notifications** : Réglages → Rappels → « Activer les notifications ».
- **Le plus fiable (surtout iPhone)** : onglet **Soins → un traitement → « Ajouter au calendrier »**. Ça crée un rappel **récurrent** dans ton agenda (collier tous les 8 mois, vermifuge tous les 3 mois…), qui te préviendra même app fermée.

---

## Si quelque chose coince
- L'app ne se met pas à jour après un nouveau dépôt Netlify ? Ferme et rouvre-la (le cache se rafraîchit tout seul à la connexion suivante).
- La sync affiche « Erreur » ? Revérifie l'URL/clé et que le script SQL a bien été exécuté (Run) dans Supabase.
- Besoin d'aide ? Garde une **sauvegarde** : Réglages → Sauvegarde → Exporter (fichier `.json`).
