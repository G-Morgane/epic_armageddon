<script setup lang="ts">
interface Document {
  id: string
  title: string
  description: string | null
  version: string | null
  pdf_url: string
  sort_order: number
  created_at: string
}

const { data: documents } = await useFetch<Document[]>('/api/documents')
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
          <span class="text-gray-300">Règles & FAQ</span>
        </nav>

        <h1 class="text-4xl font-bold md:text-6xl">Règles & FAQ</h1>
        <div class="mt-4 h-1 w-96 rounded-full bg-gradient-to-r from-gold to-transparent" />

        <div class="mt-8 max-w-3xl space-y-4 text-sm leading-relaxed text-gray-400">
          <p>
            Les règles officielles amendées par EA-FR.
          </p>
          <p>
            Depuis 2003, le système de règles d'Epic Armageddon se caractérise par sa très grande stabilité. Quelle que soit la communauté, les règles originales étaient tellement bien conçues qu'elles n'ont subi que peu de modifications. Des années de pratique de tournois et de dialogue intercommunautaires ont permis d'améliorer la lisibilité et d'éclaircir certaines zones d'ombres par le biais de FAQ détaillées.
          </p>
          <p>
            Le Livre de Règles en est aujourd'hui à sa 3ème révision et une 4ème est en cours de rédaction. La FAQ millésime 2022 est désormais disponible et remplace la FAQ du Livre de Règles.
          </p>
        </div>
      </div>

      <!-- Documents -->
      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div class="grid gap-6 md:grid-cols-3">
          <a
            v-for="doc in documents"
            :key="doc.id"
            :href="doc.pdf_url"
            target="_blank"
            rel="noopener"
            class="group overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04] p-6 backdrop-blur-sm transition-all hover:border-gold/20 hover:bg-white/[0.07]"
          >
            <div class="flex items-start gap-4">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/10">
                <svg class="h-6 w-6 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">
                  {{ doc.title }}
                </h3>
                <span v-if="doc.version" class="mt-1 inline-block rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold">
                  {{ doc.version }}
                </span>
              </div>
            </div>

            <p v-if="doc.description" class="mt-4 text-sm leading-relaxed text-gray-400">
              {{ doc.description }}
            </p>

            <div class="mt-4 flex items-center gap-2 text-sm text-gold opacity-0 transition-opacity group-hover:opacity-100">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Télécharger le PDF
            </div>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
