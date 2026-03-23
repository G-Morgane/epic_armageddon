<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const { data: armies30k } = await useFetch<ArmyWithVersion[]>('/api/armies', {
  query: { status: '30k' },
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-t from-red-900/15 via-surface to-surface" />
    <EmberParticles palette="chaos" />

    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Epic 30k — Horus Hérésie</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Epic 30k</h1>
        <p class="mt-1 text-lg text-gray-500 sm:text-xl">Horus Hérésie</p>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

        <div class="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-gray-400">
          <p>
            L'équipe d'EA-FR a développé un ensemble de listes d'armées vous permettant de jouer au temps de l'Hérésie d'Horus.
          </p>
          <p>
            Ces listes d'armées utilisent le même système de règles que les livres d'armées 40k et sont compatibles avec eux. Cependant, mélanger des listes de différentes époques est déconseillé pour des raisons d'équilibre.
          </p>
        </div>
      </div>

      <!-- Army list -->
      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div v-if="!armies30k?.length" class="py-20 text-center text-gray-500">
          Aucune liste disponible.
        </div>

        <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <a
            v-for="army in armies30k"
            :key="army.id"
            :href="army.army_versions?.[0]?.pdf_url"
            target="_blank"
            rel="noopener"
            class="group flex items-center gap-4 rounded-xl border border-red-500/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-all hover:border-red-500/25 hover:bg-white/[0.07]"
          >
            <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-red-500/20 bg-red-500/5">
              <span class="font-heading text-xl text-red-400/50">{{ army.name[0] }}</span>
            </div>
            <div class="flex-1">
              <p class="font-semibold text-gray-200 transition-colors group-hover:text-red-400">
                {{ army.name }}
              </p>
              <p class="text-xs text-gray-500">
                REV {{ army.army_versions?.[0]?.version }}
              </p>
            </div>
            <svg class="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
