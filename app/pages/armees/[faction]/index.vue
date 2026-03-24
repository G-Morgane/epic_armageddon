<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const route = useRoute()
const faction = computed(() => route.params.faction as string)

const factionConfig: Record<string, { label: string; subtitle: string; gradient: string; particles: 'fire' | 'chaos' | 'xenos'; bg?: string; glow: string }> = {
  imperium: {
    label: 'Armées de l\'Imperium',
    subtitle: 'Les forces loyalistes de l\'Empereur de l\'Humanité',
    gradient: 'from-yellow-900/30 via-surface to-surface',
    particles: 'fire',
    bg: '/images/bg-imperium.jpg',
    glow: 'radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)',
  },
  chaos: {
    label: 'Armées du Chaos',
    subtitle: 'Les hordes corrompues des Dieux Sombres',
    gradient: 'from-red-900/30 via-surface to-surface',
    particles: 'chaos',
    bg: '/images/bg-chaos.jpg',
    glow: 'none',
  },
  xenos: {
    label: 'Armées Xenos',
    subtitle: 'Les races extraterrestres qui menacent la galaxie',
    gradient: 'from-emerald-900/30 via-surface to-surface',
    particles: 'xenos',
    bg: '/images/bg-xenos.jpg',
    glow: 'none',
  },
}

const config = computed(() => factionConfig[faction.value] ?? factionConfig.imperium)

const { data: armies, status } = await useFetch<ArmyWithVersion[]>('/api/armies', {
  query: { faction },
})

const search = ref('')

const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

function isNew(army: ArmyWithVersion) {
  const version = army.army_versions?.[0]
  if (!version) return false
  return new Date(version.published_at) > threeMonthsAgo
}

const filteredArmies = computed(() => {
  if (!armies.value) return []
  if (!search.value) return armies.value
  const q = search.value.toLowerCase()
  return armies.value.filter(a => a.name.toLowerCase().includes(q))
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background image (bottom-aligned) -->
    <div v-if="config.bg" class="absolute inset-0">
      <img :src="config.bg" alt="" class="h-full w-full object-contain object-bottom opacity-50" />
      <div :class="[
        'absolute inset-0 bg-gradient-to-b',
        faction === 'imperium' ? 'from-surface/40 via-transparent to-transparent' : 'from-surface via-surface/70 to-transparent'
      ]" />
      <!-- Side fades to hide image edges -->
      <div class="absolute inset-0 bg-gradient-to-r from-surface/60 via-transparent to-surface/60" />
    </div>

    <!-- Background gradient + particles (full page) -->
    <div :class="['absolute inset-0 bg-gradient-to-t', config.gradient]" />
    <div class="absolute inset-0" :style="{ background: config.glow }" />
    <EmberParticles :palette="config.particles" />

    <!-- Content -->
    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <!-- Breadcrumb -->
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">{{ config.label }}</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">{{ config.label }}</h1>
        <p class="mt-2 text-base text-gray-400 sm:mt-3 sm:text-lg">{{ config.subtitle }}</p>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

      </div>

      <!-- Army grid -->
      <section class="mx-auto max-w-6xl px-4 pb-20">
      <!-- Loading -->
      <div v-if="status === 'pending'" class="py-20 text-center text-gray-400">
        Chargement...
      </div>

      <!-- Empty -->
      <div v-else-if="!filteredArmies.length" class="py-20 text-center text-gray-400">
        {{ search ? 'Aucune armée trouvée.' : 'Aucune armée disponible pour le moment.' }}
      </div>

      <div v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
        <NuxtLink
          v-for="army in filteredArmies"
          :key="army.id"
          :to="`/armees/${faction}/${army.id}`"
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
</style>
