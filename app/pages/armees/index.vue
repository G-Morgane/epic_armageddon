<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

useSeoMeta({
  title: 'Livres d\'Armées',
  description: 'Tous les codex officiels Epic Armageddon FR — Imperium, Chaos et Xenos. Téléchargez les listes d\'armées en PDF.',
  ogTitle: 'Livres d\'Armées — Epic Armageddon FR',
  ogDescription: 'Tous les codex officiels — Imperium, Chaos et Xenos.',
  ogUrl: 'https://www.epicarmageddon.fr/armees',
})

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const [{ data: imperiumArmies }, { data: chaosArmies }, { data: xenosArmies }] = await Promise.all([
  useFetch<ArmyWithVersion[]>('/api/armies', { query: { faction: 'imperium' } }),
  useFetch<ArmyWithVersion[]>('/api/armies', { query: { faction: 'chaos' } }),
  useFetch<ArmyWithVersion[]>('/api/armies', { query: { faction: 'xenos' } }),
])

const sections = computed(() => [
  {
    label: 'Armées de l\'Imperium',
    subtitle: 'Les forces loyalistes de l\'Empereur de l\'Humanité',
    faction: 'imperium',
    armies: imperiumArmies.value ?? [],
    accent: 'gold',
  },
  {
    label: 'Armées du Chaos',
    subtitle: 'Les hordes corrompues des Dieux Sombres',
    faction: 'chaos',
    armies: chaosArmies.value ?? [],
    accent: 'red-400',
  },
  {
    label: 'Armées Xenos',
    subtitle: 'Les races extraterrestres qui menacent la galaxie',
    faction: 'xenos',
    armies: xenosArmies.value ?? [],
    accent: 'emerald-400',
  },
])

const threeMonthsAgo = new Date()
threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

function isNew(army: ArmyWithVersion) {
  const version = army.army_versions?.[0]
  if (!version) return false
  return new Date(version.published_at) > threeMonthsAgo
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
            <h2 class="text-2xl font-bold text-gray-100 md:text-3xl">{{ section.label }}</h2>
            <p class="mt-1 text-sm text-gray-500">{{ section.subtitle }}</p>
            <div class="mt-3 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />
          </div>

          <!-- Grid -->
          <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 md:grid-cols-4 lg:grid-cols-5">
            <NuxtLink
              v-for="army in section.armies"
              :key="army.id"
              :to="`/armees/${section.faction}/${army.id}`"
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
