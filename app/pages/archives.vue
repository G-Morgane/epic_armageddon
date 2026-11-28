<script setup lang="ts">
const urlSite = useUrlSite()

useSeoMeta({
  title: 'Archives',
  description: 'Les documents d\'origine d\'Epic Armageddon et les suppléments publiés par Games Workshop, classés par année.',
  ogTitle: 'Archives — Epic Armageddon FR',
  ogDescription: 'Documents d\'origine du jeu et suppléments Games Workshop.',
  ogUrl: urlSite('/archives'),
})

interface Archive {
  id: string
  title: string
  description: string | null
  annee: number
  pdf_url: string
}

const { data: archives, status } = await useFetch<Archive[]>('/api/archives', { lazy: true })
const chargement = computed(() => status.value === 'pending' || status.value === 'idle')

/** Une rubrique par année, de la plus ancienne à la plus récente. */
const parAnnee = computed(() => {
  const groupes = new Map<number, Archive[]>()
  for (const a of archives.value ?? []) {
    if (!groupes.has(a.annee)) groupes.set(a.annee, [])
    groupes.get(a.annee)!.push(a)
  }
  return [...groupes.entries()].sort((a, b) => a[0] - b[0]).map(([annee, docs]) => ({ annee, docs }))
})
</script>

<template>
  <div class="relative min-h-screen overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-t from-stone-800/20 via-surface to-surface" />
    <EmberParticles />

    <div class="relative z-10">
      <div class="mx-auto max-w-6xl px-4 pb-16 pt-20">
        <nav class="mb-8 text-sm text-gray-500">
          <NuxtLink to="/" class="hover:text-gold">Accueil</NuxtLink>
          <span class="mx-2">/</span>
          <span class="text-gray-300">Archives</span>
        </nav>

        <h1 class="text-3xl font-bold sm:text-4xl md:text-6xl">Archives</h1>
        <div class="mt-4 h-1 w-48 rounded-full bg-gradient-to-r from-gold to-transparent md:w-96" />

        <div class="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-gray-400">
          <p>
            Les documents d'origine du jeu et les différents suppléments publiés par Games Workshop, classés par année de publication.
          </p>
        </div>
      </div>

      <div class="mx-auto max-w-6xl px-4 pb-20">
        <div v-if="chargement && !archives?.length" class="py-20 text-center text-gray-500">Chargement…</div>
        <div v-else-if="!parAnnee.length" class="py-20 text-center text-gray-500">Aucun document pour l'instant.</div>

        <section v-for="groupe in parAnnee" :key="groupe.annee" class="mb-10">
          <h2 class="mb-4 font-heading text-2xl font-bold text-gold">{{ groupe.annee }}</h2>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <a
              v-for="doc in groupe.docs"
              :key="doc.id"
              :href="doc.pdf_url"
              target="_blank"
              rel="noopener"
              class="group flex items-start gap-4 rounded-xl border border-white/5 bg-white/[0.04] p-5 backdrop-blur-sm transition-all hover:border-gold/20 hover:bg-white/[0.07]"
            >
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-gray-200 transition-colors group-hover:text-gold">{{ doc.title }}</p>
                <p v-if="doc.description" class="mt-1 text-sm leading-relaxed text-gray-500">{{ doc.description }}</p>
              </div>
              <svg class="mt-1 h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
            </a>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
