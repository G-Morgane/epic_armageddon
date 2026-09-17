# Test du modèle unifié sur 4 armées

Branche `feat/codex-unifie`. Prouve qu'une seule fiche par armée produit le PDF et le builder.

## Ce qui est en place

| Brique | Où | Rôle |
|---|---|---|
| Schéma du format natif (zod) | `shared/codex/schema.ts` | définit la fiche, vérifie les références |
| Moteur de règles | `shared/codex/engine.ts` | résout une liste (unités, coûts, transports, remplacements), budgets, contraintes |
| Phrases PDF | `shared/codex/phrases.ts` | génère « 0-1 », « ou », « Jusqu'à 2 formations… » depuis les données |
| 4 codex | `content/codex/*.yaml` | Légion d'Acier, Adeptus Astartes, Tyranides, Orks de Ghazghkull |
| API | `server/api/codex/` | liste, JSON d'un codex, PDF généré (`/api/codex/{slug}/pdf`, Chromium sans écran) |
| Page imprimable | `app/pages/codex-test/[slug]/imprimer.vue` | la maquette du PDF (page de garde, liste d'armée, feuille de références) |
| Builder | `app/pages/builder/[slug].vue` + `app/components/codex/FormationCarte.vue` | construction de liste, budgets, erreurs, sauvegarde locale, impression |
| Tests | `tests/*.spec.ts` | schéma + références des 4 YAML, et les 27 listes fixtures rejouées dans le moteur |

Exemples de PDF générés : `docs/exemples/generes/`.

## Lancer

```bash
npm run test          # 27 tests : schéma, références, listes fixtures
npx nuxi dev          # puis /codex-test, /builder/legion-dacier, /codex-test/legion-dacier/imprimer
```

Le PDF serveur cherche Chromium dans `CHROMIUM_PATH`, sinon Google Chrome (macOS) ou `/usr/bin/chromium`.

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

1. Admin : tableaux éditables « comme le PDF », composition en texte parsé, règles en phrases à trous.
2. Publier : snapshot dans `army_versions` (colonne `data`), PDF poussé sur R2.
3. Convertir les 37 autres codex (importeur depuis `docs/reference/builder-json/`).
4. Builder : comptes joueurs, partage, impression soignée.
