<script setup lang="ts">
useHead({ title: 'Codex unifiés (test)' })
const { data: codex } = await useFetch('/api/codex')
const factions: Record<string, string> = { imperium: 'Imperium', chaos: 'Chaos', xenos: 'Xenos' }
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <p class="font-heading text-sm uppercase tracking-widest text-gold">Test du modèle unifié</p>
    <h1 class="mt-2 font-heading text-4xl font-bold text-white">Codex : une fiche, deux sorties</h1>
    <p class="mt-3 max-w-2xl font-body text-lg text-stone-300">
      Chaque armée ci-dessous est décrite une seule fois dans un fichier. Le PDF et le builder en découlent.
    </p>

    <div class="mt-8 grid gap-4 sm:grid-cols-2">
      <div v-for="c in codex" :key="c.slug" class="rounded-lg border border-white/10 bg-surface-light p-5">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wider text-stone-400">{{ factions[c.faction] ?? c.faction }} · v{{ c.version }}</p>
            <h2 class="mt-1 font-heading text-2xl font-semibold text-white">{{ c.nom }}</h2>
          </div>
          <span class="mt-1 h-4 w-4 shrink-0 rounded-full border border-white/20" :style="{ background: c.couleur }" />
        </div>
        <p class="mt-3 text-sm text-stone-400">{{ c.unites }} unités · {{ c.formations }} formations · {{ c.options }} options</p>
        <div class="mt-4 flex flex-wrap gap-2 text-sm">
          <NuxtLink :to="`/codex-test/${c.slug}/imprimer`" class="rounded border border-gold/60 px-3 py-1.5 text-gold hover:bg-gold/10">Aperçu PDF</NuxtLink>
          <a :href="`/api/codex/${c.slug}/pdf`" class="rounded border border-white/20 px-3 py-1.5 text-stone-200 hover:bg-white/5">Télécharger le PDF</a>
          <NuxtLink :to="`/builder/${c.slug}`" class="rounded bg-gold px-3 py-1.5 font-semibold text-surface hover:bg-gold-light">Builder</NuxtLink>
          <a :href="`/api/codex/${c.slug}.json`" class="rounded px-3 py-1.5 text-stone-400 hover:text-white">JSON</a>
        </div>
      </div>
    </div>
  </div>
</template>
