<script setup lang="ts">
import type { Army, ArmyVersion, GameEvent } from '~/types/database'

type RecentVersion = ArmyVersion & { armies: Army }

const { data: recentVersions } = await useFetch<RecentVersion[]>('/api/armies/recent')
const { data: upcomingEvents } = await useFetch<GameEvent[]>('/api/events')

const nextEvents = computed(() => (upcomingEvents.value ?? []).slice(0, 3))

function formatDateRange(start: string, end: string | null) {
  const s = new Date(start)
  const formatFull = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  if (!end || end === start) return formatFull(s)
  const e = new Date(end)
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}-${e.getDate()} ${s.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
  }
  return `${formatFull(s)} — ${formatFull(e)}`
}

const startSteps = [
  {
    title: 'Découvrir les Règles',
    description: 'Le corpus de règles de base originelles amendées par l\'équipe EA-FR.',
    to: '/regles',
    icon: 'rules',
  },
  {
    title: 'Choisir son Armée',
    description: 'L\'ensemble des listes jouables pour Epic Armageddon 40k / 30k.',
    to: '/armees/imperium',
    icon: 'army',
  },
  {
    title: 'Trouver des joueurs',
    description: 'La communauté d\'EA grandit chaque jour en France. Découvrez comment trouver des joueurs IRL ou sur TTS via notre Discord.',
    to: '/communaute',
    icon: 'players',
  },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="relative h-[75vh] overflow-hidden">
      <!-- Background image -->
      <div class="absolute inset-0">
        <img
          src="/images/hero-bg.jpg"
          alt=""
          class="h-full w-full object-cover"
        >
        <!-- Dark overlay -->
        <div class="absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/60 to-transparent" />
        <div class="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-surface/40" />
      </div>

      <!-- Particles -->
      <div class="absolute inset-0 z-[5]">
        <EmberParticles />
      </div>

      <!-- Content panel - left side -->
      <div class="relative z-10 flex h-[75vh] items-center px-6 md:px-16 lg:px-24">
        <div class="max-w-2xl lg:max-w-3xl xl:max-w-4xl">
          <h1 class="hero-title text-4xl font-bold sm:text-5xl md:text-7xl lg:text-8xl">
            Epic<br>Armageddon
          </h1>

          <div class="my-6 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:my-8 md:w-96" />

          <!-- Text panel -->
          <div class="relative -ml-4 border border-l-0 border-gold/20 bg-surface/15 p-4 pl-8 backdrop-blur-xl sm:-ml-6 sm:p-6 sm:pl-12 md:-ml-16 md:p-8 md:pl-20 lg:-ml-24 lg:pl-28">
            <p class="mb-4 text-sm font-semibold uppercase tracking-widest text-gold/80">
              Bienvenue sur le site officiel d'EA-FR
            </p>
            <div class="space-y-4 text-sm leading-relaxed text-gray-300 md:text-base">
              <p>
                En 2003, Games Workshop sortait Epic Armageddon, la 4ème version du système Epic en 6mm. Ce jeu de bataille à grande échelle permet aux joueurs d'aligner de formidables armées alliant infanterie, chars, aviation et même les terribles Titans.
              </p>
              <p>
                Bien que le jeu ne soit plus officiellement soutenu par Games Workshop depuis 2011, la communauté internationale – dont la communauté francophone – reste très active et continue de faire vivre le jeu au travers de l'organisation de tournois, l'accueil et l'initiation de nouveaux joueurs grâce à Discord, de mise à jour et création de listes ainsi que de clarification des règles.
              </p>
              <p>
                Par ailleurs plusieurs fabricants de proxies en 6mm comme <a href="https://vanguardminiatures.co.uk/" target="_blank" rel="noopener" class="text-gold hover:text-gold-light underline underline-offset-2">Vanguard Miniatures</a> ou encore <a href="https://www.onslaughtmini.com/" target="_blank" rel="noopener" class="text-gold hover:text-gold-light underline underline-offset-2">Onslaught Miniatures</a> se sont lancés dans l'aventure du 6mm afin de combler les modèles désormais OOP. Les avancées de l'impression 3D permettent aujourd'hui de réaliser des armées toujours plus belles et précises pour un moindre coût !
              </p>
              <p>
                Vous trouverez sur ce site tout le matériel de jeu nécessaire pour vous lancer dans l'aventure d'Epic Armageddon.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom fade -->
      <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-surface to-transparent" />
    </section>

    <!-- Nouveautés -->
    <section v-if="recentVersions?.length" class="mx-auto max-w-6xl px-4 py-10">
      <h2 class="text-3xl font-bold md:text-4xl">Nouveautés</h2>
      <p class="mt-2 text-gray-400">Les dernières mises à jour de codex</p>
      <div class="mt-3 h-1 w-40 rounded-full bg-gradient-to-r from-gold to-transparent md:w-64" />

      <div class="mt-8 grid gap-4 sm:gap-6 md:mt-10 md:grid-cols-3">
        <NuxtLink
          v-for="rv in recentVersions"
          :key="rv.id"
          :to="`/armees/${rv.armies.faction}/${rv.armies.id}`"
          class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.07]"
        >
          <!-- Icon + faction badge -->
          <div class="flex items-center gap-4 border-b border-white/5 p-5">
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
              <div
                v-if="rv.armies.cover_image"
                class="recent-icon h-9 w-9"
                :style="{ '--icon-url': `url(${rv.armies.cover_image})` }"
              />
              <span v-else class="font-heading text-xl text-gold/30">{{ rv.armies.name[0] }}</span>
            </div>
            <div>
              <p class="font-semibold text-gray-200 transition-colors group-hover:text-gold">
                {{ rv.armies.name }}
              </p>
              <p class="text-xs capitalize text-gray-500">{{ rv.armies.faction }}</p>
            </div>
          </div>

          <!-- Version info -->
          <div class="p-5">
            <div class="flex items-center gap-3">
              <span class="rounded bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold">
                REV {{ rv.version }}
              </span>
              <span class="text-xs text-gray-500">
                {{ new Date(rv.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) }}
              </span>
            </div>
            <p v-if="rv.changelog" class="mt-3 text-sm text-gray-400">{{ rv.changelog }}</p>

            <div class="mt-4 flex items-center gap-2 text-sm text-gold opacity-0 transition-opacity group-hover:opacity-100">
              <span>Voir le codex</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Upcoming events -->
    <section v-if="nextEvents.length" class="mx-auto max-w-6xl px-4 py-10">
      <h2 class="text-3xl font-bold md:text-4xl">Événements à venir</h2>
      <p class="mt-2 text-gray-400">Les prochaines rencontres de la communauté</p>
      <div class="mt-3 h-1 w-40 rounded-full bg-gradient-to-r from-gold to-transparent md:w-64" />

      <div class="mt-8 grid gap-4 sm:gap-6 md:mt-10 md:grid-cols-3">
        <NuxtLink
          v-for="event in nextEvents"
          :key="event.id"
          to="/evenements"
          class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.07]"
        >
          <!-- Date header -->
          <div class="border-b border-white/5 bg-gold/5 px-5 py-4">
            <p class="text-lg font-bold text-gold">
              {{ formatDateRange(event.event_date, event.event_end_date) }}
            </p>
          </div>

          <div class="p-5">
            <h3 class="text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">
              {{ event.title }}
            </h3>
            <p v-if="event.description" class="mt-2 line-clamp-2 text-sm text-gray-400">
              {{ event.description }}
            </p>
            <div v-if="event.address" class="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <svg class="h-4 w-4 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              {{ event.address }}
            </div>
          </div>
        </NuxtLink>
      </div>

    </section>

    <!-- Commencer à jouer -->
    <section class="mx-auto max-w-6xl px-4 py-10">
      <h2 class="text-3xl font-bold md:text-4xl">Commencer à jouer !</h2>
      <div class="mt-3 h-1 w-40 rounded-full bg-gradient-to-r from-gold to-transparent md:w-64" />

      <div class="mt-8 grid gap-6 md:mt-10 md:grid-cols-3">
        <NuxtLink
          v-for="step in startSteps"
          :key="step.title"
          :to="step.to"
          class="group flex flex-col items-center text-center"
        >
          <!-- Icon -->
          <div class="flex h-20 w-20 items-center justify-center rounded-full border border-gold/20 bg-white/[0.04] transition-all duration-300 group-hover:border-gold/40 group-hover:bg-white/[0.08]">
            <!-- Rules -->
            <svg v-if="step.icon === 'rules'" class="h-10 w-10 text-gray-300 transition-colors group-hover:text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <!-- Army -->
            <svg v-else-if="step.icon === 'army'" class="h-10 w-10 text-gray-300 transition-colors group-hover:text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <!-- Players -->
            <svg v-else class="h-10 w-10 text-gray-300 transition-colors group-hover:text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          </div>

          <h3 class="mt-5 text-xl font-semibold text-gray-100 transition-colors group-hover:text-gold">
            {{ step.title }}
          </h3>
          <p class="mt-2 text-sm leading-relaxed text-gray-400">
            {{ step.description }}
          </p>
        </NuxtLink>
      </div>

    </section>

    <!-- Battle banner -->
    <section class="relative h-[30vh] overflow-hidden sm:h-[40vh]">
      <div class="absolute inset-0">
        <img
          src="/images/banner-battle.png"
          alt=""
          class="h-full w-full object-cover object-bottom"
        >
        <!-- Heavy top fade -->
        <div class="absolute inset-0 bg-gradient-to-b from-surface via-surface/70 via-30% to-transparent" />
        <!-- Heavy bottom fade into footer -->
        <div class="absolute inset-0 bg-gradient-to-t from-surface-light via-surface-light/80 via-25% to-transparent" />
        <!-- Overall darken -->
        <div class="absolute inset-0 bg-surface/40" />
      </div>
      <div class="absolute inset-0 z-[5]">
        <EmberParticles palette="fire" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.recent-icon {
  background-color: rgba(255, 255, 255, 0.8);
  mask-image: var(--icon-url);
  mask-size: contain;
  mask-repeat: no-repeat;
  mask-position: center;
  -webkit-mask-image: var(--icon-url);
  -webkit-mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
}

.group:hover .recent-icon {
  background-color: #c8a052;
}

.hero-title {
  text-shadow:
    0 0 20px rgba(200, 160, 82, 0.5),
    0 0 60px rgba(200, 160, 82, 0.2),
    0 0 100px rgba(200, 160, 82, 0.1);
}

</style>
