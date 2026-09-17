<script setup lang="ts">
/** Guide « Comment créer une armée » : bouton + tiroir latéral, lecture sur une colonne. */
const props = defineProps<{
  /** libellé du bouton d'ouverture */
  libelle?: string
  /** volet affiché à l'ouverture */
  volet?: 'etapes' | 'composition' | 'recettes'
}>()

const ouvert = ref(false)
const onglet = ref<'etapes' | 'composition' | 'recettes'>(props.volet ?? 'etapes')

function fermer() { ouvert.value = false }
function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') fermer() }
watch(ouvert, (v) => {
  if (v) { onglet.value = props.volet ?? 'etapes'; window.addEventListener('keydown', surTouche) }
  else window.removeEventListener('keydown', surTouche)
})
onBeforeUnmount(() => window.removeEventListener('keydown', surTouche))

const etapes = [
  { titre: 'Créer l\'armée', texte: 'Bouton « Nouvelle armée » : nom et faction. La fiche est créée vide avec deux sections (principales, supports) et le budget « 1/3 des points ». Tout s\'enregistre automatiquement en brouillon : rien n\'est public avant « Publier ».' },
  { titre: 'Onglet Armée : présentation', texte: 'Version, statut, couleur (celle des bandeaux du PDF), citation, texte « Utiliser la liste d\'armée », règles spéciales en texte libre. Les budgets sont ici aussi (voir Recettes).' },
  { titre: 'Onglet Unités : la feuille de références', texte: 'Une ligne par profil : type, vitesse, blindage, CC, FF. Déplie la ligne pour les armes, notes, dégâts critiques et le transport. Saisis les unités AVANT les formations : les compositions reconnaissent les noms écrits ici.' },
  { titre: 'Onglet Améliorations : les options', texte: 'Définies une fois, proposées ensuite aux sections et formations. Choisis le type d\'effet (ajouter, remplacer, mot-clé, choix, répartition), les unités et le coût, puis les règles (« Au plus 1 fois par formation », etc.).' },
  { titre: 'Onglet Liste d\'armée : le PDF lui-même', texte: 'Clique un bandeau pour régler la section (règles héritées, améliorations disponibles). Clique une ligne ou « + Ajouter une formation » pour la formation : nom, coût, composition en texte, variantes « ou », améliorations cochées, règles propres. Ce que tu tapes apparaît aussitôt dans le tableau.' },
  { titre: 'Onglet Aperçu : vérifier', texte: 'Le PDF du brouillon tel qu\'il sera publié, et un lien pour tester une liste dans le builder avec ce brouillon.' },
  { titre: 'Publier', texte: 'Le bouton reste grisé tant que « N problème(s) » est affiché : clique dessus pour voir quoi corriger (unité inconnue, référence cassée…). À la publication : numéro de version, explication, les listes de test sont rejouées, puis la version devient publique pour le PDF et le builder.' },
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
  { cas: '« 0-1 » devant une formation', comment: 'Formation : règle « Au plus 1 dans l\'armée ». Le préfixe 0-1 est écrit par le site.' },
  { cas: 'Deux compositions au choix, coûts différents', comment: '« + Variante ou » dans la formation : chaque variante a son nom, son coût, sa composition. Le PDF affiche « ou » entre les lignes.' },
  { cas: 'Jusqu\'à 3 améliorations, une seule fois chacune', comment: 'Section : règle « Au plus 3 améliorations par formation ». Sur chaque option : « Au plus 1 fois par formation ». Une option qui ne doit pas compter (transports, commissaire) : « Ne compte pas dans le nombre d\'améliorations ».' },
  { cas: 'Supports limités à 1/3 des points', comment: 'Onglet Armée : budget « Supports », capacité « fraction des points », 0.3334. Section des supports : règle « Compte dans le budget Supports (points) ». La phrase du budget devient le sous-titre de la section.' },
  { cas: '2 formations d\'appui par compagnie', comment: 'Budget « Formations d\'appui », capacité « places ouvertes par les formations ». Section des compagnies : « Ouvre 2 places Formations d\'appui ». Section d\'appui : « Compte dans le budget Formations d\'appui (un) ».' },
  { cas: '1 commissaire gratuit par tranche de 1000 pts', comment: 'Budget capacité « 1 par tranche de N points », 1000, périmètre « section:compagnies ». L\'option Commissaire : « Compte dans le budget Commissaires (un) », coût 0.' },
  { cas: 'Remplacer 3 Leman Russ par 3 Démolisseurs (+50 pts)', comment: 'Option type « Remplacer » : remplace Leman Russ, par Leman Russ Démolisseur, 3 unités par lot, 50 pts par lot, 1 lot max. Coche-la sur la formation concernée.' },
  { cas: 'Chimères « autant que nécessaire »', comment: 'Option « Ajouter », mode par unité, max « autant que nécessaire pour embarquer ». Le builder calcule la limite depuis les capacités de transport des unités.' },
  { cas: 'Bandes Orks normale / mastok / tré mastok', comment: 'Trois variantes avec la composition écrite multipliée (2 Nobz, 6 Boyz / 4 Nobz, 12 Boyz…). Les limites de kust\'om qui doublent avec la taille : coche « multiplié par la taille » sur la règle de l\'option (la taille se règle dans l\'éditeur JSON de la variante : taille 1, 2, 3).' },
  { cas: 'Groupes synaptiques Tyranides', comment: 'Section « Essaims instinctifs » : règle « Ne se prend qu\'au sein d\'une autre formation ». Sur chaque groupe synaptique : « Cette formation en rattache », de 2 à 6, coche les essaims autorisés. Le PDF affiche la colonne Puissance synaptique.' },
  { cas: 'Alliance : 1/3 des points dans un autre codex', comment: 'Onglet Liste d\'armée, clique le bandeau de la section des supports : « Alliance », choisis le codex (Adeptus Titanicus, Aeronautica Imperialis…). Ses formations apparaissent dans la section, avec les règles de la section (« Compte dans le budget Supports », donc 1/3 des points). Les listes de soutien partagées s\'écrivent une fois et servent à tous les codex qui y ont droit.' },
  { cas: 'Note avec astérisque sous un tableau', comment: 'Option : champ « Note ». Elle s\'affiche en bas du tableau des améliorations de la section, avec l\'astérisque sur le nom.' },
  { cas: 'Vérifier une règle avant de publier', comment: 'Onglet Aperçu : « Tester dans le builder ». Construis la liste qui doit passer, et celle qui doit être refusée. Quand le modèle sera en base, ces listes deviendront les listes de test rejouées à chaque publication.' },
]
</script>

<template>
  <button type="button" class="inline-flex items-center gap-2 rounded-md border border-gold/30 px-3 py-1.5 text-sm text-gold hover:bg-gold/10" @click="ouvert = true">
    <span class="flex h-5 w-5 items-center justify-center rounded-full bg-gold/15 font-heading text-xs font-bold">?</span>
    {{ libelle ?? 'Guide' }}
  </button>

  <Teleport to="body">
    <Transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
      <div v-if="ouvert" class="fixed inset-0 z-[60] bg-black/50" @click="fermer" />
    </Transition>
    <Transition enter-active-class="transition duration-250 ease-out" enter-from-class="translate-x-full" enter-to-class="translate-x-0" leave-active-class="transition duration-200 ease-in" leave-from-class="translate-x-0" leave-to-class="translate-x-full">
      <aside v-if="ouvert" class="fixed inset-y-0 right-0 z-[61] flex w-full max-w-xl flex-col border-l border-gold/20 bg-surface-light shadow-2xl" role="dialog" aria-label="Comment créer une armée">
        <header class="flex items-center justify-between border-b border-gold/10 px-6 py-4">
          <div>
            <p class="text-xs uppercase tracking-widest text-gold">Guide</p>
            <h2 class="font-heading text-xl font-bold text-white">Comment créer une armée</h2>
          </div>
          <button type="button" class="rounded-md p-2 text-gray-400 hover:bg-white/10 hover:text-white" title="Fermer (Échap)" @click="fermer">✕</button>
        </header>
        <nav class="flex gap-1 border-b border-gold/10 px-4 py-2 text-sm">
          <button type="button" class="onglet" :class="onglet === 'etapes' ? 'actif' : ''" @click="onglet = 'etapes'">Les étapes</button>
          <button type="button" class="onglet" :class="onglet === 'composition' ? 'actif' : ''" @click="onglet = 'composition'">Écrire une composition</button>
          <button type="button" class="onglet" :class="onglet === 'recettes' ? 'actif' : ''" @click="onglet = 'recettes'">Recettes</button>
        </nav>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <ol v-if="onglet === 'etapes'" class="space-y-4">
            <li v-for="(e, i) in etapes" :key="i" class="flex gap-4">
              <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold font-heading text-sm font-bold text-surface">{{ i + 1 }}</span>
              <div>
                <p class="font-semibold text-gray-100">{{ e.titre }}</p>
                <p class="mt-1 font-body text-base leading-relaxed text-gray-300">{{ e.texte }}</p>
              </div>
            </li>
          </ol>

          <div v-else-if="onglet === 'composition'">
            <p class="font-body text-base leading-relaxed text-gray-300">Dans le panneau d'une formation, la composition se tape comme dans le codex. Le site reconnaît les unités de l'onglet Unités et écrit lui-même la phrase du PDF (« et », « ou », « + transports »).</p>
            <dl class="mt-4 divide-y divide-white/5">
              <div v-for="s in syntaxe" :key="s.ex" class="py-3">
                <dt class="font-body text-lg text-gold-light">{{ s.ex }}</dt>
                <dd class="mt-1 text-sm leading-relaxed text-gray-400">{{ s.sens }}</dd>
              </div>
            </dl>
            <p class="mt-3 text-xs text-gray-500">Une unité inconnue s'affiche en rouge sous le champ : ajoute-la dans l'onglet Unités ou corrige l'orthographe.</p>
          </div>

          <dl v-else class="divide-y divide-white/5">
            <div v-for="r in recettes" :key="r.cas" class="py-3">
              <dt class="font-semibold text-gray-100">{{ r.cas }}</dt>
              <dd class="mt-1 font-body text-base leading-relaxed text-gray-300">{{ r.comment }}</dd>
            </div>
          </dl>
        </div>
      </aside>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onglet { @apply rounded-md px-3 py-1.5 text-gray-400 hover:text-gray-200; }
.onglet.actif { @apply bg-gold/10 text-gold; }
</style>
