<script setup lang="ts">
import type { Army, ArmyVersion, ArmyTag } from '~/types/database'
import { codexDeArmee, type CodexMeta, type PublicationCodex } from '~/utils/codex-armee'

useSeoMeta({
  title: 'Livres d\'Armées',
  description: 'Tous les codex officiels Epic Armageddon FR — Imperium, Chaos et Xenos. Téléchargez les listes d\'armées en PDF.',
  ogTitle: 'Livres d\'Armées — Epic Armageddon FR',
  ogDescription: 'Tous les codex officiels — Imperium, Chaos et Xenos.',
  ogUrl: 'https://www.epicarmageddon.fr/armees',
})

type ArmyWithVersion = Army & { army_versions: ArmyVersion[]; tags: ArmyTag[] }

// Les trois factions viennent du même appel : la route ne filtre que par `faction`,
// et trois requêtes identiques à une clause près coûtent trois allers-retours pour rien.
// `lazy` : le rendu serveur attend toujours les données, mais une navigation
// depuis le site ouvre la page tout de suite et la grille se remplit ensuite.
const [{ data: toutesArmees, status }, { data: allTags }, { data: tousCodex }, { data: publications }] = await Promise.all([
  useFetch<ArmyWithVersion[]>('/api/armies', { lazy: true }),
  useFetch<ArmyTag[]>('/api/army-tags', { lazy: true }),
  useFetch<CodexMeta[]>('/api/codex', { lazy: true }),
  useFetch<PublicationCodex[]>('/api/codex/publications', { lazy: true }),
])

const chargement = computed(() => status.value === 'pending' || status.value === 'idle')

const armeesParFaction = computed(() => {
  const parFaction = new Map<string, ArmyWithVersion[]>()
  for (const a of toutesArmees.value ?? []) {
    const l = parFaction.get(a.faction) ?? []
    l.push(a)
    parFaction.set(a.faction, l)
  }
  return parFaction
})

/**
 * Favoris du membre connecté : chargés dans le navigateur, jamais au rendu
 * serveur, parce qu'ils dépendent de qui regarde.
 *
 * Une armée mise en favori depuis la bêta ou les archives n'est pas dans
 * `/api/armies`, qui ne sert que les officielles : on retombe alors sur ce que
 * le favori porte lui-même, quitte à afficher la carte sans sa REV.
 */
const { favoris, init: initFavoris } = useFavoris()
onMounted(() => { initFavoris() })

const armeesParId = computed(() => new Map((toutesArmees.value ?? []).map(a => [a.id, a])))
const armeesFavorites = computed(() => (favoris.value ?? []).map(f => armeesParId.value.get(f.army_id) ?? ({
  id: f.army_id,
  name: f.nom,
  faction: f.faction,
  cover_image: f.cover_image,
  army_versions: [],
  tags: [],
} as unknown as ArmyWithVersion)))

const sections = computed(() => [
  ...(armeesFavorites.value.length
    ? [{
        label: 'Mes favoris',
        subtitle: 'Les codex que tu as mis de côté',
        faction: 'favoris',
        armies: armeesFavorites.value,
        accent: 'gold',
      }]
    : []),
  {
    label: 'Armées de l\'Imperium',
    subtitle: 'Les forces loyalistes de l\'Empereur de l\'Humanité',
    faction: 'imperium',
    armies: armeesParFaction.value.get('imperium') ?? [],
    accent: 'gold',
  },
  {
    label: 'Armées du Chaos',
    subtitle: 'Les hordes corrompues des Dieux Sombres',
    faction: 'chaos',
    armies: armeesParFaction.value.get('chaos') ?? [],
    accent: 'red-400',
  },
  {
    label: 'Armées Xenos',
    subtitle: 'Les races extraterrestres qui menacent la galaxie',
    faction: 'xenos',
    armies: armeesParFaction.value.get('xenos') ?? [],
    accent: 'emerald-400',
  },
])

const activeTagByFaction = ref<Record<string, string | null>>({
  imperium: null,
  chaos: null,
  xenos: null,
})

function tagsForFaction(faction: string) {
  return (allTags.value ?? []).filter(t => t.faction === faction)
}

function filteredArmies(armies: ArmyWithVersion[], faction: string) {
  const tag = activeTagByFaction.value[faction]
  if (!tag) return armies
  return armies.filter(a => a.tags?.some(t => t.id === tag))
}

const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

const publicationParSlug = computed(() => new Map((publications.value ?? []).map(p => [p.slug, p])))

/**
 * Dernière nouveauté d'une armée : PDF déposé à la main, ou REV du codex dynamique.
 * Les deux systèmes cohabitent et ne partagent aucune date, il faut lire les deux.
 *
 * La transcription d'un codex existant est mise de côté : sa première REV ne dit
 * rien de nouveau aux joueurs, elle ne fait que passer en dynamique un contenu
 * déjà publié en PDF, en gardant son numéro. Le compteur ne s'ouvre qu'à la
 * deuxième REV publiée, quel que soit le numéro qu'elle porte.
 */
function derniereNouveaute(army: ArmyWithVersion) {
  const dates = (army.army_versions ?? []).map(v => v.published_at).filter(Boolean)
  const codex = codexDeArmee(tousCodex.value, army.id, army.name)
  const publication = codex ? publicationParSlug.value.get(codex.slug) : undefined
  if (publication && publication.revs > 1) dates.push(publication.publie)
  return dates.sort((a, b) => +new Date(b) - +new Date(a))[0]
}

function isNew(army: ArmyWithVersion) {
  const date = derniereNouveaute(army)
  return !!date && new Date(date) > threeMonthsAgo
}
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/20 via-surface to-surface" />
    <div class="absolute inset-0" style="background: radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)" />
    <EmberParticles />

    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-12 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Livres d'Armées</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Livres d'Armées</h1>
        <p class="mt-2 text-base text-gray-400 sm:mt-3 sm:text-lg">Tous les codex officiels de la communauté EA-FR</p>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />
      </div>

      <!-- Sections par faction -->
      <div class="mx-auto max-w-6xl space-y-16 px-4 pb-32">
        <section v-for="section in sections" :key="section.faction">
          <!-- Faction header -->
          <div>
            <h2 class="flex items-center gap-2 text-2xl font-bold text-gray-100 md:text-3xl">
              <svg v-if="section.faction === 'favoris'" class="h-6 w-6 shrink-0 text-gold md:h-7 md:w-7" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.48 3.5a.56.56 0 011.04 0l2.13 4.32 4.77.69c.46.07.64.63.31.95l-3.45 3.36.81 4.75c.08.46-.4.81-.81.59L12 15.9l-4.27 2.25c-.41.22-.89-.13-.81-.59l.81-4.75-3.45-3.36a.56.56 0 01.31-.95l4.77-.69L11.48 3.5z" />
              </svg>
              {{ section.label }}
            </h2>
            <p class="mt-1 text-sm text-gray-500">{{ section.subtitle }}</p>
            <div class="mt-3 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />
          </div>

          <!-- Tag filters -->
          <!-- Les compteurs de chaque filtre se lisent dans les armées : tant
               qu'elles ne sont pas là, la barre afficherait des zéros. -->
          <div v-if="!chargement && tagsForFaction(section.faction).length" class="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div class="inline-flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 backdrop-blur-sm">
              <button
                :class="[
                  'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:px-5 sm:text-sm',
                  !activeTagByFaction[section.faction]
                    ? 'bg-gold/15 text-gold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200',
                ]"
                @click="activeTagByFaction[section.faction] = null"
              >
                Tous
                <span class="ml-1 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] sm:ml-1.5 sm:px-2 sm:text-xs">
                  {{ section.armies.length }}
                </span>
              </button>
              <button
                v-for="tag in tagsForFaction(section.faction)"
                :key="tag.id"
                :class="[
                  'shrink-0 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:px-5 sm:text-sm',
                  activeTagByFaction[section.faction] === tag.id
                    ? 'bg-gold/15 text-gold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200',
                ]"
                @click="activeTagByFaction[section.faction] = tag.id"
              >
                {{ tag.name }}
                <span class="ml-1 rounded-full bg-gold/10 px-1.5 py-0.5 text-[10px] sm:ml-1.5 sm:px-2 sm:text-xs">
                  {{ section.armies.filter(a => a.tags?.some(t => t.id === tag.id)).length }}
                </span>
              </button>
            </div>
          </div>

          <!-- Grid -->
          <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
            <!-- Cartes fantômes le temps de l'aller-retour : la page garde sa
                 forme au lieu de montrer trois titres au-dessus du vide. -->
            <div
              v-for="n in (chargement ? 10 : 0)"
              :key="`fantome-${n}`"
              class="flex animate-pulse flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.06] p-3 backdrop-blur-md sm:gap-4 sm:p-5"
              aria-hidden="true"
            >
              <div class="h-16 w-16 rounded-full bg-white/10 sm:h-24 sm:w-24" />
              <div class="h-4 w-20 rounded bg-white/10 sm:w-24" />
              <div class="h-3 w-12 rounded bg-white/5" />
            </div>
            <NuxtLink
              v-for="army in filteredArmies(section.armies, section.faction)"
              :key="army.id"
              :to="`/armees/${army.faction}/${army.id}`"
              class="group relative flex flex-col items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.06] p-3 text-center backdrop-blur-md transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.1] hover:shadow-[0_8px_32px_rgba(200,160,82,0.08)] sm:gap-4 sm:p-5"
            >
              <!-- New badge -->
              <span
                v-if="isNew(army)"
                class="absolute -right-1 -top-1 z-10 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-surface"
              >
                New
              </span>

              <!-- Icon container -->
              <div class="relative flex h-16 w-16 items-center justify-center sm:h-24 sm:w-24">
                <div
                  v-if="army.cover_image"
                  class="army-icon h-20 w-20 transition-all duration-300 sm:h-28 sm:w-28"
                  :style="{ '--icon-url': `url(${army.cover_image})` }"
                />
                <span
                  v-else
                  class="font-heading text-3xl text-gold/20 transition-colors duration-300 group-hover:text-gold/50"
                >
                  {{ army.name[0] }}
                </span>
              </div>

              <!-- Name & version -->
              <div>
                <p class="text-sm font-semibold text-gray-200 transition-colors group-hover:text-gold sm:text-base">
                  {{ army.name }}
                </p>
                <p v-if="army.army_versions?.length" class="mt-1 text-xs text-gray-500">
                  (REV {{ army.army_versions[0].version }})
                </p>
              </div>
            </NuxtLink>
          </div>
        </section>
      </div>
    </div>

    <!-- Battle image behind content, anchored to bottom -->
    <div class="absolute inset-x-0 bottom-0 z-0">
      <img src="/images/bg-imperium.jpg" alt="" class="battle-img w-full object-contain object-bottom" />
    </div>
  </div>
</template>

<style scoped>
.army-icon {
  background-color: rgba(255, 255, 255, 0.8);
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
  background-color: #c8a052;
}

.battle-img {
  mask-image:
    linear-gradient(to bottom, transparent 0%, black 50%, black 60%, transparent 100%),
    linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%);
  mask-composite: intersect;
  -webkit-mask-image:
    linear-gradient(to bottom, transparent 0%, black 50%, black 60%, transparent 100%),
    linear-gradient(to right, transparent 0%, black 25%, black 75%, transparent 100%);
  -webkit-mask-composite: source-in;
  opacity: 0.4;
}
</style>
