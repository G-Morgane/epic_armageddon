# Test du modèle unifié (7 armées, 2 listes de soutien)

Branche `feat/codex-unifie`. Prouve qu'une seule fiche par armée produit le PDF et le builder.

## Ce qui est en place

| Brique | Où | Rôle |
|---|---|---|
| Schéma du format natif (zod) | `shared/codex/schema.ts` | définit la fiche, vérifie les références |
| Moteur de règles | `shared/codex/engine.ts` | résout une liste (unités, coûts, transports, remplacements), budgets, contraintes |
| Phrases PDF | `shared/codex/phrases.ts` | génère « 0-1 », « ou », « Jusqu'à 2 formations… » depuis les données |
| 7 codex + 2 listes de soutien | `content/codex/*.yaml` | Légion d'Acier, Adeptus Astartes, Dark Angels, Black Legion, Tyranides, Orks de Ghazghkull, Eldars Noirs ; Adeptus Titanicus et Aeronautica Imperialis en alliance |
| API | `server/api/codex/` | liste, JSON d'un codex, PDF généré (`/api/codex/{slug}/pdf`, Chromium sans écran) |
| Page imprimable | `app/pages/codex-test/[slug]/imprimer.vue` | la maquette du PDF (page de garde, liste d'armée, feuille de références) |
| Builder | `app/pages/builder/[slug].vue` + `app/components/codex/FormationCarte.vue` | construction de liste, budgets, erreurs, sauvegarde locale, impression |
| Tests | `tests/*.spec.ts` | schéma + références de chaque YAML, et les listes fixtures rejouées dans le moteur (51 tests) |

Exemples de PDF générés : `docs/exemples/generes/`.

## Écran admin (démo)

`/admin/codex` : liste des armées (version publiée, brouillon en cours), bouton « Nouvelle armée ».
`/admin/codex/{slug}` : cinq onglets.

| Onglet | Ce qu'on y fait |
|---|---|
| Armée | nom, faction, statut, couleur, citation, introduction, règles spéciales (texte), budgets |
| Unités | tableau façon tableur, une ligne par profil, armes et transport en dépliant la ligne |
| Liste d'armée | les tableaux tels qu'ils seront imprimés ; clic sur une ligne = panneau latéral (nom, coût, composition en texte parsé, variantes « ou », améliorations cochées, règles en phrases à trous, sous-formations) ; clic sur un bandeau = réglages de la section |
| Améliorations | définition des options (ajouter, remplacer, mot-clé, choix, répartition), règles, éditeur JSON en secours |
| Aperçu | le PDF du brouillon dans un cadre, lien vers le builder sur le brouillon |

Enregistrement automatique du brouillon 1,2 s après la dernière frappe. Le bouton « Publier » est grisé tant que le brouillon a des incohérences ; à la publication, les listes de test sont rejouées, puis la version devient publique (PDF et builder).

Stockage de la démo : dossier `.data/` géré par Nitro (ignoré par git), un brouillon et des snapshots versionnés par armée. À remplacer par deux tables Supabase sans toucher à l'interface (`server/utils/codex.ts`).

Pour la démo sans se connecter à l'admin, lancer le serveur avec `CODEX_DEMO_SANS_AUTH=1` (dev uniquement, sans effet en build de prod) :

```bash
CODEX_DEMO_SANS_AUTH=1 npx nuxi dev
```

## Lancer

```bash
npm run test          # 27 tests : schéma, références, listes fixtures
npx nuxi dev          # puis /codex-test, /builder/legion-dacier, /codex-test/legion-dacier/imprimer
```

Le PDF serveur cherche Chromium dans `CHROMIUM_PATH`, sinon Google Chrome (macOS) ou `/usr/bin/chromium`.

## Alliances

Une section peut pointer vers un autre codex (`allies: { codex: adeptus-titanicus }`) : ses formations, unités et options sont fusionnées à la lecture, et ce sont les règles de la section hôte qui s'appliquent (en général « compte dans le budget Supports », donc 1/3 des points). Les listes de soutien (`codex.type: soutien`) s'écrivent une fois et ne sont pas jouables seules. Dans l'admin : « Nouvelle armée » → « Liste de soutien partagée », puis dans le codex hôte, bandeau de section → « Alliance ».

## Résultat

- Les 4 codex tiennent dans le vocabulaire fermé du schéma (14 contraintes, 5 effets d'option, 3 types de ligne de composition, 4 sources de budget).
- Les mécaniques couvertes : places d'appui par compagnie, quota rare 1/3, commissaires gratuits par tranche, transports automatiques (Rhinos) et achetés (Razorbacks, Chimères), remplacements par lots ou totaux, options à choix, variantes « ou », tailles de bande Orks avec limites multipliées, groupes synaptiques avec sous-formations et budgets fournis par formation.
- Les 4 PDF sortent avec la même structure que les PDF actuels (bandeaux par section, lignes « ou », notes d'astérisque, feuilles de références).

## Ce qui reste en texte (non vérifié par le moteur)

Relevé pendant la saisie. Ce sont des règles de jeu ou des cas trop spécifiques pour une contrainte générique.

- Astartes : capacités de transport composées (« 12+6/4 »), tailles de place qui dépendent du transporteur, Module d'atterrissage limité à certaines unités (rendu par des exclusions d'options).
- Tyranides : liste blanche des unités embarquables en Spore mycétique, condition « un Bio-vaisseau dans la liste », changements de profil (tunnelier gagné ou perdu).
- Orks : armement au choix des marcheurs et Gargants, Brikolo qui transforme une arme du porteur, Gretchins embarqués gratuitement, priorité de rattachement du Big Boss.

Si l'un de ces cas doit être contrôlé par le builder, on ajoute une contrainte au schéma et au moteur, une fois, pour tous les codex.

## Écarts relevés entre PDF et builder actuel

- Légion d'Acier : 2 appuis par compagnie (PDF) contre 3 (builder), Griffons ×3 contre ×4, Escadron de Vultures absent du builder.
- Orks : Bande du Super Krabouillator à 4 Krabouillators (PDF) contre 3 (builder), Forteresse à Kanons autorisée sur la Batterie de Grokalibr' dans le builder mais pas dans le PDF.
- Tyranides : initiative 1+ des Bio-vaisseaux dans le builder, pas dans le PDF.

Les YAML suivent le PDF.

## Suite

1. Brancher l'admin sur Supabase (brouillons + versions) et pousser le PDF publié sur R2 dans `army_versions`.
2. Éditeur des choix d'option (Commandant : Capitaine / Archiviste…) sans passer par le JSON.
3. Convertir les 37 autres codex (importeur depuis `docs/reference/builder-json/`).
4. Builder : comptes joueurs, partage, impression soignée.

## Retours de relecture (septembre 2026)

| Demande | État |
| --- | --- |
| Gras et italique dans les textes libres | Fait : `**gras**` / `*italique*` (et `__` / `_`), aperçu sous le champ des règles spéciales |
| Noms d'armes uniques obligatoires | Levé : une arme est une ligne de l'unité, deux unités peuvent porter le même nom d'arme avec des valeurs différentes |
| Boîte de dialogue à la génération du PDF | Fait : barre d'options dans l'aperçu (couverture, profils d'unité, feuille de références, portrait ou paysage) |
| Page de couverture | Fait, optionnelle (cochée par défaut) |
| Fiches de profil « à l'ancienne » | Fait, optionnelles (décochées par défaut), une fiche par unité, sans photo |
| Capacité de dommage et critique masqués si vides | Fait, dans les deux feuilles |
| Feuille de références triée par type | Fait : Perso, Inf, VL, VB, EG, A, A/EG, VS, puis les types inconnus |
| Notes sous le profil plutôt qu'en colonne | Fait, comme la maquette fournie |
| Orientation paysage | Fait, au choix à l'export ; le paysage passe aussi les fiches de profil sur deux colonnes |

Non traité : emplacement pour une photo d'unité (jugé inutile dans le retour), colonne « Notes » propre à chaque arme (l'information tient dans la puissance de feu).

### Couverture illustrée

Les PDF actuels ont une couverture pleine page : bandeau Epic Armageddon, illustration, cartouche « CODEX / NOM / EA-FR ». Le générateur la reproduit.

- Champ `codex.illustration` (URL de l'image, téléversée sur R2 depuis l'onglet Armée).
- L'image couvre la feuille entière, bords perdus compris. Le bloc de titre (Epic Armageddon, nom, faction, citation, version) se pose vers le bas, sur un voile dégradé qui garde l'illustration visible.
- Sans image, le même bloc s'affiche centré sur fond blanc.
- L'image attendue est une **illustration nue** : le titre est écrit par le site. Une couverture déjà finie afficherait son titre sous celui du site.
- Les illustrations sont stockées sur R2 sous `codex/couvertures/`, pas dans le dépôt. Le script `scripts/migrer-couvertures-r2.ts` téléverse un dossier d'images et réécrit le champ `illustration` des YAML ; l'onglet Armée de l'admin permet de remplacer une image à l'unité.

Reprise des couvertures existantes : elles sont incrustées dans les anciens PDF, pas stockées à part sur R2. Il faut les extraire page 1 par page 1 puis les téléverser.

## Passage à la base de données

Trois choses sortent du dépôt :

| Élément | Avant | Maintenant |
| --- | --- | --- |
| Contenu des codex | fichiers `content/codex/*.yaml` | table `codex_versions`, les YAML ne servent plus que de graine |
| Illustrations de couverture | `public/codex/couvertures/` | R2, sous `codex/couvertures/` |
| Listes du builder | stockage local du navigateur | table `listes_armee` pour les comptes connectés, stockage local sinon |

Scripts de reprise, à lancer depuis la racine du projet, essai à blanc par défaut :

- `scripts/migrer-couvertures-r2.ts` téléverse les images et réécrit le champ `illustration` des YAML.
- `scripts/publier-codex.ts` publie les YAML dans `codex_versions` en conservant le numéro de version du PDF d'origine, après contrôle du schéma, des références, des alliés et des listes de test.

Tables à créer : `supabase/codex.sql` puis `supabase/listes.sql`. Aucune table existante n'est modifiée.
