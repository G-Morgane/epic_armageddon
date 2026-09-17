<script setup lang="ts">
import type { IndexCodex, FormationResolue } from '~~/shared/codex/engine'
import { optionsDisponibles, bornesOption, plafondRepartition } from '~~/shared/codex/engine'
import type { FormationInstance } from '~~/shared/codex/liste'
import { genererId } from '~~/shared/codex/liste'
import { phraseOption, coutOption, pluriel } from '~~/shared/codex/phrases'

const props = defineProps<{
  idx: IndexCodex
  instance: FormationInstance
  resolue?: FormationResolue
  sous?: boolean
}>()
const emit = defineEmits<{ supprimer: []; dupliquer: [] }>()

const def = computed(() => props.idx.formations.get(props.instance.formation))
const variante = computed(() => def.value?.variantes.find((v) => v.id === props.instance.variante) ?? def.value?.variantes[0])
const nomU = (id: string) => props.idx.unites.get(id)?.nom ?? id
const dispo = computed(() => (def.value ? optionsDisponibles(props.idx, def.value).map((o) => props.idx.options.get(o)!).filter(Boolean) : []))
const specSous = computed(() => variante.value?.sous_formations ?? def.value?.sous_formations)
const erreursIci = computed(() => props.resolue?.erreurs.filter((e) => e.formation === props.instance.id) ?? [])

function changerVariante(id: string) {
  props.instance.variante = id
  props.instance.choix = {}
}
function setChoix(ligne: number, unite: string, val: string) {
  let n = Math.max(0, parseInt(val || '0', 10) || 0)
  if (!props.instance.choix[String(ligne)]) props.instance.choix[String(ligne)] = {}
  const l = variante.value?.composition[ligne]
  if (l && 'choix' in l) {
    const max = typeof l.choix.total === 'number' ? l.choix.total : l.choix.total.max
    const autres = Object.entries(props.instance.choix[String(ligne)]!).filter(([u]) => u !== unite).reduce((s, [, q]) => s + q, 0)
    n = Math.min(n, Math.max(0, max - autres))
  }
  props.instance.choix[String(ligne)]![unite] = n
}
function ajouterOption(id: string) {
  if (!id) return
  const o = props.idx.options.get(id)
  if (!o) return
  const inst: FormationInstance['options'][number] = { id: genererId('o'), option: id }
  if (o.effet.type === 'ajouter' && o.effet.cout_par_unite !== undefined) inst.quantite = o.effet.min ?? 1
  if (o.effet.type === 'ajouter' && o.effet.variantes?.length) inst.variante = o.effet.variantes[0]!.id ?? o.effet.variantes[0]!.nom
  if (o.effet.type === 'choix') inst.choix = o.effet.parmi[0]!.id
  if (o.effet.type === 'choix_multiple') inst.repartition = {}
  if (o.effet.type === 'remplacer' && !o.effet.tout && o.effet.max !== 'tout') inst.quantite = 1
  props.instance.options.push(inst)
}
function retirerOption(id: string) {
  props.instance.options = props.instance.options.filter((o) => o.id !== id)
}
function effetDe(oi: FormationInstance['options'][number]) {
  const o = props.idx.options.get(oi.option)
  if (!o) return undefined
  if (o.effet.type === 'choix') return o.effet.parmi.find((p) => p.id === oi.choix)?.effet
  return o.effet
}
function setRepartition(oi: FormationInstance['options'][number], unite: string, val: string) {
  if (!oi.repartition) oi.repartition = {}
  let n = Math.max(0, parseInt(val || '0', 10) || 0)
  const plafond = props.resolue ? plafondRepartition(props.idx, props.resolue, oi, unite) : null
  if (plafond !== null) n = Math.min(n, plafond)
  oi.repartition[unite] = n
}
function bornes(oi: FormationInstance['options'][number]) {
  return props.resolue ? bornesOption(props.idx, props.resolue, oi) : { min: 1, max: null }
}
function setQuantite(oi: FormationInstance['options'][number], val: string) {
  const b = bornes(oi)
  let n = parseInt(val || '0', 10) || b.min
  n = Math.max(b.min, n)
  if (b.max !== null) n = Math.min(b.max, n)
  oi.quantite = n
}
function plafond(oi: FormationInstance['options'][number], unite: string) {
  return props.resolue ? plafondRepartition(props.idx, props.resolue, oi, unite) : null
}
function ajouterSous(fid: string) {
  if (!fid) return
  const f = props.idx.formations.get(fid)
  if (!f) return
  props.instance.sous_formations.push({ id: genererId('f'), formation: fid, variante: f.variantes[0]!.id, choix: {}, options: [], sous_formations: [] })
}
function retirerSous(id: string) {
  props.instance.sous_formations = props.instance.sous_formations.filter((s) => s.id !== id)
}
const unitesVisibles = computed(() => props.resolue?.unites.filter((u) => !u.implicite) ?? [])
</script>

<template>
  <div v-if="def && variante" class="rounded-lg border bg-surface-light" :class="[sous ? 'border-white/10' : 'border-white/15', erreursIci.length ? 'ring-1 ring-red-500/60' : '']">
    <div class="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
      <div class="min-w-0">
        <p class="text-[11px] uppercase tracking-wider text-stone-500">{{ resolue?.section.titre }}</p>
        <h3 class="font-heading text-lg font-semibold text-white">{{ def.nom }}</h3>
        <select v-if="def.variantes.length > 1" :value="instance.variante" class="champ mt-1" @change="changerVariante(($event.target as HTMLSelectElement).value)">
          <option v-for="v in def.variantes" :key="v.id" :value="v.id">{{ v.nom ?? v.id }} · {{ v.cout }} pts</option>
        </select>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="font-heading text-xl text-gold">{{ resolue?.cout ?? variante.cout }} <span class="text-xs text-stone-400">pts</span></span>
        <button v-if="!sous" type="button" class="bouton-ghost" title="Dupliquer" @click="emit('dupliquer')">⧉</button>
        <button type="button" class="bouton-ghost text-red-300" title="Retirer" @click="emit('supprimer')">✕</button>
      </div>
    </div>

    <div class="space-y-3 px-4 py-3 text-sm">
      <!-- choix de composition -->
      <template v-for="(l, li) in variante.composition" :key="li">
        <div v-if="'choix' in l" class="rounded border border-white/10 bg-black/20 p-3">
          <p class="mb-2 text-xs text-stone-400">
            Choisir {{ typeof l.choix.total === 'number' ? l.choix.total : `${l.choix.total.min} à ${l.choix.total.max}` }}
            <template v-if="l.choix.parmi.some((p) => p.par_pioche > 1)"> (par lot)</template> :
          </p>
          <div class="flex flex-wrap gap-3">
            <label v-for="p in l.choix.parmi" :key="p.unite" class="flex items-center gap-2">
              <input type="number" min="0" class="champ w-16" :value="instance.choix[String(li)]?.[p.unite] ?? 0" @input="setChoix(li, p.unite, ($event.target as HTMLInputElement).value)">
              <span>{{ p.par_pioche > 1 ? `${p.par_pioche} ` : '' }}{{ nomU(p.unite) }}<span v-if="p.cout" class="text-stone-400"> · {{ p.cout }} pts</span></span>
            </label>
          </div>
        </div>
      </template>

      <!-- unités résolues -->
      <p v-if="unitesVisibles.length" class="text-stone-300">
        <span v-for="(u, ui) in unitesVisibles" :key="ui">{{ ui ? ', ' : '' }}<span :class="u.origine === 'base' || u.origine === 'choix' ? '' : 'text-gold-light'">{{ u.nombre }} {{ u.nombre > 1 ? pluriel(u.nom) : u.nom }}</span></span>
        <span v-if="resolue?.mots_cles.length" class="text-stone-400"> · {{ resolue.mots_cles.join(', ') }}</span>
      </p>

      <!-- options -->
      <div v-if="dispo.length" class="space-y-2">
        <div v-for="oi in instance.options" :key="oi.id" class="flex flex-wrap items-center gap-2 rounded border border-white/10 bg-black/20 px-3 py-2">
          <span class="font-medium text-stone-100">{{ idx.options.get(oi.option)?.nom }}</span>
          <template v-if="idx.options.get(oi.option)?.effet.type === 'choix'">
            <select v-model="oi.choix" class="champ">
              <option v-for="p in (idx.options.get(oi.option)!.effet as any).parmi" :key="p.id" :value="p.id">{{ p.nom }}{{ p.cout ? ` · ${p.cout} pts` : '' }}</option>
            </select>
          </template>
          <template v-if="effetDe(oi)?.type === 'ajouter' && (effetDe(oi) as any).variantes?.length">
            <select v-model="oi.variante" class="champ">
              <option v-for="v in (effetDe(oi) as any).variantes" :key="v.id ?? v.nom" :value="v.id ?? v.nom">{{ v.nom }} · {{ v.cout }} pts</option>
            </select>
          </template>
          <template v-if="(effetDe(oi)?.type === 'ajouter' && (effetDe(oi) as any).cout_par_unite !== undefined) || (effetDe(oi)?.type === 'remplacer' && !(effetDe(oi) as any).tout && (effetDe(oi) as any).max !== 'tout')">
            <label class="flex items-center gap-1 text-xs text-stone-400">×<input type="number" class="champ w-16" :value="oi.quantite" :min="bornes(oi).min" :max="bornes(oi).max ?? undefined" @input="setQuantite(oi, ($event.target as HTMLInputElement).value)" @change="setQuantite(oi, ($event.target as HTMLInputElement).value)"><span v-if="bornes(oi).max !== null" class="text-stone-500">/ {{ bornes(oi).max }}</span></label>
          </template>
          <template v-if="effetDe(oi)?.type === 'choix_multiple'">
            <label v-for="p in (effetDe(oi) as any).parmi" :key="p.unite" class="flex items-center gap-1 text-xs text-stone-300">
              <input type="number" min="0" :max="plafond(oi, p.unite) ?? undefined" class="champ w-14" :value="oi.repartition?.[p.unite] ?? 0" @input="setRepartition(oi, p.unite, ($event.target as HTMLInputElement).value)">
              {{ nomU(p.unite) }}<span v-if="p.cout" class="text-stone-500"> {{ p.cout }}</span>
            </label>
          </template>
          <span class="ml-auto text-gold">{{ resolue?.options.find((o) => o.instance.id === oi.id)?.cout ?? 0 }} pts</span>
          <button type="button" class="bouton-ghost text-red-300" @click="retirerOption(oi.id)">✕</button>
        </div>
        <select class="champ w-full" :value="''" @change="ajouterOption(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">+ Ajouter une amélioration…</option>
          <option v-for="o in dispo" :key="o.id" :value="o.id" :title="phraseOption(idx, o)">{{ o.nom }} · {{ coutOption(o) }}</option>
        </select>
      </div>

      <!-- sous-formations -->
      <div v-if="specSous" class="space-y-2 border-l-2 border-gold/40 pl-3">
        <p class="text-xs uppercase tracking-wider text-stone-400">
          {{ specSous.label }} : {{ typeof specSous.total === 'number' ? specSous.total : `${specSous.total.min} à ${specSous.total.max}` }}
        </p>
        <CodexFormationCarte
          v-for="s in instance.sous_formations"
          :key="s.id"
          :idx="idx"
          :instance="s"
          :resolue="resolue?.sous_formations.find((r) => r.instance.id === s.id)"
          sous
          @supprimer="retirerSous(s.id)"
        />
        <select class="champ w-full" :value="''" @change="ajouterSous(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
          <option value="">+ Ajouter…</option>
          <option v-for="fid in specSous.parmi" :key="fid" :value="fid">{{ idx.formations.get(fid)?.nom }} · {{ idx.formations.get(fid)?.variantes[0]?.cout }} pts</option>
        </select>
      </div>

      <ul v-if="erreursIci.length" class="space-y-1 text-xs text-red-300">
        <li v-for="(e, ei) in erreursIci" :key="ei">⚠ {{ e.message }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.champ { @apply rounded border border-white/15 bg-surface px-2 py-1 text-sm text-stone-100 focus:border-gold focus:outline-none; }
.bouton-ghost { @apply rounded px-2 py-1 text-stone-400 hover:bg-white/10 hover:text-white; }
</style>
