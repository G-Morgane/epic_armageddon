<script setup lang="ts">
/**
 * Champ de recherche de l'app : même dessin partout (site public et admin),
 * la largeur seule reste à la charge de l'appelant, via une classe sur le composant.
 */
defineProps<{
  placeholder: string
  /** Intitulé lu par les lecteurs d'écran, le champ n'ayant pas d'étiquette visible. */
  label: string
}>()

const valeur = defineModel<string>({ required: true })
</script>

<template>
  <label class="relative block">
    <span class="sr-only">{{ label }}</span>
    <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
    <input
      v-model="valeur"
      type="search"
      :placeholder="placeholder"
      class="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-gray-200 placeholder:text-gray-500 focus:border-gold/40 focus:outline-none"
    >
  </label>
</template>
