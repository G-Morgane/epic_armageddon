<script setup lang="ts">
/**
 * Annuaire des listes d'armée publiques : toute liste partagée y figure, avec le
 * pseudo de son auteur. Recherche sur le nom de la liste ou le pseudo, filtres
 * par faction et par codex, 24 listes par page.
 */
import type { CodexMeta } from '~/utils/codex-armee'
import type { ListePublique } from '~/utils/listes-publiques'

const urlSite = useUrlSite()
useSeoMeta({
  title: 'Listes des joueurs',
  description: 'Les listes d\'armée Epic Armageddon partagées par la communauté : cherche par armée ou par joueur, et ouvre-les dans le builder.',
  ogTitle: 'Listes des joueurs, Epic Armageddon FR',
  ogDescription: 'Les listes d\'armée partagées par la communauté.',
  ogUrl: urlSite('/listes'),
})

const FACTIONS = [
  { cle: 'imperium', label: 'Imperium' },
  { cle: 'chaos', label: 'Chaos' },
  { cle: 'xenos', label: 'Xenos' },
]

const route = useRoute()
const recherche = ref(typeof route.query.q === 'string' ? route.query.q : '')
const texte = ref(recherche.value)
const faction = ref<string | null>(null)
const codexChoisi = ref('')
const page = ref(1)

// la recherche part quand on arrête de taper, pas à chaque lettre
let minuteur: ReturnType<typeof setTimeout> | undefined
watch(recherche, (v) => {
  clearTimeout(minuteur)
  minuteur = setTimeout(() => { texte.value = v.trim(); page.value = 1 }, 300)
})
watch([faction, codexChoisi], () => { page.value = 1 })
watch(faction, () => { codexChoisi.value = '' })

const { data: tousCodex } = await useFetch<CodexMeta[]>('/api/codex', { lazy: true })
const codexJouables = computed(() => (tousCodex.value ?? []).filter((c) => c.type !== 'soutien'))
const codexDeFaction = computed(() => codexJouables.value.filter((c) => !faction.value || c.faction === faction.value).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
const nomCodex = (slug: string) => (tousCodex.value ?? []).find((c) => c.slug === slug)?.nom ?? slug

const filtreCodex = computed(() => {
  if (codexChoisi.value) return codexChoisi.value
  if (faction.value) return codexDeFaction.value.map((c) => c.slug).join(',') || '-'
  return ''
})

// Chargé dans le navigateur, à chaque changement de filtre ou de page. Seule la
// dernière réponse compte : une recherche lente ne doit pas écraser la suivante.
const listes = ref<ListePublique[]>([])
const total = ref(0)
const parPage = ref(24)
const chargement = ref(true)
let demande = 0
async function charger() {
  const n = ++demande
  chargement.value = true
  try {
    const r = await $fetch<{ listes: ListePublique[]; total: number; parPage: number }>('/api/listes/annuaire', {
      query: { q: texte.value || undefined, codex: filtreCodex.value || undefined, page: page.value },
    })
    if (n !== demande) return
    listes.value = r.listes
    total.value = r.total
    parPage.value = r.parPage
  } catch {
    if (n === demande) { listes.value = []; total.value = 0 }
  } finally {
    if (n === demande) chargement.value = false
  }
}
onMounted(charger)
watch([texte, filtreCodex, page], charger)
const pages = computed(() => Math.max(1, Math.ceil(total.value / parPage.value)))

function allerPage(p: number) {
  page.value = p
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
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
        <span class="text-gray-300">Listes des joueurs</span>
      </nav>

      <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Listes des joueurs</h1>
      <p class="mt-2 max-w-2xl text-base text-gray-400 sm:mt-3 sm:text-lg">
        Les armées partagées par la communauté. Ouvre une liste pour la voir dans le builder, et enregistre-la pour en faire ta propre version.
      </p>
      <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

      <p class="mt-5 text-sm text-gray-400">
        Pour ajouter la tienne : dans le builder, <span class="text-gray-200">Actions › Rendre publique et partager</span>.
        <NuxtLink to="/codex" class="underline hover:text-gold">Construire une armée</NuxtLink>
      </p>

      <!-- Filtres -->
      <div class="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center">
        <BarreRecherche
          v-model="recherche"
          class="lg:w-72"
          placeholder="Nom de liste ou pseudo…"
          label="Rechercher une liste ou un joueur"
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
            </button>
          </div>
        </div>

        <select
          v-model="codexChoisi"
          aria-label="Filtrer par armée"
          class="rounded-xl border border-white/10 bg-surface-light px-4 py-2.5 text-sm text-gray-200 focus:border-gold/40 focus:outline-none lg:w-64"
        >
          <option value="">Toutes les armées</option>
          <option v-for="c in codexDeFaction" :key="c.slug" :value="c.slug">{{ c.nom }}</option>
        </select>
      </div>

      <p v-if="!chargement" class="mt-6 text-sm text-gray-500">
        {{ total }} liste{{ total > 1 ? 's' : '' }} publique{{ total > 1 ? 's' : '' }}
      </p>

      <!-- Grille -->
      <div v-if="chargement && !listes.length" class="mt-4 text-sm text-gray-500">Chargement…</div>
      <div v-else-if="listes.length" class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CarteListePublique v-for="l in listes" :key="l.code_partage" :liste="l" :nom-codex="nomCodex(l.codex)" />
      </div>
      <div v-else class="mt-6 rounded-2xl border border-white/5 bg-white/[0.03] p-8 text-center text-gray-400">
        Aucune liste ne correspond à cette recherche.
      </div>

      <!-- Pages -->
      <div v-if="pages > 1" class="mt-8 flex items-center justify-center gap-3 text-sm">
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-2 text-gray-300 transition-colors hover:border-gold/30 hover:text-gold disabled:opacity-40"
          :disabled="page <= 1"
          @click="allerPage(page - 1)"
        >
          ← Précédentes
        </button>
        <span class="text-gray-500">Page {{ page }} / {{ pages }}</span>
        <button
          type="button"
          class="rounded-lg border border-white/10 px-4 py-2 text-gray-300 transition-colors hover:border-gold/30 hover:text-gold disabled:opacity-40"
          :disabled="page >= pages"
          @click="allerPage(page + 1)"
        >
          Suivantes →
        </button>
      </div>
    </div>
  </div>
</template>
