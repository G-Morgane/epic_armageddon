<script setup lang="ts">
/**
 * Listes d'armée publiques (toute liste partagée l'est), avec le pseudo de leur auteur.
 * La section entière disparaît tant qu'aucune liste n'est publique : le titre passe par le slot.
 */
import type { CodexMeta } from '~/utils/codex-armee'

interface ListePublique {
  code_partage: string
  codex: string
  nom: string
  limite: number
  total: number | null
  updated_at: string
  pseudo: string | null
}

const { data: listes } = await useFetch<ListePublique[]>('/api/listes/publiques', { lazy: true, server: false, default: () => [] })
const { data: tousCodex } = await useFetch<CodexMeta[]>('/api/codex', { lazy: true, server: false })
const nomCodex = (slug: string) => (tousCodex.value ?? []).find(c => c.slug === slug)?.nom ?? slug

const date = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <section v-if="listes.length">
    <slot name="titre" />

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="l in listes"
        :key="l.code_partage"
        :to="`/builder/${l.codex}?liste=${l.code_partage}`"
        class="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm transition-all duration-300 hover:border-gold/20 hover:bg-white/[0.07]"
      >
        <span class="self-start rounded bg-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold">{{ nomCodex(l.codex) }}</span>
        <p class="mt-3 font-heading text-lg font-semibold text-gray-100 transition-colors group-hover:text-gold">{{ l.nom }}</p>
        <p class="mt-1 text-sm text-gray-400">par {{ l.pseudo || 'un joueur anonyme' }}</p>
        <p class="mt-auto pt-4 text-xs text-gray-500">
          <template v-if="l.total !== null">{{ l.total }} / {{ l.limite }} pts · </template>{{ date(l.updated_at) }}
        </p>
      </NuxtLink>
    </div>
  </section>
</template>
