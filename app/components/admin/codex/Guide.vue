<script setup lang="ts">
/** Tutoriel : comment créer une armée de A à Z. Dépliable, état mémorisé dans le navigateur. */
const ouvert = ref(true)
const onglet = ref<'etapes' | 'composition' | 'recettes'>('etapes')
const CLE = 'admin-codex-guide'

onMounted(() => {
  try { ouvert.value = localStorage.getItem(CLE) !== 'ferme' } catch { /* ignore */ }
})
watch(ouvert, (v) => { try { localStorage.setItem(CLE, v ? 'ouvert' : 'ferme') } catch { /* ignore */ } })

const etapes = [
  {
    titre: 'Créer l\'armée',
    texte: 'Bouton « Nouvelle armée » : nom et faction. La fiche est créée vide avec deux sections (principales, supports) et le budget « 1/3 des points ». Tout s\'enregistre automatiquement en brouillon : rien n\'est public avant « Publier ».',
  },
  {
    titre: 'Onglet Armée : présentation',
    texte: 'Version, statut, couleur (celle des bandeaux du PDF), citation, texte « Utiliser la liste d\'armée », règles spéciales en texte libre. Les budgets sont ici aussi (voir Recettes).',
  },
  {
    titre: 'Onglet Unités : la feuille de références',
    texte: 'Une ligne par profil : type, vitesse, blindage, CC, FF. Déplie la ligne pour les armes, notes, dégâts critiques et le transport. Saisis les unités AVANT les formations : les compositions reconnaissent les noms écrits ici.',
  },
  {
    titre: 'Onglet Améliorations : les options',
    texte: 'Définies une fois, proposées ensuite aux sections et formations. Choisis le type d\'effet (ajouter, remplacer, mot-clé, choix, répartition), les unités et le coût, puis les règles (« Au plus 1 fois par formation », etc.).',
  },
  {
    titre: 'Onglet Liste d\'armée : le PDF lui-même',
    texte: 'Clique un bandeau pour régler la section (règles héritées, améliorations disponibles). Clique une ligne ou « + Ajouter une formation » pour la formation : nom, coût, composition en texte, variantes « ou », améliorations cochées, règles propres. Ce que tu tapes apparaît aussitôt dans le tableau.',
  },
  {
    titre: 'Onglet Aperçu : vérifier',
    texte: 'Le PDF du brouillon tel qu\'il sera publié, et un lien pour tester une liste dans le builder avec ce brouillon.',
  },
  {
    titre: 'Publier',
    texte: 'Le bouton reste grisé tant que « N problème(s) » est affiché : clique dessus pour voir quoi corriger (unité inconnue, référence cassée…). À la publication : numéro de version, explication, les listes de test sont rejouées, puis la version devient publique pour le PDF et le builder.',
  },
]

const syntaxe = [
  { ex: '6 Leman Russ', sens: 'ligne fixe : nombre puis nom d\'unité (accents, majuscules et pluriel tolérés)' },
  { ex: '12 Gardes Impériaux, 7 Chimères', sens: 'plusieurs lignes séparées par des virgules' },
  { ex: '1 Commissaire (implicite)', sens: 'présent dans la formation mais non affiché dans la colonne Unités (règle spéciale)' },
  { ex: '3 au choix parmi Baneblade, Shadowsword', sens: 'le joueur choisit exactement 3 unités parmi la liste' },
  { ex: '4 à 9 au choix parmi Chassa-Bomba (50)', sens: 'de 4 à 9, chaque unité coûte 50 pts en plus du coût de la formation' },
  { ex: '2 à 6 au choix parmi Termagant ×6 (75), Hormagaunt ×6 (75)', sens: 'une pioche = 6 figurines à 75 pts (essaims Tyranides)' },
  { ex: '4 Scouts, + transports Rhino', sens: 'ajoute automatiquement autant de Rhinos gratuits que nécessaire pour embarquer la formation (le Rhino doit avoir un transport défini dans Unités)' },
]

const recettes = [
  { cas: '« 0-1 » devant une formation', comment: 'Formation → règle « Au plus 1 dans l\'armée ». Le préfixe 0-1 est écrit par le site.' },
  { cas: 'Deux compositions au choix, coûts différents', comment: '« + Variante ou » dans la formation : chaque variante a son nom, son coût, sa composition. Le PDF affiche « ou » entre les lignes.' },
  { cas: 'Jusqu\'à 3 améliorations, une seule fois chacune', comment: 'Section → règle « Au plus 3 améliorations par formation ». Sur chaque option → « Au plus 1 fois par formation ». Une option qui ne doit pas compter (transports, commissaire) : « Ne compte pas dans le nombre d\'améliorations ».' },
  { cas: 'Supports limités à 1/3 des points', comment: 'Onglet Armée → budget « Supports », capacité « fraction des points », 0.3334. Section des supports → règle « Compte dans le budget Supports (points) ». La phrase du budget devient le sous-titre de la section.' },
  { cas: '2 formations d\'appui par compagnie', comment: 'Budget « Formations d\'appui », capacité « places ouvertes par les formations ». Section des compagnies → « Ouvre 2 places Formations d\'appui ». Section d\'appui → « Compte dans le budget Formations d\'appui (un) ».' },
  { cas: '1 commissaire gratuit par tranche de 1000 pts', comment: 'Budget capacité « 1 par tranche de N points », 1000, périmètre « section:compagnies ». L\'option Commissaire → « Compte dans le budget Commissaires (un) », coût 0.' },
  { cas: 'Remplacer 3 Leman Russ par 3 Démolisseurs (+50 pts)', comment: 'Option type « Remplacer » : remplace Leman Russ, par Leman Russ Démolisseur, 3 unités par lot, 50 pts par lot, 1 lot max. Coche-la sur la formation concernée.' },
  { cas: 'Chimères « autant que nécessaire »', comment: 'Option « Ajouter », mode par unité, max « autant que nécessaire pour embarquer ». Le builder calcule la limite depuis les capacités de transport des unités.' },
  { cas: 'Bandes Orks normale / mastok / tré mastok', comment: 'Trois variantes avec la composition écrite multipliée (2 Nobz, 6 Boyz / 4 Nobz, 12 Boyz…). Les limites de kust\'om qui doublent avec la taille : coche « multiplié par la taille » sur la règle de l\'option (la taille se règle dans l\'éditeur JSON de la variante : taille 1, 2, 3).' },
  { cas: 'Groupes synaptiques Tyranides', comment: 'Section « Essaims instinctifs » → règle « Ne se prend qu\'au sein d\'une autre formation ». Sur chaque groupe synaptique : « Cette formation en rattache », de 2 à 6, coche les essaims autorisés. Le PDF affiche la colonne Puissance synaptique.' },
  { cas: 'Note avec astérisque sous un tableau', comment: 'Option → champ « Note ». Elle s\'affiche en bas du tableau des améliorations de la section, avec l\'astérisque sur le nom.' },
  { cas: 'Vérifier une règle avant de publier', comment: 'Onglet Aperçu → « Tester dans le builder » : construis la liste qui doit passer, et celle qui doit être refusée. Quand le modèle sera en base, ces listes deviendront les listes de test rejouées à chaque publication.' },
]
</script>

<template>
  <section class="rounded-lg border border-gold/15 bg-surface-light">
    <button type="button" class="flex w-full items-center justify-between px-5 py-3 text-left" @click="ouvert = !ouvert">
      <span class="flex items-center gap-3">
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 font-heading text-sm font-bold text-gold">?</span>
        <span class="font-heading text-base font-semibold text-gray-100">Comment créer une armée</span>
        <span class="hidden text-xs text-gray-500 sm:inline">7 étapes, la syntaxe des compositions, et les recettes des cas classiques</span>
      </span>
      <span class="text-gray-500">{{ ouvert ? '▴' : '▾' }}</span>
    </button>

    <div v-if="ouvert" class="border-t border-gold/10 px-5 pb-5 pt-3">
      <div class="mb-4 flex gap-1 text-sm">
        <button type="button" class="onglet" :class="onglet === 'etapes' ? 'actif' : ''" @click="onglet = 'etapes'">Les étapes</button>
        <button type="button" class="onglet" :class="onglet === 'composition' ? 'actif' : ''" @click="onglet = 'composition'">Écrire une composition</button>
        <button type="button" class="onglet" :class="onglet === 'recettes' ? 'actif' : ''" @click="onglet = 'recettes'">Recettes</button>
      </div>

      <ol v-if="onglet === 'etapes'" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <li v-for="(e, i) in etapes" :key="i" class="flex gap-3 rounded-md border border-white/5 bg-surface p-3">
          <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-sm font-bold text-surface">{{ i + 1 }}</span>
          <div>
            <p class="font-semibold text-gray-100">{{ e.titre }}</p>
            <p class="mt-1 text-sm leading-relaxed text-gray-400">{{ e.texte }}</p>
          </div>
        </li>
      </ol>

      <div v-else-if="onglet === 'composition'">
        <p class="mb-3 text-sm text-gray-400">Dans le panneau d'une formation, la composition se tape comme dans le codex. Le site reconnaît les unités de l'onglet Unités et écrit lui-même la phrase du PDF (« et », « ou », « + transports »).</p>
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="s in syntaxe" :key="s.ex" class="border-t border-white/5">
              <td class="w-[42%] py-2 pr-4 font-body text-base text-gold-light">{{ s.ex }}</td>
              <td class="py-2 text-gray-300">{{ s.sens }}</td>
            </tr>
          </tbody>
        </table>
        <p class="mt-3 text-xs text-gray-500">Une unité inconnue s'affiche en rouge sous le champ : ajoute-la dans l'onglet Unités ou corrige l'orthographe.</p>
      </div>

      <div v-else class="grid gap-3 md:grid-cols-2">
        <div v-for="r in recettes" :key="r.cas" class="rounded-md border border-white/5 bg-surface p-3">
          <p class="font-semibold text-gray-100">{{ r.cas }}</p>
          <p class="mt-1 text-sm leading-relaxed text-gray-400">{{ r.comment }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.onglet { @apply rounded-md px-3 py-1.5 text-gray-400 hover:text-gray-200; }
.onglet.actif { @apply bg-gold/10 text-gold; }
</style>
