<script setup lang="ts">
import type { Contrainte } from '~~/shared/codex/schema'
import { GABARITS, gabaritDe, nouvelleContrainte, segments, type Gabarit } from '~~/shared/codex/regles'

/**
 * Règles en phrases à trous. Édite le tableau de contraintes en place.
 */
const props = defineProps<{
  contraintes: Contrainte[]
  portee: 'formation' | 'option' | 'section'
  compact?: boolean
}>()

const codex = useBrouillonCodex()
const gabarits = computed(() => GABARITS.filter((g) => g.portee.includes(props.portee)))
const budgets = computed(() => codex.value.budgets ?? [])
const unites = computed(() => codex.value.unites ?? [])
const options = computed(() => codex.value.options ?? [])

function ajouter(type: string) {
  const g = gabaritDe(type)
  if (!g) return
  const c = nouvelleContrainte(g) as Record<string, unknown>
  if (g.trous.budget && !c.budget) c.budget = budgets.value[0]?.id ?? ''
  props.contraintes.push(c as Contrainte)
}
function retirer(i: number) {
  props.contraintes.splice(i, 1)
}
function gab(c: Contrainte): Gabarit | undefined {
  return gabaritDe(c.type)
}
function valeur(c: Contrainte, k: string): unknown {
  return (c as unknown as Record<string, unknown>)[k]
}
function set(c: Contrainte, k: string, v: unknown) {
  ;(c as unknown as Record<string, unknown>)[k] = v
}
function toggleListe(c: Contrainte, k: string, id: string) {
  const arr = [...((valeur(c, k) as string[]) ?? [])]
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
  set(c, k, arr)
}
</script>

<template>
  <div class="space-y-1.5">
    <div v-for="(c, i) in contraintes" :key="i" class="flex flex-wrap items-center gap-1.5 rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-200">
      <template v-if="gab(c)">
        <template v-for="(seg, si) in segments(gab(c)!)" :key="si">
          <span v-if="'texte' in seg">{{ seg.texte }}</span>
          <template v-else>
            <input v-if="gab(c)!.trous[seg.trou]?.type === 'nombre'" type="number" min="0" class="trou w-14" :value="valeur(c, seg.trou)" @input="set(c, seg.trou, parseInt(($event.target as HTMLInputElement).value || '0', 10))">
            <input v-else-if="gab(c)!.trous[seg.trou]?.type === 'texte'" type="text" class="trou w-24" :value="valeur(c, seg.trou)" @input="set(c, seg.trou, ($event.target as HTMLInputElement).value)">
            <select v-else-if="gab(c)!.trous[seg.trou]?.type === 'budget'" class="trou" :value="Array.isArray(valeur(c, seg.trou)) ? (valeur(c, seg.trou) as string[])[0] : valeur(c, seg.trou)" @change="set(c, seg.trou, ($event.target as HTMLSelectElement).value)">
              <option v-for="b in budgets" :key="b.id" :value="b.id">{{ b.libelle }}</option>
            </select>
            <label v-else-if="gab(c)!.trous[seg.trou]?.type === 'bool'" class="ml-1 inline-flex items-center gap-1 text-xs text-gray-400">
              <input type="checkbox" :checked="!!valeur(c, seg.trou)" @change="set(c, seg.trou, ($event.target as HTMLInputElement).checked)"> multiplié par la taille
            </label>
            <details v-else-if="gab(c)!.trous[seg.trou]?.type === 'unites'" class="relative inline-block">
              <summary class="trou cursor-pointer list-none">{{ ((valeur(c, seg.trou) as string[]) ?? []).map((id) => unites.find((u) => u.id === id)?.nom ?? id).join(', ') || 'choisir…' }}</summary>
              <div class="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded border border-white/10 bg-surface-lighter p-2 shadow-xl">
                <label v-for="u in unites" :key="u.id" class="flex items-center gap-2 py-0.5 text-xs"><input type="checkbox" :checked="((valeur(c, seg.trou) as string[]) ?? []).includes(u.id)" @change="toggleListe(c, seg.trou, u.id)">{{ u.nom }}</label>
              </div>
            </details>
            <details v-else-if="gab(c)!.trous[seg.trou]?.type === 'options'" class="relative inline-block">
              <summary class="trou cursor-pointer list-none">{{ ((valeur(c, seg.trou) as string[]) ?? []).map((id) => options.find((o) => o.id === id)?.nom ?? id).join(', ') || 'choisir…' }}</summary>
              <div class="absolute z-20 mt-1 max-h-56 w-64 overflow-auto rounded border border-white/10 bg-surface-lighter p-2 shadow-xl">
                <label v-for="o in options" :key="o.id" class="flex items-center gap-2 py-0.5 text-xs"><input type="checkbox" :checked="((valeur(c, seg.trou) as string[]) ?? []).includes(o.id)" @change="toggleListe(c, seg.trou, o.id)">{{ o.nom }}</label>
              </div>
            </details>
          </template>
        </template>
      </template>
      <span v-else class="text-gray-400">{{ c.type }}</span>
      <button type="button" class="ml-auto text-gray-500 hover:text-red-300" title="Retirer" @click="retirer(i)">✕</button>
    </div>
    <select class="w-full rounded-md border border-dashed border-gold/30 bg-transparent px-3 py-1.5 text-sm text-gold" :value="''" @change="ajouter(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
      <option value="">+ Ajouter une règle…</option>
      <option v-for="g in gabarits" :key="g.type" :value="g.type">{{ g.phrase.replace(/\{(\w+)\}/g, '…') }}</option>
    </select>
  </div>
</template>

<style scoped>
.trou { @apply rounded border-b-2 border-gold/70 bg-gold/10 px-1.5 py-0.5 text-sm font-semibold text-gold-light focus:outline-none; }
</style>
