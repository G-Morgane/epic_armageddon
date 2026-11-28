<script setup lang="ts">
/**
 * Listes d'armée publiques (toute liste partagée l'est), avec le pseudo de leur auteur.
 * La section entière disparaît tant qu'aucune liste n'est publique : le titre passe par le slot.
 */
import type { CodexMeta } from '~/utils/codex-armee'
import type { ListePublique } from '~/utils/listes-publiques'

const props = withDefaults(defineProps<{ nombre?: number }>(), { nombre: 12 })

const { data: listes } = await useFetch<ListePublique[]>('/api/listes/publiques', { query: { nombre: props.nombre }, lazy: true, server: false, default: () => [] })
const { data: tousCodex } = await useFetch<CodexMeta[]>('/api/codex', { lazy: true, server: false })
const nomCodex = (slug: string) => (tousCodex.value ?? []).find(c => c.slug === slug)?.nom ?? slug
</script>

<template>
  <section v-if="listes.length">
    <slot name="titre" />

    <div class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <CarteListePublique v-for="l in listes" :key="l.code_partage" :liste="l" :nom-codex="nomCodex(l.codex)" />
    </div>

    <div class="mt-6 text-center">
      <NuxtLink to="/listes" class="inline-flex items-center gap-2 rounded-lg border border-gold/30 px-5 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10">
        Voir toutes les listes des joueurs →
      </NuxtLink>
    </div>
  </section>
</template>
