<script setup lang="ts">
interface Tool {
  id: string
  name: string
  description: string | null
  url: string
  button_label: string
  sort_order: number
}

const { data: tools } = await useFetch<Tool[]>('/api/tools')
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <!-- Background -->
    <div class="absolute inset-0 bg-gradient-to-t from-yellow-900/15 via-surface to-surface" />
    <div class="absolute inset-0" style="background: radial-gradient(ellipse at top left, rgba(200,160,82,0.08) 0%, transparent 60%)" />
    <EmberParticles />

    <div class="relative z-10">
      <!-- Header -->
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Outils</span>
        </nav>

        <h1 class="text-4xl font-bold md:text-6xl">Outils</h1>
        <div class="mt-4 h-1 w-96 rounded-full bg-gradient-to-r from-gold to-transparent" />

        <p class="mt-8 max-w-3xl text-base leading-relaxed text-gray-400">
          Des outils développés par la communauté pour faciliter vos parties d'Epic Armageddon.
        </p>
      </div>

      <!-- Tools -->
      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div class="grid gap-8 md:grid-cols-2">
          <div
            v-for="tool in tools"
            :key="tool.id"
            class="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] backdrop-blur-sm"
          >
            <div class="p-8">
              <h3 class="text-xl font-semibold text-gray-100">{{ tool.name }}</h3>

              <p v-if="tool.description" class="mt-3 text-sm leading-relaxed text-gray-400">
                {{ tool.description }}
              </p>

              <a
                :href="tool.url"
                target="_blank"
                rel="noopener"
                class="mt-6 inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
              >
                {{ tool.button_label }}
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
