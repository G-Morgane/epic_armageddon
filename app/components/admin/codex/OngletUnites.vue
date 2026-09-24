<script setup lang="ts">
import type { CodexInput } from '~~/shared/codex/schema'

type UniteInput = NonNullable<CodexInput['unites']>[number]
type ArmeInput = NonNullable<UniteInput['armes']>[number]

const codex = useBrouillonCodex()
const unites = computed(() => codex.value.unites)
const ouverte = ref<string | null>(null)
const filtre = ref('')
const types = ['Inf', 'VL', 'VB', 'EG', 'A', 'A/EG', 'VS', 'Perso', 'Bat']

const visibles = computed(() => {
  const f = filtre.value.trim().toLowerCase()
  return unites.value.filter((u) => !f || u.nom.toLowerCase().includes(f) || u.type.toLowerCase().includes(f))
})

function ajouter() {
  const u: UniteInput = { id: idUnique('nouvelle_unite', unites.value), nom: 'Nouvelle unité', type: 'Inf', vitesse: '15cm', blindage: '-', cc: '6+', ff: '5+', armes: [], notes: [] }
  unites.value.push(u)
  ouverte.value = u.id
}
function dupliquer(u: UniteInput) {
  const copie = JSON.parse(JSON.stringify(u)) as UniteInput
  copie.id = idUnique(u.id, unites.value)
  copie.nom = `${u.nom} (copie)`
  unites.value.splice(unites.value.indexOf(u) + 1, 0, copie)
  ouverte.value = copie.id
}
function supprimer(u: UniteInput) {
  const refs = compterReferences(u.id)
  if (refs && !confirm(`« ${u.nom} » est utilisée ${refs} fois dans les formations ou options. Supprimer quand même ?`)) return
  unites.value.splice(unites.value.indexOf(u), 1)
}
function compterReferences(id: string): number {
  const txt = JSON.stringify({ f: codex.value.formations, o: codex.value.options })
  return (txt.match(new RegExp(`"${id}"`, 'g')) ?? []).length
}
function renommerId(u: UniteInput) {
  // l'id suit le nom tant que l'unité n'est référencée nulle part
  if (compterReferences(u.id) === 0) u.id = idUnique(slugifier(u.nom), unites.value.filter((x) => x !== u))
}
function ajouterArme(u: UniteInput) { (u.armes ??= []).push({ nom: '', portee: '', puissance: '' }) }
/** Options du codex qui proposent une liste : seules celles-là peuvent servir de menu d'armes à une ligne générique. */
const optionsArmement = computed(() => (codex.value.options ?? []).filter((o) => (o.effet as { type?: string })?.type === 'choix'))
function lierArmement(a: ArmeInput) { a.armement = { option: optionsArmement.value[0]?.id ?? '' } }
function notesTexte(u: UniteInput) { return (u.notes ?? []).join(' · ') }
function setNotes(u: UniteInput, v: string) { u.notes = v.split(/\s*·\s*|\n/).map((s) => s.trim()).filter(Boolean) }
function transportTexte(u: UniteInput) { return u.transport ? u.transport.accepte?.map((a) => unites.value.find((x) => x.id === a)?.nom ?? a).join(', ') ?? '' : '' }
function toggleTransport(u: UniteInput, on: boolean) { u.transport = on ? { capacite: 2, accepte: [] } : undefined }
function toggleAccepte(u: UniteInput, id: string) {
  if (!u.transport) return
  const arr = [...(u.transport.accepte ?? [])]
  const i = arr.indexOf(id)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(id)
  u.transport.accepte = arr
}
</script>

<template>
  <div class="rounded-lg border border-gold/10 bg-surface-light">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gold/10 px-5 py-3">
      <div>
        <h3 class="font-heading text-base font-semibold text-gold">Unités <span class="text-sm font-normal text-gray-500">({{ unites.length }})</span></h3>
        <p class="text-xs text-gray-500">Feuille de références : une ligne par unité, ses armes en dessous. Les noms saisis ici sont reconnus dans les compositions.</p>
      </div>
      <div class="flex items-center gap-2">
        <input v-model="filtre" class="champ w-48" placeholder="Filtrer…">
        <button type="button" class="bouton" @click="ajouter">+ Unité</button>
      </div>
    </div>

    <table class="w-full text-sm">
      <thead class="text-left text-xs uppercase tracking-wider text-gray-500">
        <tr><th class="px-4 py-2">Nom</th><th class="w-20 py-2">Type</th><th class="w-20 py-2">Vitesse</th><th class="w-20 py-2">Blindage</th><th class="w-16 py-2">CC</th><th class="w-16 py-2">FF</th><th class="py-2">Armes</th><th class="w-24 py-2" /></tr>
      </thead>
      <tbody>
        <template v-for="u in visibles" :key="u.id">
          <tr class="border-t border-white/5 hover:bg-white/[.02]" :class="ouverte === u.id ? 'bg-gold/5' : ''">
            <td class="px-4 py-1.5"><input v-model="u.nom" class="champ w-full font-medium" @blur="renommerId(u)"></td>
            <td class="py-1.5 pr-2"><select v-model="u.type" class="champ w-full"><option v-for="t in types" :key="t" :value="t">{{ t }}</option></select></td>
            <td class="py-1.5 pr-2"><input v-model="u.vitesse" class="champ w-full"></td>
            <td class="py-1.5 pr-2"><input v-model="u.blindage" class="champ w-full"></td>
            <td class="py-1.5 pr-2"><input v-model="u.cc" class="champ w-full"></td>
            <td class="py-1.5 pr-2"><input v-model="u.ff" class="champ w-full"></td>
            <td class="py-1.5 text-xs text-gray-400">
              <span v-if="u.armes?.length">{{ u.armes.map((a) => a.nom).filter(Boolean).join(', ') }}</span>
              <span v-else class="italic text-gray-600">aucune</span>
              <span v-if="u.transport" class="ml-2 rounded bg-gold/10 px-1.5 py-0.5 text-gold">Transport ({{ u.transport.capacite }})</span>
            </td>
            <td class="py-1.5 pr-3 text-right whitespace-nowrap">
              <button type="button" class="icone" :title="ouverte === u.id ? 'Replier' : 'Détails'" @click="ouverte = ouverte === u.id ? null : u.id">{{ ouverte === u.id ? '▴' : '▾' }}</button>
              <button type="button" class="icone" title="Dupliquer" @click="dupliquer(u)">⧉</button>
              <button type="button" class="icone hover:text-red-300" title="Supprimer" @click="supprimer(u)">✕</button>
            </td>
          </tr>
          <tr v-if="ouverte === u.id" class="bg-gold/5">
            <td colspan="8" class="px-4 pb-4 pt-1">
              <div class="grid gap-4 lg:grid-cols-[1fr_320px]">
                <div>
                  <p class="mb-1 text-xs uppercase tracking-wider text-gray-500">Armes</p>
                  <div v-for="(a, ai) in u.armes" :key="ai" class="mb-1">
                    <div class="grid grid-cols-[1fr_90px_1fr_auto] gap-2">
                      <input v-model="a.nom" class="champ" placeholder="Nom">
                      <input v-model="a.portee" class="champ" placeholder="Portée">
                      <input v-model="a.puissance" class="champ" placeholder="Puissance de feu">
                      <button type="button" class="icone hover:text-red-300" @click="u.armes!.splice(ai, 1)">✕</button>
                    </div>
                    <!-- ligne générique (« 2x Armes de Bras ») : le menu d'armes affiché dessous vient d'une option à choix -->
                    <div v-if="a.armement" class="mt-1 ml-4 grid grid-cols-[1fr_120px_auto] gap-2">
                      <select v-model="a.armement.option" class="champ"><option v-for="o in optionsArmement" :key="o.id" :value="o.id">{{ o.nom }}</option></select>
                      <select :value="a.armement.emplacement ?? ''" class="champ" @change="a.armement!.emplacement = (($event.target as HTMLSelectElement).value || undefined) as never"><option value="">Tous</option><option value="bras">Bras</option><option value="carapace">Carapace</option></select>
                      <button type="button" class="icone hover:text-red-300" title="Retirer les armes au choix" @click="a.armement = undefined">✕</button>
                    </div>
                    <button v-else-if="optionsArmement.length" type="button" class="ml-4 text-[11px] text-gray-500 hover:text-gold hover:underline" @click="lierArmement(a)">+ armes au choix</button>
                  </div>
                  <button type="button" class="text-xs text-gold hover:underline" @click="ajouterArme(u)">+ Arme</button>
                  <p class="mt-1 text-[11px] text-gray-500">« + armes au choix » : sous une ligne générique (« 2x Armes de Bras »), la liste des armes possibles d'une option à choix, avec leur coût. L'emplacement ne garde que les choix qui lui correspondent.</p>
                  <p class="mb-1 mt-3 text-xs uppercase tracking-wider text-gray-500">Notes <span class="normal-case text-gray-600">(séparées par ·)</span></p>
                  <input :value="notesTexte(u)" class="champ w-full" placeholder="Blindage Renforcé · Marcheur · Sans peur" @change="setNotes(u, ($event.target as HTMLInputElement).value)">
                  <div class="mt-3 grid grid-cols-3 gap-2">
                    <label class="lbl">CD<input :value="u.degats?.cd" type="number" min="1" class="champ" @input="u.degats = { ...(u.degats ?? { cd: 1 }), cd: parseInt(($event.target as HTMLInputElement).value || '0', 10) || 1 }"></label>
                    <label class="lbl">BI<input :value="u.degats?.bi" class="champ" @input="u.degats = { ...(u.degats ?? { cd: 1 }), bi: ($event.target as HTMLInputElement).value }"></label>
                    <label class="lbl">Identifiant<input v-model="u.id" class="champ font-mono text-xs"></label>
                  </div>
                  <label class="lbl mt-2">Critique<textarea :value="u.degats?.critique" rows="2" class="champ" @input="u.degats = { ...(u.degats ?? { cd: 1 }), critique: ($event.target as HTMLTextAreaElement).value }" /></label>
                </div>
                <div>
                  <p class="mb-1 text-xs uppercase tracking-wider text-gray-500">Transport <span class="normal-case text-gray-600">(sert au builder)</span></p>
                  <label class="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" :checked="!!u.transport" @change="toggleTransport(u, ($event.target as HTMLInputElement).checked)"> Cette unité transporte</label>
                  <template v-if="u.transport">
                    <label class="lbl mt-2">Places<input v-model.number="u.transport.capacite" type="number" min="1" class="champ w-20"></label>
                    <p class="mt-2 text-xs text-gray-500">Accepte : {{ transportTexte(u) || 'rien' }}</p>
                    <div class="mt-1 max-h-40 overflow-auto rounded border border-white/10 p-2">
                      <label v-for="x in unites.filter((y) => y.id !== u.id)" :key="x.id" class="flex items-center gap-2 py-0.5 text-xs text-gray-300"><input type="checkbox" :checked="u.transport.accepte?.includes(x.id)" @change="toggleAccepte(u, x.id)">{{ x.nom }}</label>
                    </div>
                  </template>
                  <label class="lbl mt-3">Places occupées quand transportée<input :value="u.taille_transport ?? 1" type="number" min="1" class="champ w-20" @input="u.taille_transport = parseInt(($event.target as HTMLInputElement).value || '1', 10)"></label>
                </div>
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
    <p v-if="!unites.length" class="px-5 py-8 text-center text-sm text-gray-500">Aucune unité. Commence par ajouter les profils de la feuille de références.</p>
  </div>
</template>

<style scoped>
.champ { @apply rounded-md border border-white/10 bg-surface px-2 py-1 text-sm text-gray-100 focus:border-gold focus:outline-none; }
.bouton { @apply rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light; }
.icone { @apply rounded px-1.5 py-0.5 text-gray-500 hover:bg-white/10 hover:text-white; }
.lbl { @apply flex flex-col gap-1 text-xs text-gray-400; }
</style>
