<script setup lang="ts">
/** Profil d'une unité : stats, armes, notes, transport, dégâts. `compact` : version dense pour le catalogue. */
import type { Unite } from '~~/shared/codex/schema'
import type { IndexCodex } from '~~/shared/codex/engine'

const props = defineProps<{ idx: IndexCodex; unite: Unite; nombre?: number; compact?: boolean }>()
const u = computed(() => props.unite)
const degats = computed(() => u.value.degats ? `CD ${u.value.degats.cd}${u.value.degats.bi !== undefined ? ` · BI ${u.value.degats.bi}` : ''}` : '')
/** la capacité de transport est souvent déjà écrite dans les notes : ne pas la répéter */
const transportRedondant = computed(() => u.value.notes.some((n) => /transport/i.test(n)))
</script>

<template>
  <article class="rounded-lg border border-white/10" :class="compact ? 'bg-black/20' : 'bg-surface-light'">
    <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-white/5" :class="compact ? 'px-3 py-1.5' : 'px-4 py-2'">
      <h3 class="font-heading font-semibold text-white" :class="compact ? 'text-sm' : 'text-base'">
        <span v-if="nombre" class="text-gold">{{ nombre }} ×</span> {{ u.nom }}
      </h3>
      <span class="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-stone-400">{{ u.type }}</span>
      <dl class="ml-auto flex gap-3 text-[11px]">
        <div><dt class="inline text-stone-500">Vit </dt><dd class="inline text-stone-100">{{ u.vitesse ?? '-' }}</dd></div>
        <div><dt class="inline text-stone-500">Bl </dt><dd class="inline text-stone-100">{{ u.blindage ?? '-' }}</dd></div>
        <div><dt class="inline text-stone-500">CC </dt><dd class="inline text-stone-100">{{ u.cc ?? '-' }}</dd></div>
        <div><dt class="inline text-stone-500">FF </dt><dd class="inline text-stone-100">{{ u.ff ?? '-' }}</dd></div>
      </dl>
    </div>
    <table v-if="u.armes.length" class="w-full text-[11px]">
      <tbody>
        <tr v-for="(a, ai) in u.armes" :key="ai" class="border-t border-white/5 align-top">
          <td class="py-1 text-stone-100" :class="compact ? 'px-3' : 'px-4'">{{ a.nom }}</td>
          <td class="py-1 pr-2 whitespace-nowrap text-stone-400">{{ a.portee ?? '-' }}</td>
          <td class="py-1 text-stone-300" :class="compact ? 'pr-3' : 'pr-4'">{{ a.puissance ?? '-' }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="u.notes.length || u.degats || (u.transport && !transportRedondant)" class="space-y-0.5 border-t border-white/5 py-1.5 text-[11px] text-stone-300" :class="compact ? 'px-3' : 'px-4'">
      <p v-if="u.notes.length"><span class="text-stone-500">Notes : </span>{{ u.notes.join(', ') }}</p>
      <p v-if="u.transport && !transportRedondant"><span class="text-stone-500">Transport : </span>{{ u.transport.capacite }} place{{ u.transport.capacite > 1 ? 's' : '' }}<template v-if="u.transport.accepte.length"> ({{ u.transport.accepte.map((id) => idx.unites.get(id)?.nom ?? id).join(', ') }})</template></p>
      <p v-if="u.degats"><span class="text-stone-500">Dégâts : </span>{{ degats }}<template v-if="u.degats.critique"> <span class="text-stone-500">· Critique : </span>{{ u.degats.critique }}</template></p>
    </div>
  </article>
</template>
