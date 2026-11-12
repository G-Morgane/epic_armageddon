<script setup lang="ts">
/** Carte d'une liste publique : codex, nom, auteur, points et date. Un clic l'ouvre dans le builder, en lecture. */
import type { ListePublique } from '~/utils/listes-publiques'

defineProps<{ liste: ListePublique; nomCodex: string }>()

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <NuxtLink
    :to="`/builder/${liste.codex}?liste=${liste.code_partage}`"
    class="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.07]"
  >
    <span class="self-start rounded bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">{{ nomCodex }}</span>
    <p class="mt-3 font-heading text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">{{ liste.nom }}</p>
    <p class="mt-1 text-sm text-gray-400">par {{ liste.pseudo || 'un joueur anonyme' }}</p>
    <p class="mt-auto pt-4 text-xs text-gray-500">
      <template v-if="liste.total !== null">{{ liste.total }} / {{ liste.limite }} pts · </template>{{ date(liste.updated_at) }}
    </p>
  </NuxtLink>
</template>
