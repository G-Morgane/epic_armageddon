<script setup lang="ts">
import type { IndexCodex, FormationResolue } from '~~/shared/codex/engine'
import { optionsDisponibles, optionsAjoutables, optionsObligatoires, bornesOption, plafondRepartition } from '~~/shared/codex/engine'
import type { FormationInstance } from '~~/shared/codex/liste'
import { genererId } from '~~/shared/codex/liste'
import { phraseOption, coutOption, pluriel, lignesFormation, placesVariante, libelleChoix } from '~~/shared/codex/phrases'

const props = defineProps<{
  idx: IndexCodex
  instance: FormationInstance
  resolue?: FormationResolue
  sous?: boolean
  /** carte repliable : l'entête devient le bouton d'un accordéon */
  pliable?: boolean
  ouvert?: boolean
  /** nombre d'occurrences d'une option dans toute l'armée (pour les limites par armée) */
  compteArmee?: (optionId: string) => number
}>()
const emit = defineEmits<{ supprimer: []; dupliquer: []; basculer: [] }>()

/** une carte pliable ne montre que son entête tant qu'elle n'est pas la carte ouverte */
const replie = computed(() => !!props.pliable && !props.ouvert)

const def = computed(() => props.idx.formations.get(props.instance.formation))
const variante = computed(() => def.value?.variantes.find((v) => v.id === props.instance.variante) ?? def.value?.variantes[0])
const nomU = (id: string) => props.idx.unites.get(id)?.nom ?? id
const dispo = computed(() => (def.value ? optionsDisponibles(props.idx, def.value).map((o) => props.idx.options.get(o)!).filter(Boolean) : []))
const ajoutables = computed(() => (props.resolue ? optionsAjoutables(props.idx, props.resolue, props.compteArmee) : dispo.value))
const specSous = computed(() => variante.value?.sous_formations ?? def.value?.sous_formations)
const erreursIci = computed(() => props.resolue?.erreurs.filter((e) => e.formation === props.instance.id) ?? [])

/* Listes déroulantes : le composant Selecteur attend des options plates, chaque
   liste est donc traduite ici plutôt que dans le gabarit. La seconde ligne d'une
   option dit ce qu'elle apporte : les stats de l'unité, ou la composition pour
   une formation. */
/** stats condensées d'une unité, dans l'ordre de la fiche de profil */
function statsUnite(id: string) {
  const u = props.idx.unites.get(id)
  if (!u) return undefined
  const stats = [
    u.vitesse && `Vit ${u.vitesse}`,
    u.blindage && `Bl ${u.blindage}`,
    u.cc && `CC ${u.cc}`,
    u.ff && `FF ${u.ff}`,
    // sans la capacité, le menu propose un transport sans dire combien il embarque
    u.transport && `transporte ${u.transport.capacite}`,
  ].filter(Boolean)
  // un personnage n'a pas de profil propre : ce sont ses notes qui disent ce qu'il apporte
  return [u.type, ...(stats.length ? stats : u.notes)].join(' · ')
}
/** le nom n'est repris devant les stats que si l'effet apporte plusieurs unités différentes */
function statsUnites(ids: string[]) {
  const uniques = [...new Set(ids)]
  const lignes = uniques.flatMap((id) => {
    const s = statsUnite(id)
    return s ? [uniques.length > 1 ? `${nomU(id)} : ${s}` : s] : []
  })
  return lignes.length ? lignes.join(' / ') : undefined
}
function statsEffet(e: any) {
  if (!e) return undefined
  if (e.type === 'ajouter') return statsUnites((e.unites ?? []).map((u: any) => u.unite))
  if (e.type === 'remplacer') return statsUnites([e.par])
  if (e.type === 'choix_multiple') return statsUnites((e.parmi ?? []).map((p: any) => p.unite))
  // une option à choix ouvre un second menu : annoncer les branches, pas leurs stats
  if (e.type === 'choix') return (e.parmi ?? []).map(libelleChoix).join(' ou ')
  if (e.type === 'mot_cle') return e.texte
  return undefined
}
/** composition d'une formation, variante par variante */
function compositions(fid: string) {
  const f = props.idx.formations.get(fid)
  return f ? lignesFormation(props.idx, f) : []
}
/** « transporte N », à accrocher à une composition : c'est au moment de choisir que la capacité manque */
function mentionPlaces(places: number) {
  return places ? `transporte ${places}` : ''
}
const optionsVariante = computed(() => {
  const lignes = def.value ? lignesFormation(props.idx, def.value) : []
  return (def.value?.variantes ?? []).map((v, i) => ({
    valeur: v.id,
    libelle: v.nom ?? v.id,
    detail: `${v.cout} pts`,
    stats: [lignes[i]?.composition, mentionPlaces(placesVariante(props.idx, v))].filter(Boolean).join(' · ') || undefined,
  }))
})
const optionsAjout = computed(() => ajoutables.value.map((o) => ({
  valeur: o.id,
  libelle: o.nom,
  detail: coutOption(o),
  titre: phraseOption(props.idx, o),
  stats: statsEffet(o.effet),
})))
const optionsSous = computed(() => (specSous.value?.parmi ?? []).map((fid) => {
  const f = props.idx.formations.get(fid)
  const places = f?.variantes[0] ? placesVariante(props.idx, f.variantes[0]) : 0
  return {
    valeur: fid,
    libelle: f?.nom ?? fid,
    detail: f ? `${f.variantes[0]?.cout} pts` : undefined,
    stats: [compositions(fid)[0]?.composition, mentionPlaces(places)].filter(Boolean).join(' · ') || undefined,
  }
}))
function optionsChoix(oi: FormationInstance['options'][number]) {
  const parmi = (props.idx.options.get(oi.option)?.effet as any)?.parmi ?? []
  return parmi.map((p: any) => ({ valeur: p.id, libelle: libelleChoix(p), detail: p.cout ? `${p.cout} pts` : undefined, stats: statsEffet(p.effet) }))
}
function optionsVarianteOption(oi: FormationInstance['options'][number]) {
  const variantes = (effetDe(oi) as any)?.variantes ?? []
  return variantes.map((v: any) => ({ valeur: v.id ?? v.nom, libelle: v.nom, detail: `${v.cout} pts`, stats: statsUnites((v.unites ?? []).map((u: any) => u.unite)) }))
}

function changerVariante(id: string) {
  props.instance.variante = id
  props.instance.choix = {}
}
function setChoix(ligne: number, unite: string, valeur: number) {
  if (!props.instance.choix[String(ligne)]) props.instance.choix[String(ligne)] = {}
  props.instance.choix[String(ligne)]![unite] = Math.min(Math.max(0, valeur), maxChoix(ligne, unite) ?? Infinity)
}
function maxChoix(ligne: number, unite: string) {
  const l = variante.value?.composition[ligne]
  if (!l || !('choix' in l)) return null
  const max = typeof l.choix.total === 'number' ? l.choix.total : l.choix.total.max
  const autres = Object.entries(props.instance.choix[String(ligne)] ?? {}).filter(([u]) => u !== unite).reduce((s, [, q]) => s + q, 0)
  return Math.max(0, max - autres)
}
/** ce qui est déjà placé sur une ligne de composition à choix, et s'il en faut encore */
function placesChoix(ligne: number) {
  return Object.values(props.instance.choix[String(ligne)] ?? {}).reduce((s, q) => s + q, 0)
}
function choixComplet(ligne: number) {
  const l = variante.value?.composition[ligne]
  if (!l || !('choix' in l)) return false
  return placesChoix(ligne) >= (typeof l.choix.total === 'number' ? l.choix.total : l.choix.total.min)
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
/** Quantités autorisées pour une unité qui se prend par lot indivisible (0 compris), sinon `null`. */
function paliersDe(oi: FormationInstance['options'][number], unite: string): number[] | null {
  const effet = effetDe(oi) as any
  const p = effet?.type === 'choix_multiple' ? effet.parmi.find((x: any) => x.unite === unite) : undefined
  if (!p?.paliers?.length) return null
  return [0, ...p.paliers.map((x: any) => x.nombre as number)].sort((a, b) => a - b)
}
function setRepartition(oi: FormationInstance['options'][number], unite: string, valeur: number) {
  if (!oi.repartition) oi.repartition = {}
  const plafond = props.resolue ? plafondRepartition(props.idx, props.resolue, oi, unite) : null
  let v = Math.min(Math.max(0, valeur), plafond ?? Infinity)
  // le compteur avance d'un cran : sur une unité par lot, ce cran saute au palier suivant
  const permis = paliersDe(oi, unite)
  if (permis && !permis.includes(v)) {
    const actuel = oi.repartition[unite] ?? 0
    v = v > actuel ? (permis.find((n) => n > actuel) ?? actuel) : ([...permis].reverse().find((n) => n < actuel) ?? actuel)
  }
  oi.repartition[unite] = v
}
function bornes(oi: FormationInstance['options'][number]) {
  return props.resolue ? bornesOption(props.idx, props.resolue, oi) : { min: 1, max: null }
}
function setQuantite(oi: FormationInstance['options'][number], valeur: number) {
  const b = bornes(oi)
  oi.quantite = Math.min(Math.max(b.min, valeur), b.max ?? Infinity)
}
function plafond(oi: FormationInstance['options'][number], unite: string) {
  return props.resolue ? plafondRepartition(props.idx, props.resolue, oi, unite) : null
}
function ajouterSous(fid: string) {
  if (!fid) return
  const f = props.idx.formations.get(fid)
  if (!f) return
  const options = optionsObligatoires(props.idx, fid).map((option) => ({ id: genererId('o'), option }))
  props.instance.sous_formations.push({ id: genererId('f'), formation: fid, variante: f.variantes[0]!.id, choix: {}, options, sous_formations: [] })
}
function retirerSous(id: string) {
  props.instance.sous_formations = props.instance.sous_formations.filter((s) => s.id !== id)
}
/**
 * Lignes d'améliorations préparées en une passe.
 * Le gabarit rappelait `effetDe` treize fois et `bornes` quatre fois par ligne,
 * à chaque re-rendu de la carte, donc à chaque frappe dans la liste.
 */
const lignesOptions = computed(() => props.instance.options.map((oi) => {
  const def = props.idx.options.get(oi.option)
  const effet = effetDe(oi) as any
  const cout = props.resolue?.options.find((o) => o.instance.id === oi.id)?.cout ?? 0
  const estChoix = def?.effet.type === 'choix'
  const aVariantes = effet?.type === 'ajouter' && !!effet.variantes?.length
  const quantifiable = (effet?.type === 'ajouter' && effet.cout_par_unite !== undefined)
    || (effet?.type === 'remplacer' && !effet.tout && effet.max !== 'tout')
  const repartition = effet?.type === 'choix_multiple'
    ? (effet.parmi as any[]).map((p) => ({
        ...p,
        detail: p.paliers?.length
          ? p.paliers.map((x: any) => `${x.cout} pts par ${x.nombre}`).join(', ')
          : p.cout ? `${p.cout} pts` : '',
      }))
    : null
  return {
    oi,
    nom: def?.nom,
    cout,
    estChoix,
    aVariantes,
    quantifiable,
    repartition,
    // avec deux menus sur la ligne, le coût ne s'affiche que dans le premier
    detail: `${cout} pts`,
    detailVariante: estChoix ? undefined : `${cout} pts`,
    /** vrai quand la ligne porte un menu : le coût s'y loge, la colonne de droite disparaît */
    aSelecteur: estChoix || aVariantes,
    bornes: quantifiable ? bornes(oi) : { min: 1, max: null as number | null },
    choix: estChoix ? optionsChoix(oi) : [],
    variantes: aVariantes ? optionsVarianteOption(oi) : [],
  }
}))

const unitesVisibles = computed(() => props.resolue?.unites.filter((u) => !u.implicite) ?? [])

/**
 * Places apportées par une ligne d'unités, quand ce sont des transports.
 * La composition dit « + transports » et la carte se contentait du nombre de
 * véhicules résolus : rien ne disait combien de figurines ils embarquent.
 */
function places(unite: string, nombre: number) {
  const capacite = props.idx.unites.get(unite)?.transport?.capacite
  return capacite ? capacite * nombre : 0
}

/**
 * Ligne de résumé d'une carte repliée : sans elle, l'entête ne dit que le nom et
 * le coût, et rien ne distingue deux formations identiques réglées différemment.
 */
const resume = computed(() => {
  if (!replie.value) return ''
  const unites = unitesVisibles.value.map((u) => `${u.nombre} ${u.nombre > 1 ? pluriel(u.nom) : u.nom}`).join(', ')
  const n = props.instance.options.length
  return [unites, n ? `${n} amélioration${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')
})

/** profils dépliés sous la composition : les unités réellement présentes, avec leur nombre */
const profilsOuverts = ref(false)
const profils = computed(() => {
  const compte = new Map<string, number>()
  for (const u of props.resolue?.unites ?? []) compte.set(u.unite, (compte.get(u.unite) ?? 0) + u.nombre)
  return [...compte.entries()].flatMap(([id, n]) => { const u = props.idx.unites.get(id); return u ? [{ unite: u, nombre: n }] : [] })
})
</script>

<template>
  <div v-if="def && variante" class="rounded-lg border bg-surface-light" :class="[sous ? 'border-white/10' : 'border-white/15', erreursIci.length ? 'ring-1 ring-red-500/60' : '']">
    <div class="flex items-start justify-between gap-3 px-4 py-3" :class="replie ? '' : 'border-b border-white/10'">
      <div class="flex min-w-0 flex-1 items-start gap-2">
        <slot name="poignee" />
        <component
          :is="pliable ? 'button' : 'div'"
          :type="pliable ? 'button' : undefined"
          class="min-w-0 flex-1 text-left"
          :title="pliable ? (ouvert ? 'Replier' : 'Déplier') : undefined"
          @click="pliable && emit('basculer')"
        >
          <p class="text-[11px] uppercase tracking-wider text-stone-500">{{ resolue?.section.titre }}</p>
          <h3 class="font-heading text-lg font-semibold text-white">
            {{ def.nom }}<span v-if="pliable" class="ml-1 text-xs font-normal text-stone-500">{{ ouvert ? '▴' : '▾' }}</span>
          </h3>
          <p v-if="resume" class="truncate text-xs text-stone-400">{{ resume }}</p>
        </component>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="font-heading text-xl text-gold">{{ resolue?.cout ?? variante.cout }} <span class="text-xs text-stone-400">pts</span></span>
        <button v-if="!sous" type="button" class="bouton-ghost" title="Dupliquer" @click="emit('dupliquer')">⧉</button>
        <button type="button" class="bouton-ghost text-red-300" title="Retirer" @click="emit('supprimer')">✕</button>
      </div>
    </div>

    <div v-show="!replie" class="carte-corps space-y-3 px-4 py-3 text-sm">
      <!-- variante de la formation : pleine largeur, au-dessus de la composition -->
      <Selecteur v-if="def.variantes.length > 1" bloc :model-value="instance.variante" :options="optionsVariante" @choisir="changerVariante" />

      <!-- choix de composition -->
      <template v-for="(l, li) in variante.composition" :key="li">
        <div v-if="'choix' in l" class="rounded border border-white/10 bg-black/20 p-3">
          <p class="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span class="text-stone-400">
              Choisir {{ typeof l.choix.total === 'number' ? l.choix.total : `${l.choix.total.min} à ${l.choix.total.max}` }}
              <template v-if="l.choix.parmi.some((p) => p.par_pioche > 1)"> (par lot)</template> :
            </span>
            <span :class="choixComplet(li) ? 'text-emerald-300' : 'text-gold'">{{ placesChoix(li) }} placé(s)</span>
          </p>
          <!-- une ligne par unité possible : côte à côte, on ne voyait plus que les champs, pas les noms -->
          <ul class="space-y-1.5">
            <li v-for="(p, pi) in l.choix.parmi" :key="p.unite" class="flex items-center gap-2">
              <span class="w-5 shrink-0 text-right text-[11px] italic text-stone-600">{{ pi ? 'ou' : '' }}</span>
              <Compteur
                :model-value="instance.choix[String(li)]?.[p.unite] ?? 0"
                :max="maxChoix(li, p.unite)"
                :libelle="nomU(p.unite)"
                @update:model-value="setChoix(li, p.unite, $event)"
              />
              <span class="min-w-0 flex-1 text-stone-200">{{ p.par_pioche > 1 ? `${p.par_pioche} ` : '' }}{{ nomU(p.unite) }}</span>
              <span v-if="p.cout" class="shrink-0 text-xs text-stone-400">{{ p.cout }} pts</span>
            </li>
          </ul>
        </div>
      </template>

      <!-- unités résolues -->
      <div v-if="unitesVisibles.length">
        <p class="flex flex-wrap items-baseline gap-x-2 text-stone-300">
          <span>
            <span v-for="(u, ui) in unitesVisibles" :key="ui">{{ ui ? ', ' : '' }}<span :class="u.origine === 'base' || u.origine === 'choix' ? '' : 'text-gold-light'">{{ u.nombre }} {{ u.nombre > 1 ? pluriel(u.nom) : u.nom }}</span><span v-if="places(u.unite, u.nombre)" class="text-stone-500"> ({{ places(u.unite, u.nombre) }} place{{ places(u.unite, u.nombre) > 1 ? 's' : '' }})</span></span>
            <span v-if="resolue?.mots_cles.length" class="text-stone-400"> · {{ resolue.mots_cles.join(', ') }}</span>
          </span>
          <button v-if="profils.length" type="button" class="shrink-0 text-xs text-gold hover:underline" @click="profilsOuverts = !profilsOuverts">
            {{ profilsOuverts ? 'Cacher les caractéristiques' : 'Afficher les caractéristiques' }} {{ profilsOuverts ? '▴' : '▾' }}
          </button>
        </p>
        <div v-if="profilsOuverts" class="mt-2 space-y-2">
          <CodexUniteProfil v-for="p in profils" :key="p.unite.id" :idx="idx" :unite="p.unite" :nombre="p.nombre" compact />
        </div>
      </div>

      <!-- options -->
      <div v-if="dispo.length" class="space-y-2">
        <div v-for="l in lignesOptions" :key="l.oi.id" class="rounded border border-white/10 bg-black/20 px-3 py-2">
          <!-- ligne de tête : nom, menu, coût, retrait -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium text-stone-100">{{ l.nom }}</span>
            <Selecteur v-if="l.estChoix" v-model="l.oi.choix" class="flex-1 basis-40" :options="l.choix" :detail-actuel="l.detail" />
            <Selecteur v-if="l.aVariantes" v-model="l.oi.variante" class="flex-1 basis-40" :options="l.variantes" :detail-actuel="l.detailVariante" />
            <span v-if="!l.aSelecteur" class="ml-auto text-gold">{{ l.cout }} pts</span>
            <button type="button" class="bouton-ghost shrink-0 text-red-300" title="Retirer" @click="retirerOption(l.oi.id)">✕</button>
          </div>

          <!-- quantités : sur leur propre ligne, elles débordaient de la ligne de tête -->
          <div
            v-if="l.quantifiable || l.repartition"
            class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/5 pt-2"
          >
            <span v-if="l.quantifiable" class="flex items-center gap-2 text-xs text-stone-400">
              ×<Compteur
                :model-value="l.oi.quantite ?? l.bornes.min"
                :min="l.bornes.min"
                :max="l.bornes.max"
                :libelle="l.nom"
                @update:model-value="setQuantite(l.oi, $event)"
              />
              <span v-if="l.bornes.max !== null" class="text-stone-500">sur {{ l.bornes.max }}</span>
            </span>
            <span v-for="p in l.repartition" :key="p.unite" class="flex items-center gap-2 text-xs text-stone-300">
              <Compteur
                :model-value="l.oi.repartition?.[p.unite] ?? 0"
                :max="plafond(l.oi, p.unite)"
                :libelle="nomU(p.unite)"
                @update:model-value="setRepartition(l.oi, p.unite, $event)"
              />
              <span>{{ nomU(p.unite) }}<span v-if="p.detail" class="text-stone-500"> · {{ p.detail }}</span></span>
            </span>
          </div>
        </div>
        <Selecteur v-if="ajoutables.length" action bloc placeholder="+ Ajouter une amélioration…" :options="optionsAjout" @choisir="ajouterOption" />
        <p v-else-if="instance.options.length" class="text-xs text-stone-500">Plus d'amélioration disponible pour cette formation.</p>
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
        <Selecteur action bloc placeholder="+ Ajouter…" :options="optionsSous" @choisir="ajouterSous" />
      </div>

      <ul v-if="erreursIci.length" class="space-y-1 text-xs text-red-300">
        <li v-for="(e, ei) in erreursIci" :key="ei">⚠ {{ e.message }}</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.bouton-ghost { @apply rounded px-2 py-1 text-stone-400 hover:bg-white/10 hover:text-white; }
/* une carte repliée doit quand même s'imprimer : la feuille l'emporte sur le `display` en ligne de `v-show` */
@media print {
  .carte-corps { display: block !important; }
}
</style>
