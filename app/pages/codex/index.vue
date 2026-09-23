<script setup lang="ts">
/**
 * Point d'entrée de la construction d'armée : on choisit son codex, on lance le
 * builder ou on regarde le PDF. La même fiche YAML alimente les deux sorties.
 */
interface CodexMeta {
  slug: string
  nom: string
  version: string
  faction: string
  statut: string
  couleur?: string
  logo?: string
  type: string
  unites: number
  formations: number
  options: number
}

const urlSite = useUrlSite()
const { isAuthenticated } = useAuth()

useSeoMeta({
  title: 'Construire une armée',
  description: 'Monte ta liste Epic Armageddon à l\'écran : tous les codex jouables, validation des points et des formations, export PDF.',
  ogTitle: 'Construire une armée — Epic Armageddon FR',
  ogDescription: 'Choisis ton codex et monte ta liste en ligne, avec le PDF qui suit.',
  ogUrl: urlSite('/codex'),
})

// `lazy` : le rendu serveur attend les données, une navigation interne ouvre la
// page tout de suite et la grille se remplit ensuite.
const { data: tous, status } = await useFetch<CodexMeta[]>('/api/codex', { lazy: true })
const chargement = computed(() => status.value === 'pending' || status.value === 'idle')

const codex = computed(() => (tous.value ?? []).filter(c => c.type !== 'soutien'))
const soutiens = computed(() => (tous.value ?? []).filter(c => c.type === 'soutien'))

const FACTIONS = [
  { cle: 'imperium', label: 'Imperium' },
  { cle: 'chaos', label: 'Chaos' },
  { cle: 'xenos', label: 'Xenos' },
] as const
const libelleFaction = (f: string) => FACTIONS.find(x => x.cle === f)?.label ?? f

/**
 * Statut du codex, affiché sur la carte. Un codex officiel ne porte pas de
 * pastille : c'est le cas courant. Les autres doivent se voir, un expérimental
 * n'étant pas accepté en tournoi (voir /codex-beta).
 */
const STATUTS: Record<string, { label: string; classe: string }> = {
  beta: { label: 'Bêta', classe: 'bg-amber-500/15 text-amber-300' },
  experimental: { label: 'Expérimental', classe: 'bg-purple-500/15 text-purple-300' },
  '30k': { label: 'Epic 30k', classe: 'bg-red-500/15 text-red-300' },
}
const statutDe = (c: CodexMeta) => (c.statut && c.statut !== 'official' ? STATUTS[c.statut] : undefined)

const faction = ref<string | null>(null)
const recherche = ref('')

/** Recherche insensible aux accents : « eldar » doit trouver « Eldars ». */
const sansAccent = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const visibles = computed(() => {
  const q = sansAccent(recherche.value.trim())
  return codex.value.filter(c => (!faction.value || c.faction === faction.value) && (!q || sansAccent(c.nom).includes(q)))
})

const apercu = ref<{ slug: string; nom: string } | null>(null)
const apercuOuvert = computed({
  get: () => !!apercu.value,
  set: (v: boolean) => { if (!v) apercu.value = null },
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/20 via-surface to-surface" />
    <div class="absolute inset-0" style="background: radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)" />
    <EmberParticles />

    <div class="relative z-10 mx-auto max-w-6xl px-4 pb-32 pt-20">
      <nav class="mb-8 text-sm text-gray-500">
        <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
        <span class="mx-2">/</span>
        <span class="text-gray-300">Construire une armée</span>
      </nav>

      <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Construire une armée</h1>
      <p class="mt-2 max-w-2xl text-base text-gray-400 sm:mt-3 sm:text-lg">
        Choisis ton codex : les formations, les options et le total de points se montent à l'écran, et le PDF de la liste d'armée en découle.
      </p>
      <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

      <p v-if="isAuthenticated" class="mt-5 text-sm text-gray-400">
        Une liste en cours ?
        <NuxtLink to="/compte" class="underline hover:text-gold">Retrouve tes armées enregistrées</NuxtLink>.
      </p>

      <!-- Filtres : recherche et faction -->
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <BarreRecherche
          v-model="recherche"
          class="sm:w-72"
          placeholder="Rechercher un codex…"
          label="Rechercher un codex"
        />

        <div class="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div class="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-sm">
            <button
              type="button"
              :class="[
                'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:px-5 sm:text-sm',
                !faction ? 'bg-gold/15 text-gold shadow-sm' : 'text-gray-400 hover:text-gray-200',
              ]"
              @click="faction = null"
            >
              Toutes
              <span class="ml-1 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] sm:ml-1.5 sm:px-2 sm:text-xs">{{ codex.length }}</span>
            </button>
            <button
              v-for="f in FACTIONS"
              :key="f.cle"
              type="button"
              :class="[
                'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:px-5 sm:text-sm',
                faction === f.cle ? 'bg-gold/15 text-gold shadow-sm' : 'text-gray-400 hover:text-gray-200',
              ]"
              @click="faction = f.cle"
            >
              {{ f.label }}
              <span class="ml-1 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] sm:ml-1.5 sm:px-2 sm:text-xs">{{ codex.filter(c => c.faction === f.cle).length }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Grille des codex -->
      <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <!-- Cartes fantômes le temps de l'aller-retour : la page garde sa forme. -->
        <div
          v-for="n in (chargement ? 6 : 0)"
          :key="`fantome-${n}`"
          class="animate-pulse rounded-2xl border border-white/5 bg-white/[0.06] p-5 backdrop-blur-md"
          aria-hidden="true"
        >
          <div class="flex items-center gap-4">
            <div class="h-14 w-14 rounded-full bg-white/10" />
            <div class="flex-1 space-y-2">
              <div class="h-4 w-32 rounded bg-white/10" />
              <div class="h-3 w-20 rounded bg-white/5" />
            </div>
          </div>
          <div class="mt-5 h-8 w-full rounded bg-white/5" />
        </div>

        <article
          v-for="c in visibles"
          :key="c.slug"
          class="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.06] p-5 backdrop-blur-md transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.1] hover:shadow-[0_8px_32px_rgba(200,160,82,0.08)]"
        >
          <div class="flex items-start gap-4">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center">
              <div
                v-if="c.logo"
                class="army-icon h-14 w-14"
                :style="{ '--icon-url': `url(${c.logo})` }"
              />
              <span v-else class="font-heading text-2xl text-gold/30">{{ c.nom[0] }}</span>
            </div>
            <div class="min-w-0">
              <h2 class="font-heading text-xl font-semibold text-gray-100 transition-colors group-hover:text-gold">{{ c.nom }}</h2>
              <p class="mt-0.5 text-xs uppercase tracking-wider text-gray-500">{{ libelleFaction(c.faction) }} · REV {{ c.version }}</p>
              <span
                v-if="statutDe(c)"
                class="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                :class="statutDe(c)!.classe"
              >{{ statutDe(c)!.label }}</span>
            </div>
          </div>

          <p class="mt-4 text-sm text-gray-500">{{ c.unites }} unités, {{ c.formations }} formations, {{ c.options }} options</p>

          <div class="mt-4 flex flex-wrap gap-2 text-sm">
            <NuxtLink
              :to="`/builder/${c.slug}`"
              class="rounded-lg bg-gold px-3 py-1.5 font-semibold text-surface transition hover:bg-gold-light"
            >
              Construire
            </NuxtLink>
            <button
              type="button"
              class="rounded-lg border border-gold/50 px-3 py-1.5 text-gold transition hover:bg-gold/10"
              @click="apercu = { slug: c.slug, nom: c.nom }"
            >
              Voir le PDF
            </button>
          </div>
        </article>
      </div>

      <p v-if="!chargement && !visibles.length" class="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-400">
        Aucun codex ne correspond à cette recherche.
      </p>

      <!-- Listes de soutien : jamais jouées seules, proposées en alliance -->
      <section v-if="soutiens.length" class="mt-16">
        <h2 class="text-2xl font-bold text-gray-100 md:text-3xl">Listes de soutien</h2>
        <p class="mt-1 text-sm text-gray-500">
          Écrites une fois, proposées en alliance dans les codex qui y ont droit (un tiers des points en général).
        </p>
        <div class="mt-3 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

        <div class="mt-6 grid gap-3 sm:grid-cols-2">
          <div
            v-for="c in soutiens"
            :key="c.slug"
            class="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.06] px-5 py-4 backdrop-blur-md"
          >
            <div class="min-w-0">
              <p class="font-heading text-lg text-gray-100">{{ c.nom }}</p>
              <p class="text-xs text-gray-500">{{ c.unites }} unités, {{ c.formations }} formations</p>
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg border border-gold/50 px-3 py-1.5 text-sm text-gold transition hover:bg-gold/10"
              @click="apercu = { slug: c.slug, nom: c.nom }"
            >
              Voir le PDF
            </button>
          </div>
        </div>
      </section>

      <CodexVisionneusePdf v-if="apercu" v-model="apercuOuvert" :slug="apercu.slug" :nom="apercu.nom" />
    </div>
  </div>
</template>

<style scoped>
.army-icon {
  background-color: rgb(var(--c-blanc) / 0.8);
  mask-image: var(--icon-url);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-image: var(--icon-url);
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  transition: background-color 0.3s;
}

.group:hover .army-icon {
  background-color: rgb(var(--c-gold));
}
</style>
