<script setup lang="ts">
import type { CodexInput, Codex } from '~~/shared/codex/schema'
import { CodexSchema } from '~~/shared/codex/schema'
import { indexerCodex } from '~~/shared/codex/engine'
import { lignesFormation, prefixeFormation, phraseSousFormations, sousTitreSection, phraseOption, coutOption } from '~~/shared/codex/phrases'
import { parserComposition, formaterComposition } from '~~/shared/codex/parser'

type FormationInput = CodexInput['formations'][number]
type SectionInput = CodexInput['sections'][number]
type VarianteInput = FormationInput['variantes'][number]

const codex = useBrouillonCodex()
/** codex disponibles pour une alliance (tous sauf celui-ci) */
const { data: catalogue } = useFetch<Array<{ slug: string; nom: string; type: string }>>('/api/codex', { default: () => [] })
const alliesPossibles = computed(() => (catalogue.value ?? []).filter((c) => c.slug !== codex.value.codex.slug))
function setAllie(s: SectionInput, slug: string) {
  s.allies = slug ? { codex: slug } : undefined
}

/** Version validée du brouillon pour les phrases (défauts appliqués). Null si le brouillon est incohérent. */
const valide = computed<Codex | null>(() => {
  const r = CodexSchema.safeParse(codex.value)
  return r.success ? r.data : null
})
const idx = computed(() => (valide.value ? indexerCodex(valide.value) : null))

const selection = ref<{ type: 'formation'; id: string } | { type: 'section'; id: string } | null>(null)
const formationSel = computed(() => (selection.value?.type === 'formation' ? codex.value.formations.find((f) => f.id === selection.value!.id) : undefined))
const sectionSel = computed(() => (selection.value?.type === 'section' ? codex.value.sections.find((s) => s.id === selection.value!.id) : undefined))
const sectionDe = (fid: string) => codex.value.sections.find((s) => s.formations.includes(fid))

// ---- phrases (via la version validée quand possible) ----
function lignes(fid: string) {
  const f = idx.value?.formations.get(fid)
  return f && idx.value ? lignesFormation(idx.value, f) : [{ composition: '…', cout: '' }]
}
function prefixe(fid: string) {
  const f = idx.value?.formations.get(fid)
  return f && idx.value ? prefixeFormation(idx.value, f) : ''
}
function sousForm(fid: string) {
  const f = idx.value?.formations.get(fid)
  return f ? phraseSousFormations(f) : undefined
}
function sousTitre(s: SectionInput) {
  const sv = idx.value?.sections.get(s.id)
  return sv && idx.value ? sousTitreSection(idx.value, sv) : s.sous_titre
}
function nomOption(id: string) { return (codex.value.options ?? []).find((o) => o.id === id)?.nom ?? id }
function phraseOpt(id: string) { const o = idx.value?.options.get(id); return o && idx.value ? `${phraseOption(idx.value, o)} · ${coutOption(o)}` : '' }

// ---- sections ----
function ajouterSection() {
  const s: SectionInput = { id: idUnique('section', codex.value.sections), titre: 'NOUVELLE SECTION', formations: [], contraintes: [], options: [], notes: {} }
  codex.value.sections.push(s)
  selection.value = { type: 'section', id: s.id }
}
function deplacerSection(s: SectionInput, delta: number) {
  const i = codex.value.sections.indexOf(s)
  const j = i + delta
  if (j < 0 || j >= codex.value.sections.length) return
  codex.value.sections.splice(i, 1)
  codex.value.sections.splice(j, 0, s)
}
function supprimerSection(s: SectionInput) {
  if (s.formations.length && !confirm(`Supprimer la section et ses ${s.formations.length} formation(s) ?`)) return
  codex.value.formations = codex.value.formations.filter((f) => !s.formations.includes(f.id))
  codex.value.sections.splice(codex.value.sections.indexOf(s), 1)
  selection.value = null
}
function toggleOptionSection(s: SectionInput, oid: string) {
  const arr = [...(s.options ?? [])]
  const i = arr.indexOf(oid)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(oid)
  s.options = arr
}
function toggleTableauOptions(s: SectionInput, on: boolean) {
  s.tableau_options = on ? { titre: `AMÉLIORATIONS ${s.titre}`, sous_titre: '' } : undefined
}

// ---- formations ----
function ajouterFormation(s: SectionInput) {
  const f: FormationInput = { id: idUnique('nouvelle_formation', codex.value.formations), nom: 'Nouvelle formation', variantes: [{ id: 'base', cout: 200, composition: [] }], contraintes: [], options_plus: [], options_moins: [] }
  codex.value.formations.push(f)
  s.formations.push(f.id)
  selection.value = { type: 'formation', id: f.id }
  compoTexte.value = {}
}
function dupliquerFormation(f: FormationInput) {
  const copie = JSON.parse(JSON.stringify(f)) as FormationInput
  copie.id = idUnique(f.id, codex.value.formations)
  copie.nom = `${f.nom} (copie)`
  codex.value.formations.splice(codex.value.formations.indexOf(f) + 1, 0, copie)
  const s = sectionDe(f.id)
  s?.formations.splice(s.formations.indexOf(f.id) + 1, 0, copie.id)
  selection.value = { type: 'formation', id: copie.id }
}
function supprimerFormation(f: FormationInput) {
  if (!confirm(`Supprimer « ${f.nom} » ?`)) return
  const s = sectionDe(f.id)
  if (s) s.formations = s.formations.filter((x) => x !== f.id)
  codex.value.formations.splice(codex.value.formations.indexOf(f), 1)
  selection.value = null
}
function deplacerFormation(fid: string, delta: number) {
  const s = sectionDe(fid)
  if (!s) return
  const i = s.formations.indexOf(fid)
  const j = i + delta
  if (j < 0 || j >= s.formations.length) return
  s.formations.splice(i, 1)
  s.formations.splice(j, 0, fid)
}
function renommerId(f: FormationInput) {
  const refs = JSON.stringify({ s: codex.value.sections, l: codex.value.listes_test, sf: codex.value.formations.map((x) => x.sous_formations) }).split(`"${f.id}"`).length - 1
  if (refs <= 1) {
    const nouveau = idUnique(slugifier(f.nom), codex.value.formations.filter((x) => x !== f))
    const s = sectionDe(f.id)
    if (s) s.formations = s.formations.map((x) => (x === f.id ? nouveau : x))
    f.id = nouveau
    selection.value = { type: 'formation', id: nouveau }
  }
}

// ---- variantes et composition en texte ----
const compoTexte = ref<Record<string, string>>({})
const compoErreurs = ref<Record<string, string[]>>({})
function texteCompo(v: VarianteInput) {
  const cle = `${formationSel.value?.id}/${v.id}`
  return compoTexte.value[cle] ?? formaterComposition(v.composition as never, (valide.value?.unites ?? codex.value.unites) as never)
}
function appliquerCompo(v: VarianteInput, texte: string) {
  const cle = `${formationSel.value?.id}/${v.id}`
  compoTexte.value[cle] = texte
  const r = parserComposition(texte, (valide.value?.unites ?? codex.value.unites) as never)
  compoErreurs.value[cle] = r.erreurs
  if (!r.erreurs.length || r.lignes.length) v.composition = r.lignes as never
}
function erreursCompo(v: VarianteInput) { return compoErreurs.value[`${formationSel.value?.id}/${v.id}`] ?? [] }
function ajouterVariante(f: FormationInput) {
  const base = f.variantes[0]!
  f.variantes.push({ id: idUnique('variante', f.variantes), nom: 'Variante', cout: base.cout, composition: JSON.parse(JSON.stringify(base.composition)), contraintes: [] })
}
function retirerVariante(f: FormationInput, v: VarianteInput) {
  if (f.variantes.length <= 1) return
  f.variantes.splice(f.variantes.indexOf(v), 1)
}
function toggleOptionFormation(f: FormationInput, oid: string, sectionDispo: boolean) {
  // règle : si l'option vient de la section on la retire via options_moins, sinon on l'ajoute via options_plus
  const plus = new Set(f.options_plus ?? [])
  const moins = new Set(f.options_moins ?? [])
  if (sectionDispo) { if (moins.has(oid)) moins.delete(oid); else moins.add(oid) }
  else { if (plus.has(oid)) plus.delete(oid); else plus.add(oid) }
  f.options_plus = [...plus]
  f.options_moins = [...moins]
}
function optionActive(f: FormationInput, oid: string) {
  const s = sectionDe(f.id)
  const base = f.options ?? s?.options ?? []
  return (base.includes(oid) || (f.options_plus ?? []).includes(oid)) && !(f.options_moins ?? []).includes(oid)
}
function activerSousFormations(f: FormationInput, on: boolean) {
  f.sous_formations = on ? { label: 'essaims instinctifs', total: { min: 2, max: 6 }, parmi: [] } : undefined
}
function toggleParmi(f: FormationInput, fid: string) {
  if (!f.sous_formations) return
  const arr = [...f.sous_formations.parmi]
  const i = arr.indexOf(fid)
  if (i >= 0) arr.splice(i, 1)
  else arr.push(fid)
  f.sous_formations.parmi = arr
}
const totalSous = (f: FormationInput) => (typeof f.sous_formations?.total === 'number' ? { min: f.sous_formations.total, max: f.sous_formations.total } : (f.sous_formations?.total ?? { min: 0, max: 0 }))
function setTotalSous(f: FormationInput, k: 'min' | 'max', v: number) {
  const t = { ...totalSous(f), [k]: v }
  f.sous_formations!.total = t.min === t.max ? t.min : t
}
</script>

<template>
  <div class="grid gap-5 xl:grid-cols-[1fr_400px]">
    <!-- Tableaux façon PDF -->
    <div class="space-y-5">
      <p v-if="!valide" class="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        Le brouillon contient des incohérences (voir « Problèmes » en haut) : les phrases générées peuvent être incomplètes tant qu'elles ne sont pas corrigées.
      </p>
      <div v-for="s in codex.sections" :key="s.id" class="overflow-hidden rounded-lg border shadow-lg shadow-black/30" :class="sectionSel?.id === s.id ? 'border-gold' : 'border-[#3a2f24]'">
        <button type="button" class="bandeau block w-full px-3 py-2 text-left" :style="{ '--accent': codex.codex.couleur ?? '#8a6d3b' }" @click="selection = { type: 'section', id: s.id }">
          <span class="block text-center font-heading text-sm font-bold uppercase tracking-wide text-[#f3ecdc]">{{ s.titre }}</span>
          <span v-if="sousTitre(s)" class="block text-center text-[11px] italic text-[#f3ecdc]/75">({{ sousTitre(s) }})</span>
        </button>
        <table class="papier w-full text-[12px]">
          <thead class="text-left text-[11px] text-[#7a6d5c]">
            <tr class="border-b border-[#cfc3ad]"><th class="w-[32%] px-3 py-1">Formations</th><th class="py-1">Unités</th><th v-if="s.formations.some((fid) => sousForm(fid))" class="w-[22%] py-1">Puissance</th><th class="w-[16%] py-1 text-right pr-3">Coût</th><th class="w-8" /></tr>
          </thead>
          <tbody>
            <tr v-for="fid in s.formations" :key="fid" class="cursor-pointer border-b border-dotted border-[#d9cfbb] hover:bg-[#e9dfc9]" :class="formationSel?.id === fid ? 'bg-[#e4d6b8] ring-1 ring-inset ring-[#b8975a]' : ''" @click="selection = { type: 'formation', id: fid }">
              <td class="px-3 py-1.5 font-semibold">{{ prefixe(fid) }}{{ codex.formations.find((f) => f.id === fid)?.nom ?? fid }}</td>
              <td class="py-1.5">
                <div v-for="(l, li) in lignes(fid)" :key="li"><span v-if="li" class="italic text-[#7a6d5c]">ou </span>{{ l.composition }}</div>
                <div v-for="oid in codex.formations.find((f) => f.id === fid)?.options_plus ?? []" :key="oid" class="italic text-[#6b5f4f]">{{ phraseOpt(oid) }}</div>
              </td>
              <td v-if="s.formations.some((x) => sousForm(x))" class="py-1.5 text-[#4d4336]">{{ sousForm(fid) }}</td>
              <td class="py-1.5 pr-3 text-right"><div v-for="(l, li) in lignes(fid)" :key="li">{{ l.cout }}</div></td>
              <td class="py-1.5 text-center text-[#9a7b3c]">✎</td>
            </tr>
            <tr v-if="s.allies">
              <td colspan="5" class="px-3 py-1.5 text-xs italic text-[#7a6d5c]">+ les formations de « {{ alliesPossibles.find((c) => c.slug === s.allies!.codex)?.nom ?? s.allies.codex }} » (alliance, affichées dans l'aperçu)</td>
            </tr>
            <tr>
              <td colspan="5" class="px-3 py-1.5">
                <button type="button" class="text-xs text-[#9a7b3c] hover:underline" @click.stop="ajouterFormation(s)">+ Ajouter une formation</button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="s.tableau_options && (s.options?.length)" class="papier text-[12px]">
          <div class="bandeau-doux px-3 py-1 text-center text-[11px] font-bold uppercase text-[#f3ecdc]" :style="{ '--accent': codex.codex.couleur ?? '#8a6d3b' }">{{ s.tableau_options.titre }}</div>
          <table class="w-full"><tbody>
            <tr v-for="oid in s.options" :key="oid" class="border-b border-dotted border-[#d9cfbb]"><td class="w-[32%] px-3 py-1 font-semibold">{{ nomOption(oid) }}</td><td class="py-1 text-[#4d4336]">{{ phraseOpt(oid) }}</td></tr>
          </tbody></table>
        </div>
      </div>
      <button type="button" class="text-sm text-gold hover:underline" @click="ajouterSection">+ Ajouter une section</button>
    </div>

    <!-- Panneau latéral -->
    <aside class="xl:sticky xl:top-6 xl:self-start">
      <div v-if="formationSel" class="panneau">
        <div class="mb-3 flex items-start justify-between">
          <p class="text-xs uppercase tracking-wider text-gray-500">Formation · {{ sectionDe(formationSel.id)?.titre }}</p>
          <div class="flex gap-1">
            <button type="button" class="icone" title="Monter" @click="deplacerFormation(formationSel.id, -1)">↑</button>
            <button type="button" class="icone" title="Descendre" @click="deplacerFormation(formationSel.id, 1)">↓</button>
            <button type="button" class="icone" title="Dupliquer" @click="dupliquerFormation(formationSel)">⧉</button>
            <button type="button" class="icone hover:text-red-300" title="Supprimer" @click="supprimerFormation(formationSel)">✕</button>
          </div>
        </div>
        <label class="lbl">Nom<input v-model="formationSel.nom" class="champ text-base font-semibold" @blur="renommerId(formationSel)"></label>

        <p class="lbl mt-4">Composition et coût <span class="normal-case text-gray-600">· une variante par ligne « ou »</span></p>
        <div v-for="v in formationSel.variantes" :key="v.id" class="mt-2 rounded-md border border-white/10 p-3">
          <div class="flex items-center gap-2">
            <input v-if="formationSel.variantes.length > 1" v-model="v.nom" class="champ flex-1" placeholder="Nom de la variante (3 Manticores)">
            <span v-else class="flex-1 text-xs text-gray-500">Variante unique</span>
            <input v-model.number="v.cout" type="number" min="0" step="5" class="champ w-20 text-right"><span class="text-xs text-gray-400">pts</span>
            <button v-if="formationSel.variantes.length > 1" type="button" class="icone hover:text-red-300" @click="retirerVariante(formationSel, v)">✕</button>
          </div>
          <textarea :value="texteCompo(v)" rows="2" class="champ mt-2 w-full font-body text-base" placeholder="12 Gardes Impériaux, 7 Chimères, 1 Commissaire (implicite)" @input="appliquerCompo(v, ($event.target as HTMLTextAreaElement).value)" />
          <p v-if="erreursCompo(v).length" class="mt-1 text-xs text-red-300">{{ erreursCompo(v).join(' · ') }}</p>
          <p v-else class="mt-1 text-[11px] text-gray-500">Formes comprises : « 6 Leman Russ », « 3 au choix parmi Baneblade, Shadowsword », « 2 à 6 au choix parmi Termagant ×6 (75), Hormagaunt ×6 (75) », « + transports Rhino », « 1 Commissaire (implicite) ».</p>
        </div>
        <button type="button" class="mt-2 text-xs text-gold hover:underline" @click="ajouterVariante(formationSel)">+ Variante « ou »</button>

        <p class="lbl mt-4">Améliorations disponibles <span class="normal-case text-gray-600">· celles de la section sont cochées par défaut</span></p>
        <div class="mt-1 max-h-44 overflow-auto rounded border border-white/10 p-2">
          <label v-for="o in codex.options ?? []" :key="o.id" class="flex items-center gap-2 py-0.5 text-xs text-gray-300">
            <input type="checkbox" :checked="optionActive(formationSel, o.id)" @change="toggleOptionFormation(formationSel, o.id, (sectionDe(formationSel.id)?.options ?? []).includes(o.id))">
            {{ o.nom }}<span v-if="(sectionDe(formationSel.id)?.options ?? []).includes(o.id)" class="text-gray-600">(section)</span>
          </label>
          <p v-if="!codex.options?.length" class="text-xs text-gray-600">Aucune option définie (onglet Améliorations).</p>
        </div>

        <p class="lbl mt-4">Règles propres à cette formation</p>
        <AdminCodexReglesEditeur :contraintes="formationSel.contraintes as any" portee="formation" />

        <p class="lbl mt-4">Sous-formations <span class="normal-case text-gray-600">· Tyranides : essaims rattachés</span></p>
        <label class="flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" :checked="!!formationSel.sous_formations" @change="activerSousFormations(formationSel, ($event.target as HTMLInputElement).checked)"> Cette formation en rattache</label>
        <div v-if="formationSel.sous_formations" class="mt-2 space-y-2 text-xs">
          <div class="flex items-center gap-2">De <input :value="totalSous(formationSel).min" type="number" min="0" class="champ w-14" @input="setTotalSous(formationSel, 'min', parseInt(($event.target as HTMLInputElement).value || '0', 10))"> à <input :value="totalSous(formationSel).max" type="number" min="0" class="champ w-14" @input="setTotalSous(formationSel, 'max', parseInt(($event.target as HTMLInputElement).value || '0', 10))"> <input v-model="formationSel.sous_formations.label" class="champ flex-1" placeholder="essaims instinctifs"></div>
          <div class="max-h-36 overflow-auto rounded border border-white/10 p-2">
            <label v-for="f in codex.formations.filter((x) => x.id !== formationSel!.id)" :key="f.id" class="flex items-center gap-2 py-0.5 text-gray-300"><input type="checkbox" :checked="formationSel.sous_formations.parmi.includes(f.id)" @change="toggleParmi(formationSel, f.id)">{{ f.nom }}</label>
          </div>
          <input v-model="formationSel.sous_formations.phrase_pdf" class="champ w-full" placeholder="Phrase du PDF (optionnel)">
        </div>

        <label class="lbl mt-4">Note affichée sous la formation<input v-model="formationSel.description" class="champ" placeholder="optionnel"></label>
      </div>

      <div v-else-if="sectionSel" class="panneau">
        <div class="mb-3 flex items-start justify-between">
          <p class="text-xs uppercase tracking-wider text-gray-500">Section</p>
          <div class="flex gap-1">
            <button type="button" class="icone" @click="deplacerSection(sectionSel, -1)">↑</button>
            <button type="button" class="icone" @click="deplacerSection(sectionSel, 1)">↓</button>
            <button type="button" class="icone hover:text-red-300" @click="supprimerSection(sectionSel)">✕</button>
          </div>
        </div>
        <label class="lbl">Titre<input v-model="sectionSel.titre" class="champ font-semibold uppercase"></label>
        <label class="lbl mt-2">Sous-titre explicite <span class="normal-case text-gray-600">(sinon généré depuis les règles ; un même sous-titre sur deux sections voisines = bandeau commun)</span><input v-model="sectionSel.sous_titre" class="champ"></label>

        <p class="lbl mt-4">Règles de la section <span class="normal-case text-gray-600">· héritées par toutes ses formations</span></p>
        <AdminCodexReglesEditeur :contraintes="sectionSel.contraintes as any" portee="section" />

        <p class="lbl mt-4">Améliorations disponibles pour toutes les formations</p>
        <div class="mt-1 max-h-44 overflow-auto rounded border border-white/10 p-2">
          <label v-for="o in codex.options ?? []" :key="o.id" class="flex items-center gap-2 py-0.5 text-xs text-gray-300"><input type="checkbox" :checked="sectionSel.options?.includes(o.id)" @change="toggleOptionSection(sectionSel, o.id)">{{ o.nom }}</label>
          <p v-if="!codex.options?.length" class="text-xs text-gray-600">Aucune option définie (onglet Améliorations).</p>
        </div>
        <p class="lbl mt-4">Alliance <span class="normal-case text-gray-600">· formations d'un autre codex proposées dans cette section</span></p>
        <select :value="sectionSel.allies?.codex ?? ''" class="champ mt-1 w-full" @change="setAllie(sectionSel, ($event.target as HTMLSelectElement).value)">
          <option value="">Aucune</option>
          <option v-for="c in alliesPossibles" :key="c.slug" :value="c.slug">{{ c.nom }}{{ c.type === 'soutien' ? ' (liste de soutien)' : '' }}</option>
        </select>
        <p v-if="sectionSel.allies" class="mt-1 text-[11px] text-gray-500">Les formations de « {{ alliesPossibles.find((c) => c.slug === sectionSel!.allies!.codex)?.nom ?? sectionSel.allies.codex }} » apparaîtront ici dans le PDF et le builder. Les règles de la section (par exemple « Compte dans le budget Supports ») s'appliquent à elles. La limite classique est 1/3 des points.</p>
        <label class="mt-3 flex items-center gap-2 text-xs text-gray-300"><input type="checkbox" :checked="!!sectionSel.tableau_options" @change="toggleTableauOptions(sectionSel, ($event.target as HTMLInputElement).checked)"> Tableau « Améliorations » séparé dans le PDF</label>
        <template v-if="sectionSel.tableau_options">
          <input v-model="sectionSel.tableau_options.titre" class="champ mt-1 w-full uppercase" placeholder="Titre du tableau">
          <input v-model="sectionSel.tableau_options.sous_titre" class="champ mt-1 w-full" placeholder="Sous-titre (optionnel)">
        </template>
        <label class="mt-3 flex items-center gap-2 text-xs text-gray-300"><input v-model="sectionSel.colonne_options" type="checkbox"> Colonne « Améliorations » dans le tableau des formations</label>
      </div>

      <div v-else class="panneau text-sm text-gray-400">
        <p class="font-semibold text-gray-200">Clique une ligne pour la modifier.</p>
        <p class="mt-2">Le tableau de gauche est le PDF tel qu'il sera imprimé. Une ligne = une formation, un bandeau = une section. Ce que tu tapes dans le panneau apparaît aussitôt dans le tableau.</p>
      </div>
    </aside>
  </div>
</template>

<style scoped>
/* rendu « papier » adouci : parchemin au lieu de blanc, couleur du codex fondue dans le brun du site */
.papier { background: #efe7d8; color: #2b241c; }
.bandeau { background: color-mix(in srgb, var(--accent) 45%, #4a3a26); }
.bandeau-doux { background: color-mix(in srgb, var(--accent) 35%, #6b5a3f); }
.panneau { @apply rounded-lg border border-gold/30 bg-surface-light p-4; }
.lbl { @apply flex flex-col gap-1 text-xs uppercase tracking-wider text-gray-500; }
.champ { @apply rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm normal-case tracking-normal text-gray-100 focus:border-gold focus:outline-none; }
.icone { @apply rounded px-1.5 py-0.5 text-gray-500 hover:bg-white/10 hover:text-white; }
</style>
