<script setup lang="ts">
import type { CodexInput, Codex } from '~~/shared/codex/schema'
import { CodexSchema } from '~~/shared/codex/schema'
import { indexerCodex } from '~~/shared/codex/engine'
import { phraseOption, coutOption } from '~~/shared/codex/phrases'

type OptionInput = CodexInput['options'] extends (infer T)[] | undefined ? T : never

const codex = useBrouillonCodex()
const options = computed(() => (codex.value.options ??= []))
const unites = computed(() => codex.value.unites)
const ouverte = ref<string | null>(null)
const jsonBrut = ref<Record<string, string>>({})
const jsonErreur = ref<Record<string, string>>({})

const valide = computed<Codex | null>(() => { const r = CodexSchema.safeParse(codex.value); return r.success ? r.data : null })
const idx = computed(() => (valide.value ? indexerCodex(valide.value) : null))
function apercu(o: OptionInput) {
  const v = idx.value?.options.get(o.id)
  return v && idx.value ? `${phraseOption(idx.value, v)} · ${coutOption(v)}` : '(brouillon incohérent)'
}

const TYPES = [
  { v: 'ajouter', l: 'Ajouter des unités' },
  { v: 'remplacer', l: 'Remplacer des unités' },
  { v: 'mot_cle', l: 'Mot-clé / règle spéciale' },
  { v: 'choix', l: 'Un choix parmi plusieurs' },
  { v: 'choix_multiple', l: 'Plusieurs unités au choix (répartition)' },
]
function ajouter() {
  const o = { id: idUnique('nouvelle_option', options.value), nom: 'Nouvelle amélioration', effet: { type: 'ajouter', unites: [], cout: 50 }, contraintes: [{ type: 'max_par_formation', valeur: 1 }] } as unknown as OptionInput
  options.value.push(o)
  ouverte.value = o.id
}
function supprimer(o: OptionInput) {
  if (!confirm(`Supprimer « ${o.nom} » ? Elle sera retirée des sections et formations.`)) return
  for (const s of codex.value.sections) s.options = (s.options ?? []).filter((x) => x !== o.id)
  for (const f of codex.value.formations) { f.options = f.options?.filter((x) => x !== o.id); f.options_plus = (f.options_plus ?? []).filter((x) => x !== o.id); f.options_moins = (f.options_moins ?? []).filter((x) => x !== o.id) }
  options.value.splice(options.value.indexOf(o), 1)
}
function renommerId(o: OptionInput) {
  const refs = JSON.stringify({ s: codex.value.sections, f: codex.value.formations }).split(`"${o.id}"`).length - 1
  if (refs === 0) o.id = idUnique(slugifier(o.nom), options.value.filter((x) => x !== o))
}
function changerType(o: OptionInput, type: string) {
  const e = o.effet as Record<string, unknown>
  if (type === 'ajouter') o.effet = { type, unites: [], cout: 50 } as never
  else if (type === 'remplacer') o.effet = { type, de: unites.value[0]?.id ?? '', par: unites.value[0]?.id ?? '', lot: 1, max: 1, cout: 0 } as never
  else if (type === 'mot_cle') o.effet = { type, texte: String(e.texte ?? ''), cout: 50 } as never
  else if (type === 'choix') o.effet = { type, parmi: [{ id: 'a', nom: 'Choix A', cout: 50 }] } as never
  else o.effet = { type, total: { min: 1, max: 2 }, parmi: [] } as never
}
const eff = (o: OptionInput) => o.effet as unknown as Record<string, any>
function modeAjout(o: OptionInput) { const e = eff(o); return e.variantes?.length ? 'variantes' : e.cout_par_unite !== undefined ? 'quantite' : 'fixe' }
function setModeAjout(o: OptionInput, mode: string) {
  const e = eff(o)
  delete e.variantes; delete e.cout_par_unite; delete e.min; delete e.max; delete e.cout
  if (mode === 'fixe') e.cout = 50
  else if (mode === 'quantite') { e.cout_par_unite = 25; e.min = 1; e.max = 2 }
  else e.variantes = [{ id: 'a', nom: 'Variante A', cout: 100, unites: [] }]
}
function ajouterUniteA(liste: Array<{ unite: string; nombre: number }>) { liste.push({ unite: unites.value[0]?.id ?? '', nombre: 1 }) }
function json(o: OptionInput) { return jsonBrut.value[o.id] ?? JSON.stringify(o.effet, null, 2) }
function appliquerJson(o: OptionInput, txt: string) {
  jsonBrut.value[o.id] = txt
  try { o.effet = JSON.parse(txt); jsonErreur.value[o.id] = '' } catch (e) { jsonErreur.value[o.id] = (e as Error).message }
}
</script>

<template>
  <div class="rounded-lg border border-gold/10 bg-surface-light">
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gold/10 px-5 py-3">
      <div>
        <h3 class="font-heading text-base font-semibold text-gold">Améliorations <span class="text-sm font-normal text-gray-500">({{ options.length }})</span></h3>
        <p class="text-xs text-gray-500">Définies une fois ici, puis proposées aux sections et formations dans l'onglet Liste d'armée.</p>
      </div>
      <button type="button" class="bouton" @click="ajouter">+ Amélioration</button>
    </div>

    <div v-for="o in options" :key="o.id" class="border-t border-white/5">
      <div class="flex cursor-pointer items-center gap-3 px-5 py-2 hover:bg-white/[.02]" @click="ouverte = ouverte === o.id ? null : o.id">
        <span class="w-56 shrink-0 truncate font-medium text-gray-100">{{ o.nom }}</span>
        <span class="flex-1 truncate text-sm text-gray-400">{{ apercu(o) }}</span>
        <span class="rounded bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wider text-gray-500">{{ TYPES.find((t) => t.v === (o.effet as any).type)?.l ?? (o.effet as any).type }}</span>
        <button type="button" class="icone hover:text-red-300" @click.stop="supprimer(o)">✕</button>
      </div>
      <div v-if="ouverte === o.id" class="grid gap-4 bg-gold/5 px-5 pb-5 pt-2 lg:grid-cols-2">
        <div class="space-y-3">
          <div class="grid grid-cols-[1fr_auto] gap-2">
            <label class="lbl">Nom<input v-model="o.nom" class="champ" @blur="renommerId(o)"></label>
            <label class="lbl">Type d'effet<select :value="(o.effet as any).type" class="champ" @change="changerType(o, ($event.target as HTMLSelectElement).value)"><option v-for="t in TYPES" :key="t.v" :value="t.v">{{ t.l }}</option></select></label>
          </div>

          <!-- ajouter -->
          <template v-if="eff(o).type === 'ajouter'">
            <div class="flex gap-3 text-xs text-gray-300">
              <label class="flex items-center gap-1"><input type="radio" :checked="modeAjout(o) === 'fixe'" @change="setModeAjout(o, 'fixe')"> coût fixe</label>
              <label class="flex items-center gap-1"><input type="radio" :checked="modeAjout(o) === 'quantite'" @change="setModeAjout(o, 'quantite')"> par unité (quantité)</label>
              <label class="flex items-center gap-1"><input type="radio" :checked="modeAjout(o) === 'variantes'" @change="setModeAjout(o, 'variantes')"> lignes « ou »</label>
            </div>
            <template v-if="modeAjout(o) !== 'variantes'">
              <p class="lbl">Unités ajoutées</p>
              <div v-for="(u, ui) in eff(o).unites" :key="ui" class="flex items-center gap-2">
                <input v-model.number="u.nombre" type="number" min="1" class="champ w-16"> ×
                <select v-model="u.unite" class="champ flex-1"><option v-for="x in unites" :key="x.id" :value="x.id">{{ x.nom }}</option></select>
                <button type="button" class="icone hover:text-red-300" @click="eff(o).unites.splice(ui, 1)">✕</button>
              </div>
              <button type="button" class="text-xs text-gold hover:underline" @click="ajouterUniteA(eff(o).unites)">+ Unité</button>
              <div v-if="modeAjout(o) === 'fixe'" class="flex gap-3"><label class="lbl">Coût<input v-model.number="eff(o).cout" type="number" min="0" class="champ w-24"></label></div>
              <div v-else class="flex flex-wrap gap-3">
                <label class="lbl">Coût par lot<input v-model.number="eff(o).cout_par_unite" type="number" min="0" class="champ w-24"></label>
                <label class="lbl">Min<input v-model.number="eff(o).min" type="number" min="0" class="champ w-16"></label>
                <label class="lbl">Max
                  <select :value="eff(o).max === 'besoin_transport' ? 'transport' : eff(o).max === undefined ? 'illimite' : 'n'" class="champ" @change="eff(o).max = ($event.target as HTMLSelectElement).value === 'transport' ? 'besoin_transport' : ($event.target as HTMLSelectElement).value === 'illimite' ? undefined : 2">
                    <option value="n">nombre</option><option value="illimite">illimité</option><option value="transport">autant que nécessaire pour embarquer</option>
                  </select>
                </label>
                <label v-if="typeof eff(o).max === 'number'" class="lbl">Valeur<input v-model.number="eff(o).max" type="number" min="1" class="champ w-16"></label>
                <label v-if="eff(o).max === 'besoin_transport'" class="lbl">Embarquer<select v-model="eff(o).perimetre_transport" class="champ"><option value="formation">toute la formation</option><option value="options">les unités des améliorations</option></select></label>
                <label class="flex items-center gap-1 self-end pb-1.5 text-xs text-gray-300"><input v-model="eff(o).par_taille" type="checkbox"> max × taille de bande</label>
              </div>
            </template>
            <template v-else>
              <div v-for="(v, vi) in eff(o).variantes" :key="vi" class="rounded border border-white/10 p-2">
                <div class="flex gap-2"><input v-model="v.nom" class="champ flex-1" placeholder="3 Leman Russ"><input v-model.number="v.cout" type="number" class="champ w-20"><button type="button" class="icone hover:text-red-300" @click="eff(o).variantes.splice(vi, 1)">✕</button></div>
                <div v-for="(u, ui) in v.unites" :key="ui" class="mt-1 flex items-center gap-2"><input v-model.number="u.nombre" type="number" min="1" class="champ w-16"> × <select v-model="u.unite" class="champ flex-1"><option v-for="x in unites" :key="x.id" :value="x.id">{{ x.nom }}</option></select><button type="button" class="icone" @click="v.unites.splice(ui, 1)">✕</button></div>
                <button type="button" class="mt-1 text-xs text-gold hover:underline" @click="ajouterUniteA(v.unites)">+ Unité</button>
              </div>
              <button type="button" class="text-xs text-gold hover:underline" @click="eff(o).variantes.push({ id: 'v' + (eff(o).variantes.length + 1), nom: 'Variante', cout: 100, unites: [] })">+ Ligne « ou »</button>
            </template>
          </template>

          <!-- remplacer -->
          <template v-else-if="eff(o).type === 'remplacer'">
            <div class="grid grid-cols-2 gap-2">
              <label class="lbl">Remplace<select v-model="eff(o).de" class="champ"><option v-for="x in unites" :key="x.id" :value="x.id">{{ x.nom }}</option></select></label>
              <label class="lbl">Par<select v-model="eff(o).par" class="champ"><option v-for="x in unites" :key="x.id" :value="x.id">{{ x.nom }}</option></select></label>
              <label class="lbl">Unités par lot<input v-model.number="eff(o).lot" type="number" min="1" class="champ"></label>
              <label class="lbl">Coût par lot<input v-model.number="eff(o).cout" type="number" min="0" class="champ"></label>
              <label class="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" :checked="eff(o).tout || eff(o).max === 'tout'" @change="eff(o).tout = ($event.target as HTMLInputElement).checked; if (!eff(o).tout) eff(o).max = 1"> Remplace toutes les unités concernées</label>
              <label v-if="!eff(o).tout" class="lbl">Lots max<input v-model.number="eff(o).max" type="number" min="1" class="champ"></label>
              <label v-else class="lbl">Nombre obtenu<input v-model.number="eff(o).par_nombre" type="number" min="1" class="champ" placeholder="autant"></label>
            </div>
          </template>

          <!-- mot-clé -->
          <template v-else-if="eff(o).type === 'mot_cle'">
            <label class="lbl">Texte<input v-model="eff(o).texte" class="champ" placeholder="Téléportation"></label>
            <label class="lbl">Coût<input v-model.number="eff(o).cout" type="number" min="0" class="champ w-24"></label>
          </template>

          <!-- choix -->
          <template v-else-if="eff(o).type === 'choix'">
            <div v-for="(p, pi) in eff(o).parmi" :key="pi" class="flex gap-2"><input v-model="p.nom" class="champ flex-1" placeholder="Capitaine"><input v-model.number="p.cout" type="number" class="champ w-20"><button type="button" class="icone hover:text-red-300" @click="eff(o).parmi.splice(pi, 1)">✕</button></div>
            <button type="button" class="text-xs text-gold hover:underline" @click="eff(o).parmi.push({ id: 'c' + (eff(o).parmi.length + 1), nom: 'Choix', cout: 0 })">+ Choix</button>
            <p class="text-[11px] text-gray-500">Les effets par choix (unité ajoutée, remplacement) se règlent dans l'éditeur avancé à droite.</p>
          </template>

          <!-- choix multiple -->
          <template v-else-if="eff(o).type === 'choix_multiple'">
            <div class="flex gap-3"><label class="lbl">Min<input v-model.number="eff(o).total.min" type="number" min="0" class="champ w-16"></label><label class="lbl">Max<input v-model.number="eff(o).total.max" type="number" min="1" class="champ w-16"></label></div>
            <div v-for="(p, pi) in eff(o).parmi" :key="pi" class="flex items-center gap-2"><select v-model="p.unite" class="champ flex-1"><option v-for="x in unites" :key="x.id" :value="x.id">{{ x.nom }}</option></select><input v-model.number="p.cout" type="number" class="champ w-20" placeholder="pts"><button type="button" class="icone hover:text-red-300" @click="eff(o).parmi.splice(pi, 1)">✕</button></div>
            <button type="button" class="text-xs text-gold hover:underline" @click="eff(o).parmi.push({ unite: unites[0]?.id ?? '', cout: 0 })">+ Unité proposée</button>
          </template>

          <label class="lbl">Phrase du PDF (surcharge, optionnel)<input v-model="o.phrase_pdf" class="champ"></label>
          <label class="lbl">Note (astérisque de bas de tableau, optionnel)<input v-model="o.note_md" class="champ"></label>
        </div>

        <div class="space-y-3">
          <p class="lbl">Règles</p>
          <AdminCodexReglesEditeur :contraintes="(o.contraintes ??= []) as any" portee="option" />
          <details class="rounded border border-white/10">
            <summary class="cursor-pointer px-3 py-1.5 text-xs text-gray-400">Éditeur avancé (JSON de l'effet)</summary>
            <textarea :value="json(o)" rows="10" class="champ w-full rounded-t-none font-mono text-xs" @input="appliquerJson(o, ($event.target as HTMLTextAreaElement).value)" />
            <p v-if="jsonErreur[o.id]" class="px-3 pb-2 text-xs text-red-300">{{ jsonErreur[o.id] }}</p>
          </details>
        </div>
      </div>
    </div>
    <p v-if="!options.length" class="px-5 py-8 text-center text-sm text-gray-500">Aucune amélioration.</p>
  </div>
</template>

<style scoped>
.champ { @apply rounded-md border border-white/10 bg-surface px-2 py-1 text-sm text-gray-100 focus:border-gold focus:outline-none; }
.bouton { @apply rounded-md bg-gold px-3 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light; }
.icone { @apply rounded px-1.5 py-0.5 text-gray-500 hover:bg-white/10 hover:text-white; }
.lbl { @apply flex flex-col gap-1 text-xs uppercase tracking-wider text-gray-500; }
</style>
