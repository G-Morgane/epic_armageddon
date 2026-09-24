# Modèle de codex unifié : une saisie, deux sorties (PDF + builder)

Objectif : renseigner chaque liste d'armée **une seule fois**, dans l'admin
d'epicarmageddon.fr, et produire à partir de cette saisie :

1. le **PDF codex** publié sur le site (celui qu'on télécharge aujourd'hui) ;
2. un **list builder intégré au site**, qui remplace à terme celui de Cerkaire
   (`cerkaire.github.io/epic-list-builder`).

Ce document décrit l'état actuel, le modèle cible, la grammaire des règles
spéciales, l'ergonomie de saisie et un plan de migration.

---

## 1. État des lieux

### 1.1 Le site (epicarmageddon.fr)

- Supabase : `armies` (nom, faction, statut, citation, icône) + `army_versions`
  (numéro, `pdf_url`, changelog, `is_current`) + tags.
- Le PDF est un **blob opaque** stocké sur R2. Aucune donnée structurée :
  ni unités, ni formations, ni coûts.
- 41 armées, dont 4 absentes du builder (Yme-Loc, Emperor's Children,
  Grey Knights, Orks Sauvages).

### 1.2 Le builder (epic-list-builder, React + Firebase)

- 37 codex en JSON, **bundlés dans le JS** (pas de fichier source séparé,
  modifiés à la main par Cerkaire).
- Le JSON ne contient **aucun profil d'unité** (pas de stats, armes, règles de
  jeu). Uniquement la structure de liste : groupes, formations, coûts, options.
- Vocabulaire hétérogène : une quarantaine de clés ad hoc, dont beaucoup
  utilisées une ou deux fois (`composition_essaims`, `composition_synaptique`,
  `nbacti`, `non_comptee`, `stat_nom`, `unit_stat_name`, `commissaire`…).
  Inventaire complet en annexe A.
- Certaines règles vivent **dans le code**, pas dans les données : le message
  du quota Commissaires, le calcul de la « BLM » (plus grosse formation), la
  gestion des transports par deux dictionnaires globaux `taille_transport` et
  `capacite_transport` recopiés dans chaque codex.

### 1.3 La preuve du problème : ça diverge déjà

Légion d'Acier, PDF v1.3.1 (site) contre JSON v1.2.1 (builder) :

| Point | PDF | Builder |
|---|---|---|
| Formations d'appui par compagnie | 2 | 3 (`slot_appui_ldac_A: 3`) |
| Batterie de Griffons | 3 Griffons | 4 Griffons |
| Escadron de Vultures (300 pts) | présent | absent |

Deux sources maintenues à la main = dérive garantie. C'est exactement ce que
le modèle unique supprime.

---

## 2. Principe

```
            ┌────────────────────────────┐
            │  Admin epicarmageddon.fr   │   saisie unique, brouillon
            └─────────────┬──────────────┘
                          │ publier (snapshot versionné)
                          ▼
            ┌────────────────────────────┐
            │  codex_versions.data (JSON)│   source de vérité, immuable
            └──────┬──────────────┬──────┘
                   │              │
       rendu HTML  │              │  export JSON
       → PDF → R2  ▼              ▼
          PDF téléchargeable   /api/codex/{slug}.json
          (comme aujourd'hui)  ├─ format natif (futur builder Nuxt)
                               └─ format « elb-v1 » compatible builder actuel
```

Trois idées qui rendent ça tenable :

1. **Un seul moteur de règles**, partagé (paquet TypeScript `codex-engine`) :
   schéma, calcul des coûts, validation d'une liste, et **génération des
   phrases** du PDF à partir des contraintes. Le PDF et le builder disent
   forcément la même chose.
2. **Une grammaire fermée** de règles spéciales (§4) à la place des clés ad
   hoc : on choisit dans une liste, on ne réinvente pas une clé par codex.
3. **Des modules partagés** (Aeronautica Imperialis, Adeptus Titanicus,
   socle Space Marines…) écrits une fois et inclus par référence dans les
   codex concernés.

---

## 3. Le modèle de données

Un codex = un document JSON (validé par un schéma zod) en trois couches.

### 3.1 Couche « Codex » (métadonnées et textes)

```yaml
codex:
  slug: legion-dacier
  armee_id: da77b59c-…           # uuid de la fiche /armees (lie le codex à la page d'armée)
  nom: Légion d'Acier
  faction: imperium            # imperium | chaos | xenos (site)
  categorie: armees-imperiales # rubrique du builder
  statut: official             # official | beta | experimental | 30k
  couleur: "#686000"
  logo: https://…/icons/legion-dacier.svg   # icône de l'armée (PDF : couverture + titre)
  citation: { texte: "Héros d'Armageddon ! …", auteur: "Commissaire Yarrick…" }
  intro_md: |                  # « Utiliser la liste d'armée » (PDF uniquement)
    La liste qui suit vous permet de mettre sur pied…
  regles_md:                   # blocs de règles narratives (PDF + info-bulle builder)
    - titre: "Règle spéciale : Commissaires"
      texte: "Pour chaque Compagnie…"
  valeur_strategique: 2
  initiative:
    defaut: "2+"
    exceptions:
      - { portee: module:adeptus-titanicus, valeur: "1+" }
  modules: [aeronautica-imperialis, adeptus-titanicus]   # inclus par référence
```

### 3.2 Couche « Unités » (les profils, absents du builder aujourd'hui)

Chaque unité est décrite **une fois**. Ses caractéristiques de transport
servent au builder (calcul automatique des Chimères), ses stats servent au
PDF (feuille de références).

```yaml
unites:
  - id: chimere
    nom: Chimère
    type: VB                   # Inf | VL | VB | EG | A | VS | Perso | Bat
    vitesse: 30cm
    blindage: "5+"
    cc: "6+"
    ff: "5+"
    armes:
      - { nom: Multi-Laser, portee: 30cm, puissance: "AP5+/AC6+" }
      - { nom: Bolter Lourd, portee: 30cm, puissance: "AP5+" }
    notes: ["Transport (2) : Infanterie"]
    transport: { capacite: 2, accepte: [Inf] }     # utilisé par le builder
  - id: titan_reaver
    nom: Titan Reaver
    type: EG
    armes:
      # ligne générique : les armes possibles sont listées sous la ligne (fiche,
      # feuille de références, builder) à partir de l'option d'armement du codex.
      # `emplacement` filtre les choix (absent dans l'option = les deux).
      - { nom: 2x Armes de Bras, puissance: Frt, armement: { option: armement_reaver, emplacement: bras } }
  - id: ogryns
    nom: Ogryns
    type: Inf
    …
    taille_transport: 2        # « Massif » : prend 2 places
  - id: commissaire
    nom: Commissaire
    type: Perso
    roles: [personnage]        # personnage | commandant_supreme | …
    …
  - id: warhound
    module: adeptus-titanicus  # unité venant d'un module partagé
```

Pour les unités à armement variable (Gargants, Titans Eldars), l'équipement est
un **emplacement d'armement** sur l'unité, et chaque arme a ses stats :

```yaml
  - id: gargant
    emplacements:
      - id: bras_1
        nom: Arme de bras 1
        requis: true
        max_cout: 50
        armes: [mega_kikoup, gros_kanon, …]   # ids d'armes définies avec leurs stats
```

### 3.3 Couche « Liste d'armée » (sections, formations, options)

```yaml
sections:                      # = « groupes » du builder, = blocs colorés du PDF
  - id: compagnies
    titre: COMPAGNIES DE LA LÉGION D'ACIER
    note_md: "Chaque amélioration ne peut être prise qu'une seule fois…"
    formations: [qg_regimentaire, compagnie_mecanisee, …]
  - id: appui
    titre: FORMATIONS D'APPUI
    contraintes:
      - { type: consomme, budget: slot_appui }          # chaque formation prend 1 slot
    formations: [peloton_super_lourd, …]
  - id: supports
    titre: SUPPORTS DE LA LÉGION D'ACIER
    contraintes:
      - { type: consomme, budget: rare, quoi: points }  # 1/3 des points
    modules: [aeronautica-imperialis, adeptus-titanicus]

formations:
  - id: compagnie_blindee
    nom: Compagnie Blindée
    variantes:                 # au moins une ; plusieurs = lignes « ou » du PDF
      - id: base
        cout: 600
        composition:
          - { unite: leman_russ, nombre: 10 }
          - { unite: commissaire, nombre: 1, gratuit: true }
    options: [vanquisher_gratuit, remplacement_demolisseurs, …]
    contraintes:
      - { type: fournit, budget: slot_appui, quantite: 2 }
      - { type: max_options, valeur: 3 }
```

**Composition** = liste de lignes. Une ligne est soit fixe (`unite` +
`nombre`), soit un **choix** :

```yaml
composition:
  - choix:                     # « 9 unités parmi Basilisks, Manticores, Bombardes »
      total: 9                 # ou { min: 4, max: 6 }
      parmi:
        - { unite: basilisk }
        - { unite: manticore }
        - { unite: bombarde }
  - choix:                     # Tyranides : « 2 à 6 essaims », 1 pioche = 6 figurines
      total: { min: 2, max: 6 }
      parmi:
        - { unite: hormagaunt, par_pioche: 6, cout: 75 }
```

Un choix avec `cout` par option = coût variable (Tyranides, transports).
Deux blocs `choix` dans une même composition = « synaptique + essaims ».
Fini les trois clés `composition_personnalisee` / `_essaims` / `_synaptique`.

**Options** (= « améliorations ») définies une fois au niveau codex et
référencées par les formations :

```yaml
options:
  - id: escadron_chars
    nom: Escadron de Chars
    effet:
      type: ajouter
      variantes:               # lignes « ou » du PDF
        - { nom: "3 Leman Russ", cout: 175, unites: [{ unite: leman_russ, nombre: 3 }] }
        - { nom: "3 Leman Russ Démolisseurs", cout: 225, unites: [{ unite: leman_russ_demolisseur, nombre: 3 }] }
    contraintes:
      - { type: max_par_formation, valeur: 1 }

  - id: transport_chimere
    nom: Transport Chimères
    effet: { type: ajouter, unites: [{ unite: chimere }], cout_par_unite: 25, max: besoin_transport }
    contraintes:
      - { type: hors_quota_options }        # ne compte pas dans « max 3 »
    note_md: "Vous ne pouvez pas prendre plus de Chimères que nécessaire."

  - id: remplacement_demolisseurs
    nom: Remplacer 3 Leman Russ par 3 Démolisseurs
    effet: { type: remplacer, de: leman_russ, par: leman_russ_demolisseur, lot: 3, cout: 50 }

  - id: commissaire_appui
    nom: Commissaire
    effet: { type: ajouter, unites: [{ unite: commissaire, nombre: 1 }], cout: 0 }
    contraintes:
      - { type: max_par_formation, valeur: 1 }
      - { type: consomme, budget: commissaires_gratuits }
```

### 3.4 Budgets : le mécanisme qui remplace slots, quota rare et commissaires

Aujourd'hui trois mécanismes distincts (tags de slots avec backtracking,
ratio 1/3, quota commissaires par tranche de 1000 pts). Ce sont tous des
**budgets** : une capacité, des consommateurs.

```yaml
budgets:
  - id: slot_appui
    libelle: Formations d'appui
    capacite: { source: fournitures }         # somme des « fournit » des formations présentes
    phrase_pdf: "Jusqu'à {n} formations d'appui par compagnie"

  - id: rare
    libelle: Soutien du Munitorum              # « label_rares »
    capacite: { source: ratio_points, ratio: 0.3333, base: limite_liste }
    phrase_pdf: "Jusqu'à 1/3 des points disponibles peuvent être dépensés pour ces formations"

  - id: commissaires_gratuits
    libelle: Commissaires
    capacite: { source: par_tranche, points: 1000, perimetre: section:compagnies }
    phrase_pdf: "1 commissaire gratuit par tranche de 1 000 pts de compagnies"
```

Le backtracking du builder actuel (formation qui peut consommer le slot A
**ou** B) reste possible : `consomme: { budget: [slot_A, slot_B] }`.

---

## 4. Grammaire des contraintes (vocabulaire fermé)

C'est la liste complète de ce qu'on peut exprimer. Chaque contrainte a une
**phrase PDF générée** automatiquement (surchargeable), donc l'auteur ne
l'écrit pas deux fois.

| Contrainte | Porte sur | Sens | Phrase générée | Remplace (builder actuel) |
|---|---|---|---|---|
| `max_par_armee: n` | formation, option | 0-n dans la liste | préfixe « 0-1 » | `FormationLimite`, `limiteOptionGlobal` |
| `min_par_armee: n` | formation, section | obligatoire | « Au moins une … obligatoire » | `FormationMinimum`, `min_formations` |
| `max_par_formation: n` | option | n fois par formation, surchargeable par variante | « une seule fois par formation » | `limit`, `limit_par_variante` |
| `max_options: n` | formation, section | nb d'options comptées | « jusqu'à 3 améliorations » | `limiteOptionFormation` |
| `hors_quota_options` | option | ne compte pas dans `max_options` | astérisque + note | `IsNotOption` |
| `exclusif: groupe` | option | une seule option du groupe par formation | « ou » | `unique`, `exclut` |
| `requiert_unite: [ids]` | option | visible si la formation contient l'unité | « (formations avec X) » | `requires_unites` |
| `taille_max_formation: n` | option | formation ≤ n unités | « formation de n unités max » | `max_unites_formation` |
| `obligatoire` | option (dans une formation) | ajoutée d'office | intégrée dans la composition | `ameliorations_obligatoires` |
| `fournit: {budget, quantite}` | formation | ouvre des places | « Jusqu'à n … par … » | `FormationLimitationTag` |
| `consomme: {budget, quoi}` | formation, option, section | prend 1 place ou ses points | selon budget | `LimitationTag`, `rare`, `regle_quota`, `max_points_ratio` |
| `cout_rare: n` | formation | points comptés dans le budget rare si ≠ coût | rien | `cout_rare_base` |
| `initiative: "1+"` | formation, section, module | surcharge | ligne d'en-tête | `initiative_*` |
| `pas_une_activation` | formation | n'active pas (vaisseaux…) | note | `nbacti: false` |

Ce qui **disparaît** parce que porté par l'unité : `taille_transport`,
`capacite_transport`, `stat_nom`, `unit_stat_name`, `commandant_supreme`,
`commissaire` (rôles et stats dans le profil). Ce qui **disparaît** parce que
remplacé par les variantes explicites : `nombre_exact`, `multiplicateur`,
`ajout_unites`, `unites_override` (on stocke la composition développée, le
formulaire propose « dupliquer la variante ×1,5 » pour aller vite).

Si un codex a besoin d'une règle qui n'entre pas dans la table, on
**ajoute une ligne à la table** (schéma + moteur + phrase), on n'ajoute pas
une clé libre. C'est le prix d'avoir un seul moteur.

---

## 5. Sorties

### 5.1 PDF

- Template HTML/Vue « print » reproduisant la mise en page actuelle :
  page de garde, page « Utiliser la liste » + règles spéciales, tableaux par
  section (colonnes Formations / Unités / Coût, lignes « ou » depuis les
  variantes), feuilles de références générées depuis `unites`.
- Rendu par une route serveur Nuxt (Chromium headless via Playwright) au
  moment de **Publier**, stocké sur R2, et l'URL écrite dans
  `army_versions.pdf_url`. Le flux public du site ne change pas.
- L'upload manuel de PDF reste possible (`source: uploaded`) pour les armées
  pas encore migrées.

### 5.2 Builder intégré

- Page du site (`/builder/{slug}`), consomme le format natif via
  `GET /api/codex/{slug}.json` et le même paquet `codex-engine` que l'admin et
  le PDF. Une seule implémentation des règles.
- Comptes joueurs (Supabase Auth, lien magique) pour sauvegarder, partager
  (URL publique), imprimer une liste.
- Le moteur de validation du builder actuel (backtracking des slots, quota
  rare par tranche de 1000, remplacements par lots, calcul des transports) se
  porte tel quel dans le paquet.
- Les listes sauvegardées dans l'ancien builder (Firebase, autre système de
  comptes) ne sont pas reprises automatiquement. Les identifiants de
  formations sont conservés à l'import, ce qui rend un import manuel
  (coller sa liste) possible. L'ancien builder reste en ligne pendant la
  transition.

---

## 6. Ergonomie de saisie (le « pas trop chiant »)

Principe : **l'écran de saisie ressemble au PDF.** L'onglet Liste d'armée
affiche les tableaux tels qu'ils seront imprimés (section, formation, unités,
coût). On clique une ligne pour l'éditer dans un panneau latéral. Ce qu'on
tape apparaît aussitôt dans le tableau.

Page admin d'une armée, cinq onglets :

1. **Armée** : ce qui existe déjà (nom, faction, statut, citation, icône) +
   intro et blocs de règles en markdown.
2. **Unités** : tableau éditable façon tableur (une ligne = un profil, armes
   en sous-lignes). Bouton « Pré-remplir depuis le PDF actuel » : extraction
   texte de la feuille de références, à relire. Les noms saisis ici sont ceux
   que le parseur de composition reconnaît.
3. **Liste d'armée** : les tableaux du PDF, éditables. Panneau d'une
   formation : nom, coût, **composition en texte libre parsé** (« 12 Gardes
   Impériaux, 7 Chimères », « 3 au choix parmi Baneblade, Shadowsword »,
   autocomplétion sur les unités), variantes « ou », règles propres à la
   formation. Les **règles sont des phrases à trous** choisies dans une liste
   fermée (« Au plus [1] dans l'armée », « Remplacer [3] [Leman Russ] par [3]
   [Démolisseur] pour [50] pts »). Chaque phrase correspond à une contrainte
   du §4.
4. **Réglages de section** : les règles qui portent sur toute une section
   (« Chaque formation ouvre [2] places [appui] », « au plus [3] options »,
   « 1 [Commissaire] gratuit par tranche de [1000] pts ») et la **liste des
   options disponibles pour toutes les formations de la section**. Une
   formation peut retirer ou ajouter une option depuis sa ligne. Ça évite de
   cocher 10 options sur 6 compagnies.
5. **Aperçu PDF / Aperçu builder** : régénérés à chaque sauvegarde du
   brouillon.

Garde-fous :

- Validation à l'enregistrement : schéma + intégrité (une formation ne
  référence pas une unité inexistante) + **listes de test** : chaque codex
  garde 2 ou 3 listes fixtures « doit être valide » / « doit être refusée ».
  Publier échoue si une fixture bascule.
- Diff entre le brouillon et la version publiée, qui pré-rédige le changelog.
- Publier = snapshot immuable dans `army_versions` (JSON + PDF + changelog).
  Restaurer une ancienne version comme aujourd'hui.

---

## 7. Stockage (Supabase)

Minimal, en s'appuyant sur l'existant :

```sql
-- brouillon éditable, un par armée
create table codex_drafts (
  army_id uuid primary key references armies(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz default now()
);

-- snapshot publié : on étend army_versions plutôt que créer une table
alter table army_versions
  add column data jsonb,                       -- null pour les PDF uploadés à la main
  add column source text not null default 'uploaded'
    check (source in ('uploaded', 'generated'));

-- modules partagés (Aeronautica, Titanicus, socle SM…), versionnés pareil
create table codex_modules (
  slug text primary key,
  data jsonb not null,
  updated_at timestamptz default now()
);
```

Un document JSON par codex, validé par zod. Pas de normalisation relationnelle
des unités et formations : ça multiplierait les tables pour rien, le document
est petit (10 à 25 Ko) et se versionne d'un bloc.

---

## 8. Plan de migration

| Étape | Livrable | Vérification |
|---|---|---|
| 1 | Paquet `codex-engine` : schéma zod, coûts, validation, phrases, parseur de composition | tests unitaires sur les 37 codex convertis |
| 2 | Importeur ELB → natif (les 37 JSON) + extracteur PDF → unités | Légion d'Acier complète, diff visuel PDF |
| 3 | Template PDF + route de génération + R2 | 3 codex comparés à l'œil aux PDF actuels |
| 4 | Admin (onglets Unités et Liste d'armée d'abord) | saisie d'un codex neuf de bout en bout par un non-dev |
| 5 | Relecture et publication des 41 codex | un codex à la fois, ancien PDF en ligne jusqu'à validation |
| 6 | Builder intégré : construction, comptes, sauvegarde, partage, impression | les listes fixtures donnent le même verdict que l'ancien builder |

Ordre volontaire : le moteur et l'import d'abord, l'interface ensuite, pour
qu'on ait vite les 37 codex dans le nouveau format et qu'on découvre les cas
que la grammaire ne couvre pas **avant** de construire l'admin. Le builder en
dernier : il ne fait qu'afficher des règles déjà écrites et testées.

---

## 9. Points à trancher

- **Fidélité PDF** : reproduire la maquette actuelle au pixel, ou accepter une
  nouvelle maquette plus simple à générer ? (Le second est bien moins cher.)
- **Ancien builder** : durée de cohabitation après ouverture du nouveau, et
  import manuel des listes ou pas. À voir avec Cerkaire.
- **Comptes joueurs** : lien magique seul, ou aussi Google/Discord.
- **Génération PDF** : à la publication (Playwright côté serveur, il faut que
  l'hébergement accepte Chromium) ou à la demande avec cache.
- **Modules partagés** : périmètre initial. Aeronautica + Titanicus sont
  évidents (présents dans la moitié des codex impériaux). Le socle Space
  Marines (10 chapitres qui répètent tactiques/devastators/terminators) est
  le gros gain suivant.

---

## Annexe A : correspondance format builder actuel → modèle

| Clé actuelle | Occurrences | Devient |
|---|---|---|
| `codex.regles_speciales.valeur_strategique` | 37 | `codex.valeur_strategique` |
| `initiative_defaut`, `initiative_titanicus`, `initiative_*`, `note_initiative` | ~50 | `codex.initiative.{defaut, exceptions[]}` |
| `max_formations_rares_ratio`, `label_rares` | 36+13 | budget `rare` |
| `commissaire_quota_soutien.points_par_tranche` | 4 | budget `par_tranche` |
| `taille_transport`, `capacite_transport`, `transport_notes` | 27+27+3 | `unite.transport`, `unite.taille_transport` |
| `groupes[]` | 146 | `sections[]` |
| `groupes[].LimitationTag`, `max_par_tag` | 50+11 | `consomme: {budget}` sur la section |
| `groupes[].rare`, `max_points_ratio` | 22+6 | `consomme: {budget: rare, quoi: points}` |
| `groupes[].min_formations` | 6 | `min_par_armee` sur la section |
| `formations[].cout` + `unites[]` | 674+658 | `variantes[0].{cout, composition}` |
| `formations[].variantes[]` (`nombre_exact`, `multiplicateur`, `ajout_unites`, `unites_override`) | 191 | `variantes[]` explicites |
| `composition_personnalisee`, `composition_essaims`, `composition_synaptique`, `nombre_variable` | 75+8+3+2 | ligne `choix` dans `composition` (`total`, `parmi`, `par_pioche`, `cout`) |
| `FormationLimitationTag: {tag: n}` | 112 | `fournit: {budget, quantite}` |
| `FormationLimite`, `FormationMinimum` | 108+8 | `max_par_armee`, `min_par_armee` |
| `rare`, `cout_rare_base` | 186+2 | `consomme: rare`, `cout_rare` |
| `limiteOptionFormation` | 139+3 | `max_options` |
| `initiative` (formation) | 242 | `initiative` (formation) |
| `nbacti: false` | 4 | `pas_une_activation` |
| `unites[].options[].items[]` (armement, `max_cout`, `unique`, `multiple`) | 23 | `unite.emplacements[]` avec armes typées |
| `ameliorations[]` | 486 | `options[]` |
| `ameliorations[].unites`, `cout`, `cout_par_unite`, `min`, `max` | | `effet: ajouter` |
| `type_remplacement` (`remplace_unites`, `par_unite`, `taille_lot`, `quantite_fixe`, `remplace_tout`, `max_remplace`, `par_nombre`) | 36+21 | `effet: remplacer` (`de`, `par`, `lot`, `max`, `tout`) |
| `choix[]` (avec `nb_unites`, `ajouter_unites`, `type_remplacement`) | 108 | `effet.variantes[]` |
| `limit`, `limit_par_variante` | 417+2 | `max_par_formation` (surchargeable par variante) |
| `limiteOptionGlobal` | 41+21 | `max_par_armee` |
| `IsNotOption`, `non_comptee` | 27+2 | `hors_quota_options` |
| `unique: "groupe"`, `exclut: []` | 1+3 | `exclusif: groupe` |
| `requires_unites` | 8 | `requiert_unite` |
| `max_unites_formation` | 1 | `taille_max_formation` |
| `ameliorations_obligatoires` | | `obligatoire` |
| `commandant_supreme`, `commissaire` | 44+4 | `unite.roles` |
| `affiche_dans_composition` | 21 | comportement par défaut de `effet: ajouter` |
| `stat_nom`, `unit_stat_name` | 18+7 | disparaît (l'unité porte ses stats) |
| `cout_paliers`, `valeurs_possibles`, `exclusif_avec`, `force_slider`, `tags` | 1 à 12 | à traiter au cas par cas à l'import (probablement `choix` + `exclusif`) |

Un exemple complet en format natif : `content/codex/legion-dacier.yaml` (schéma : `shared/codex/schema.ts`).
