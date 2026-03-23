<script setup lang="ts">
import type { GameEvent } from '~/types/database'

const { data: events, status } = await useFetch<GameEvent[]>('/api/events')
const { data: allEvents } = await useFetch<GameEvent[]>('/api/events/all')

const upcomingEvents = computed(() => events.value?.slice(0, 3) ?? [])

// Group all events by year for timeline
const eventsByYear = computed(() => {
  if (!allEvents.value) return []
  const groups: Record<string, GameEvent[]> = {}
  for (const event of allEvents.value) {
    const year = new Date(event.event_date).getFullYear().toString()
    if (!groups[year]) groups[year] = []
    groups[year].push(event)
  }
  return Object.entries(groups).sort(([a], [b]) => Number(b) - Number(a))
})

const today = new Date().toISOString().split('T')[0]

function isPast(date: string) {
  return date < today
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatDateRange(start: string, end: string | null) {
  if (!end || end === start) return formatDate(start)
  const s = new Date(start)
  const e = new Date(end)
  // Same month and year: "26-29 mars 2026"
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return `${s.getDate()}-${e.getDate()} ${s.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`
  }
  return `${formatDate(start)} — ${formatDate(end)}`
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
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
          <span class="text-gray-300">Événements</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Événements</h1>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

        <p class="mt-6 max-w-3xl text-base leading-relaxed text-gray-400">
          La communauté EA-FR est particulièrement active en France et à l'international avec l'organisation de nombreux tournois et événements. Vous trouverez ici toutes les rencontres Epic Armageddon. Pour plus de détails, rendez-vous sur notre <a href="https://discord.com/invite/3ukn8Cumc5" target="_blank" rel="noopener" class="text-gold underline underline-offset-2 hover:text-gold-light">Discord</a>.
        </p>
      </div>

      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div v-if="status === 'pending'" class="py-20 text-center text-gray-400">
          Chargement...
        </div>

        <template v-else>
          <!-- Upcoming events (top 3) -->
          <section v-if="upcomingEvents.length">
            <h2 class="text-2xl font-bold text-gray-100 md:text-3xl">À venir</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <div class="mt-8 grid gap-6 md:grid-cols-3">
              <div
                v-for="event in upcomingEvents"
                :key="event.id"
                class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] backdrop-blur-sm transition-all hover:border-gold/20"
              >
                <!-- Date header -->
                <div class="border-b border-white/5 bg-gold/5 px-5 py-4">
                  <p class="text-lg font-bold text-gold">
                    {{ formatDateRange(event.event_date, event.event_end_date) }}
                  </p>
                </div>

                <!-- Content -->
                <div class="p-5">
                  <h3 class="text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">
                    {{ event.title }}
                  </h3>
                  <p v-if="event.description" class="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-400">
                    {{ event.description }}
                  </p>

                  <div class="mt-4 space-y-2">
                    <div v-if="event.address" class="flex items-start gap-2 text-sm text-gray-500">
                      <svg class="mt-0.5 h-4 w-4 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                      {{ event.address }}
                    </div>
                    <div v-if="event.contact" class="flex items-center gap-2 text-sm text-gray-500">
                      <svg class="h-4 w-4 shrink-0 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                      {{ event.contact }}
                    </div>
                  </div>

                  <a
                    v-if="event.external_link"
                    :href="event.external_link"
                    target="_blank"
                    rel="noopener"
                    class="mt-4 inline-flex items-center gap-2 text-sm text-gold hover:text-gold-light"
                  >
                    Voir les détails
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </section>

          <!-- Timeline -->
          <section v-if="eventsByYear.length" class="mt-20">
            <h2 class="text-2xl font-bold text-gray-100 md:text-3xl">Historique</h2>
            <div class="mt-2 h-0.5 w-32 rounded-full bg-gradient-to-r from-gold to-transparent" />

            <div class="mt-10">
              <div v-for="([year, yearEvents]) in eventsByYear" :key="year" class="mb-16">
                <!-- Year marker -->
                <div class="mb-8 flex items-center justify-center gap-4">
                  <div class="h-px flex-1 bg-gold/10" />
                  <span class="font-heading text-3xl font-bold text-gold/60">{{ year }}</span>
                  <div class="h-px flex-1 bg-gold/10" />
                </div>

                <!-- Timeline zigzag -->
                <div class="relative">
                  <!-- Center line (hidden on mobile) -->
                  <div class="absolute left-4 top-0 bottom-0 w-px bg-gold/15 md:left-1/2 md:-translate-x-1/2" />

                  <div
                    v-for="(event, idx) in yearEvents"
                    :key="event.id"
                    class="relative mb-8 flex last:mb-0"
                    :class="idx % 2 === 0 ? 'justify-start md:justify-start' : 'justify-start md:justify-end'"
                  >
                    <!-- Dot on center line -->
                    <div
                      :class="[
                        'absolute left-4 top-6 h-3 w-3 -translate-x-1/2 rounded-full border-2 md:left-1/2',
                        isPast(event.event_date)
                          ? 'border-gray-600 bg-gray-700'
                          : 'border-gold bg-gold/30',
                      ]"
                    />

                    <!-- Card -->
                    <div
                      :class="[
                        'ml-8 w-full rounded-xl border p-4 transition-all md:ml-0 md:w-[calc(50%-2rem)] md:p-5',
                        isPast(event.event_date)
                          ? 'border-white/5 bg-white/[0.02]'
                          : 'border-gold/10 bg-white/[0.04]',
                      ]"
                    >
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3
                            :class="[
                              'text-base font-semibold',
                              isPast(event.event_date) ? 'text-gray-300' : 'text-gray-100',
                            ]"
                          >
                            {{ event.title }}
                          </h3>
                          <p class="mt-1 text-xs" :class="isPast(event.event_date) ? 'text-gray-500' : 'text-gold/70'">
                            {{ formatDateRange(event.event_date, event.event_end_date) }}
                          </p>
                        </div>
                        <span
                          v-if="!isPast(event.event_date)"
                          class="shrink-0 rounded-full bg-gold/10 px-2 py-0.5 text-xs font-semibold text-gold"
                        >
                          À venir
                        </span>
                      </div>

                      <p
                        v-if="event.description"
                        :class="[
                          'mt-2 text-sm leading-relaxed',
                          isPast(event.event_date) ? 'text-gray-400' : 'text-gray-400',
                        ]"
                      >
                        {{ event.description }}
                      </p>

                      <div class="mt-2 flex flex-wrap items-center gap-3">
                        <div v-if="event.address" class="flex items-center gap-1.5 text-xs" :class="isPast(event.event_date) ? 'text-gray-500' : 'text-gray-500'">
                          <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          {{ event.address }}
                        </div>
                        <div v-if="event.contact" class="flex items-center gap-1.5 text-xs" :class="isPast(event.event_date) ? 'text-gray-500' : 'text-gray-500'">
                          <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                          </svg>
                          {{ event.contact }}
                        </div>
                        <a
                          v-if="event.external_link"
                          :href="event.external_link"
                          target="_blank"
                          rel="noopener"
                          class="flex items-center gap-1.5 text-xs text-gold hover:text-gold-light"
                        >
                          <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          Lien externe
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Empty state -->
          <div v-if="!upcomingEvents.length && !eventsByYear.length" class="py-20 text-center text-gray-500">
            Aucun événement pour le moment.
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
