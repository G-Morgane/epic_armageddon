<script setup lang="ts">
import type { Changement } from '~~/shared/codex/changements'
import type { OngletCodex } from '~~/shared/codex/problemes'

const props = defineProps<{ changements: Changement[]; version?: string }>()
const emit = defineEmits<{ aller: [onglet: OngletCodex] }>()

const fermes = ref(new Set<string>())
function basculer(cle: string) {
  const s = new Set(fermes.value)
  if (s.has(cle)) s.delete(cle)
  else s.add(cle)
  fermes.value = s
}

const total = computed(() => ({
  ajouts: props.changements.reduce((n, c) => n + c.ajouts, 0),
  suppressions: props.changements.reduce((n, c) => n + c.suppressions, 0),
}))

const STATUTS = {
  ajoute: { l: 'Ajouté', c: 'border-emerald-400/30 text-emerald-300' },
  modifie: { l: 'Modifié', c: 'border-amber-400/30 text-amber-300' },
  supprime: { l: 'Supprimé', c: 'border-red-400/30 text-red-300' },
} as const
</script>

<template>
  <div class="rounded-lg border border-gold/10 bg-surface-light">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gold/10 px-5 py-3">
      <div>
        <h3 class="font-heading text-base font-semibold text-gold">Changements <span class="text-sm font-normal text-gray-500">({{ changements.length }})</span></h3>
        <p class="text-xs text-gray-500">Ce que le brouillon modifie par rapport {{ version ? `à la v${version} publiée` : 'au codex de départ' }}. À relire avant de publier.</p>
      </div>
      <p v-if="changements.length" class="font-mono text-sm"><span class="text-emerald-300">+{{ total.ajouts }}</span> <span class="text-red-300">−{{ total.suppressions }}</span></p>
    </div>

    <p v-if="!changements.length" class="px-5 py-10 text-center text-sm text-gray-500">Aucun changement depuis la version publiée.</p>

    <div v-for="c in changements" :key="c.cle" class="border-t border-white/5">
      <div class="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-2 hover:bg-white/[.02]" @click="basculer(c.cle)">
        <span class="w-3 text-xs text-gray-500">{{ fermes.has(c.cle) ? '▸' : '▾' }}</span>
        <span class="rounded border px-2 py-0.5 text-[11px] uppercase tracking-wider" :class="STATUTS[c.statut].c">{{ STATUTS[c.statut].l }}</span>
        <span class="text-xs uppercase tracking-wider text-gray-500">{{ c.libelle }}</span>
        <span class="font-medium text-gray-100">{{ c.nom }}</span>
        <span class="ml-auto font-mono text-xs"><span class="text-emerald-300">+{{ c.ajouts }}</span> <span class="text-red-300">−{{ c.suppressions }}</span></span>
        <button type="button" class="text-xs text-gold hover:underline" @click.stop="emit('aller', c.onglet)">Ouvrir l'onglet</button>
      </div>
      <div v-if="!fermes.has(c.cle)" class="overflow-x-auto border-t border-white/5 bg-surface font-mono text-xs leading-5">
        <div
          v-for="(l, i) in c.lignes"
          :key="i"
          class="flex whitespace-pre"
          :class="{ 'bg-emerald-500/10 text-emerald-200': l.type === '+', 'bg-red-500/10 text-red-200': l.type === '-', 'text-gray-400': l.type === ' ', 'bg-white/[.03] text-gray-600': l.type === '@' }"
        >
          <span class="w-6 shrink-0 select-none text-center opacity-70">{{ l.type === '@' ? '' : l.type }}</span>
          <span class="pr-4">{{ l.type === '@' ? '…' : l.texte }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
