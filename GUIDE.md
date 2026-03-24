# Guide d'administration — Epic Armageddon FR

Ce guide explique comment gérer le site Epic Armageddon FR, les services utilisés et comment y accéder.

---

## Vue d'ensemble

Le site utilise 3 services principaux :

| Service | Rôle | Lien |
|---------|------|------|
| **Supabase** | Base de données + authentification | [Dashboard Supabase](https://supabase.com/dashboard/project/nomrnaobradtiddfewxm) |
| **Cloudflare R2** | Stockage des fichiers PDF | [Dashboard Cloudflare](https://dash.cloudflare.com) → R2 Object Storage |
| **Hébergement** | Le site lui-même (Nuxt 4) | *(à compléter selon l'hébergeur choisi)* |

- **Supabase** stocke toutes les données (armées, versions, événements, documents, utilisateurs) ainsi que les icônes SVG des armées.
- **Cloudflare R2** stocke uniquement les fichiers PDF (codex d'armées, règles, FAQ). C'est un stockage de fichiers rapide et économique.
- Le site en lui-même est une application Nuxt 4 avec un panneau d'administration intégré.

---

## Accéder au panneau d'administration

1. Rendez-vous sur **votresite.fr/admin**
2. Connectez-vous avec votre email et mot de passe
3. À la première connexion, vous devrez définir votre mot de passe via la page de setup

### Rôles

| Rôle | Droits |
|------|--------|
| **Admin** | Gérer les armées, documents, événements et outils |
| **Super Admin** | Tout ce que fait l'admin + gestion des utilisateurs + suppression de versions |

---

## Gérer les armées (codex)

📍 **Admin → Gestion des armées**

### Créer une armée

1. Cliquez sur **"Nouvelle armée"**
2. Remplissez le nom, la faction (Imperium / Chaos / Xenos) et la version initiale
3. Ajoutez une icône SVG (optionnel) et le premier PDF du codex
4. Cliquez sur **"Créer l'armée"**

### Modifier une armée

1. Cliquez sur **"Modifier"** à côté de l'armée
2. Vous pouvez changer : le nom, la faction, le statut (Officiel / Bêta / Expérimental / 30k), la citation, et l'icône SVG
3. Pour changer l'icône, cliquez sur le champ d'upload et sélectionnez un nouveau fichier SVG
4. Cliquez sur **"Enregistrer"**

### Ajouter une nouvelle version (nouveau PDF)

**Méthode rapide :**
1. Cliquez sur **"Nouveau PDF"** → la modale des versions s'ouvre directement avec le formulaire d'ajout

**Depuis la modale des versions :**
1. Cliquez sur **"Versions"** à côté de l'armée
2. Cliquez sur **"Ajouter une version"**
3. Remplissez :
   - **Numéro de version** — pré-rempli automatiquement (ex: si la version actuelle est 1.3, il propose 1.4)
   - **Date de publication** — par défaut aujourd'hui, mais vous pouvez la modifier pour ajouter une ancienne version
   - **Fichier PDF** — le codex à uploader
   - **Explications de la mise à jour** — ex: "Corrections de points, ajout d'unités..."
   - **Version actuelle** — cochez si cette version doit devenir la version active. Décochez si vous ajoutez une ancienne version à l'historique.
4. Cliquez sur **"Publier"**

### Modifier la description d'une version existante

1. Cliquez sur **"Versions"** à côté de l'armée
2. Cliquez sur **"Modifier"** à côté de la version concernée
3. Éditez le texte et cliquez sur **"Enregistrer"**

### Restaurer une ancienne version

1. Ouvrez les **"Versions"** de l'armée
2. Cliquez sur **"Restaurer"** à côté de la version souhaitée
3. Cette version redevient la version actuelle

### Supprimer une version *(super admin uniquement)*

1. Ouvrez les **"Versions"** de l'armée
2. Cliquez sur **"Supprimer"** à côté de la version (impossible de supprimer la version actuelle)

---

## Gérer les documents (règles & FAQ)

📍 **Admin → Documents & Règles**

1. Cliquez sur **"Nouveau document"** pour en ajouter un
2. Remplissez le titre, la description, la version, l'ordre d'affichage et le PDF
3. Pour modifier un document existant, cliquez sur **"Modifier"** — vous pouvez remplacer le PDF sans changer les autres informations

---

## Gérer les événements

📍 **Admin → Événements**

Les événements apparaissent sur la page publique **/evenements** avec une section "À venir" et une timeline historique par année.

Pour ajouter un événement :
1. Remplissez le titre, la description, la date de début (et optionnellement la date de fin)
2. Ajoutez l'adresse, le contact et un lien externe si besoin
3. Les événements passés apparaissent automatiquement grisés dans la timeline

> ⚠️ Attention au format des dates ! Vérifiez bien que l'année est correcte (ex: 2026 et non 206).

---

## Gérer les outils

📍 **Admin → Outils**

Les outils communautaires (sites, applications, ressources) affichés sur la page **/outils**.

---

## Gérer les utilisateurs *(super admin uniquement)*

📍 **Admin → Utilisateurs**

Depuis cette page, un super admin peut :
- Inviter de nouveaux administrateurs par email
- Changer le rôle d'un utilisateur (admin ↔ super admin)

---

## Pages publiques du site

| Page | URL | Contenu |
|------|-----|---------|
| Accueil | `/` | Présentation + dernières mises à jour |
| Toutes les armées | `/armees` | Les 3 factions affichées ensemble |
| Armées Imperium | `/armees/imperium` | Grille des armées loyalistes |
| Armées Chaos | `/armees/chaos` | Grille des armées du Chaos |
| Armées Xenos | `/armees/xenos` | Grille des armées Xenos |
| Détail d'une armée | `/armees/{faction}/{id}` | Fiche complète avec PDF et historique |
| Bêta & Expérimentaux | `/codex-beta` | Listes en cours de test |
| Epic 30k | `/epic-30k` | Listes Horus Hérésie |
| Règles & FAQ | `/regles` | Documents de règles et FAQ |
| Événements | `/evenements` | Tournois et rencontres |
| Outils | `/outils` | Outils communautaires |
| Communauté | `/communaute` | Liens Discord, Facebook, etc. |

---

## Services externes — En détail

### Supabase (base de données)

**Lien :** [https://supabase.com/dashboard/project/nomrnaobradtiddfewxm](https://supabase.com/dashboard/project/nomrnaobradtiddfewxm)

Supabase gère :
- **Les données** : armées, versions, documents, événements, outils, profils utilisateurs
- **L'authentification** : connexion des administrateurs (email + mot de passe)
- **Le stockage des icônes** : les fichiers SVG des armées sont dans le bucket `army-pdfs/icons/`

Vous n'avez normalement pas besoin d'aller sur Supabase directement — tout se gère depuis le panneau admin du site. Mais en cas de besoin (corriger une donnée manuellement, vérifier un utilisateur...), vous pouvez y accéder.

**Tables principales :**
- `armies` — les armées (nom, faction, statut, icône, citation)
- `army_versions` — les versions PDF de chaque armée
- `documents` — les règles et FAQ
- `game_events` — les événements
- `tools` — les outils communautaires
- `profiles` — les comptes administrateurs

### Cloudflare R2 (stockage PDF)

**Lien :** [https://dash.cloudflare.com](https://dash.cloudflare.com) → R2 Object Storage → Bucket `epic-armageddon-pdfs`

R2 stocke tous les fichiers PDF du site :
- Les codex d'armées (dans des dossiers par faction : `imperium/`, `chaos/`, `xenos/`)
- Les documents de règles (dans `regles/`)

Les PDFs sont accessibles publiquement via l'URL : `https://pub-1666a3493ace4d1a9657de1f8a60b059.r2.dev/`

Vous n'avez pas besoin d'aller sur Cloudflare — les uploads se font automatiquement depuis le panneau admin. R2 sert simplement de "disque dur en ligne" pour les PDF.

---

## En cas de problème

- **Je ne peux pas me connecter à l'admin** → Vérifiez votre email/mot de passe. Un super admin peut renvoyer une invitation depuis la page Utilisateurs.
- **Un PDF ne se télécharge pas** → Vérifiez que le fichier existe dans le bucket R2 sur Cloudflare.
- **Une donnée est incorrecte** → Vous pouvez la corriger depuis le panneau admin, ou directement dans Supabase en dernier recours.
- **Le site ne se met pas à jour après une modification** → Rechargez la page (Ctrl+F5). Les données sont récupérées en temps réel depuis Supabase.
