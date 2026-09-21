<script setup lang="ts">
import type { Codex } from '~~/shared/codex/schema'
import { indexerCodex, calculerListe, optionsObligatoires, plafondFormation, type ResultatListe } from '~~/shared/codex/engine'
import type { Liste, FormationInstance } from '~~/shared/codex/liste'
import { genererId } from '~~/shared/codex/liste'
import { lignesFormation, prefixeFormation } from '~~/shared/codex/phrases'

const route = useRoute()
const slug = route.params.slug as string
const brouillon = route.query.brouillon ? '?brouillon=1' : ''
const { data: codex, error } = await useFetch<Codex>(`/api/codex/${slug}${brouillon}`)
if (error.value || !codex.value) throw createError({ statusCode: 404, statusMessage: 'Codex introuvable' })
const c = codex.value
const idx = indexerCodex(c)
useHead({ title: `Builder ${c.codex.nom}` })

const cle = `builder:${slug}`
const liste = ref<Liste>({ id: genererId('l'), nom: `Ma liste ${c.codex.nom}`, codex: slug, limite: 3000, formations: [] })
const pret = ref(false)
onMounted(() => {
  try {
    const brut = localStorage.getItem(cle)
    if (brut) liste.value = JSON.parse(brut)
  } catch { /* stockage indisponible */ }
  pret.value = true
})
watch(liste, (l) => { if (pret.value) try { localStorage.setItem(cle, JSON.stringify(l)) } catch { /* ignore */ } }, { deep: true })

const resultat = computed<ResultatListe>(() => calculerListe(idx, liste.value))
const resolueDe = (id: string) => resultat.value.formations.find((f) => f.instance.id === id)
const compteArmee = (optionId: string) => {
  let n = 0
  const parcourir = (f: FormationInstance) => { n += f.options.filter((o) => o.option === optionId).length; f.sous_formations.forEach(parcourir) }
  liste.value.formations.forEach(parcourir)
  return n
}

const sectionsCatalogue = computed(() => c.sections.filter((s) => !s.contraintes.some((k) => k.type === 'non_autonome')))
/** accordéon du catalogue : sections dépliées (la première par défaut), mémorisé par codex */
const cleAccordeon = `builder:${slug}:sections`
const ouvertes = ref<string[]>([sectionsCatalogue.value[0]?.id ?? ''])
onMounted(() => { try { const v = localStorage.getItem(cleAccordeon); if (v) ouvertes.value = JSON.parse(v) } catch { /* ignore */ } })
function basculer(id: string) {
  ouvertes.value = ouvertes.value.includes(id) ? ouvertes.value.filter((x) => x !== id) : [...ouvertes.value, id]
  try { localStorage.setItem(cleAccordeon, JSON.stringify(ouvertes.value)) } catch { /* ignore */ }
}
const nbDansListe = (sectionId: string) => resultat.value.formations.filter((f) => f.section.id === sectionId).length

/** nombre de fois qu'une formation figure déjà dans l'armée (sous-formations comprises) */
function compteFormation(fid: string) {
  let n = 0
  const parcourir = (f: FormationInstance) => { if (f.formation === fid) n += 1; f.sous_formations.forEach(parcourir) }
  liste.value.formations.forEach(parcourir)
  return n
}
/** limite atteinte : le bouton d'ajout du catalogue est désactivé */
function plafondAtteint(fid: string) {
  const max = plafondFormation(idx, fid)
  return max !== null && compteFormation(fid) >= max
}
/** formation dépliée dans le catalogue : sa composition (les profils sont sur les cartes de la liste) */
const detail = ref<string | null>(null)

function ajouter(fid: string, variante?: string) {
  const f = idx.formations.get(fid)
  if (!f) return
  const options = optionsObligatoires(idx, fid).map((option) => ({ id: genererId('o'), option }))
  liste.value.formations.push({ id: genererId('f'), formation: fid, variante: variante ?? f.variantes[0]!.id, choix: {}, options, sous_formations: [] })
}
function supprimer(id: string) {
  liste.value.formations = liste.value.formations.filter((f) => f.id !== id)
}
function dupliquer(id: string) {
  const src = liste.value.formations.find((f) => f.id === id)
  if (!src) return
  const copie: FormationInstance = JSON.parse(JSON.stringify(src))
  const renommer = (f: FormationInstance) => { f.id = genererId('f'); f.options.forEach((o) => (o.id = genererId('o'))); f.sous_formations.forEach(renommer) }
  renommer(copie)
  const i = liste.value.formations.findIndex((f) => f.id === id)
  liste.value.formations.splice(i + 1, 0, copie)
}
function vider() {
  if (confirm('Vider la liste ?')) liste.value.formations = []
}
function imprimer() { window.print() }

const erreursGlobales = computed(() => resultat.value.erreurs.filter((e) => !e.formation))
const pourcentage = (b: { utilise: number; capacite: number }) => (b.capacite ? Math.min(100, Math.round((b.utilise / b.capacite) * 100)) : b.utilise ? 100 : 0)
</script>

<template>
  <div class="mx-auto max-w-7xl px-4 py-8">
    <div class="flex flex-wrap items-end justify-between gap-4 impression-cacher">
      <div>
        <NuxtLink to="/codex-test" class="text-xs uppercase tracking-widest text-gold hover:underline">← Codex</NuxtLink>
        <h1 class="mt-1 font-heading text-3xl font-bold text-white">Builder · {{ c.codex.nom }} <span class="text-base font-normal text-stone-400">v{{ c.codex.version }}</span></h1>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <input v-model="liste.nom" class="champ w-56" placeholder="Nom de la liste">
        <label class="flex items-center gap-2 text-sm text-stone-300">Limite <input v-model.number="liste.limite" type="number" step="250" min="250" class="champ w-24"> pts</label>
        <button type="button" class="rounded border border-white/20 px-3 py-1.5 text-sm text-stone-200 hover:bg-white/5" @click="imprimer">Imprimer</button>
        <button type="button" class="rounded border border-red-400/40 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/10" @click="vider">Vider</button>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[280px_1fr_260px]">
      <!-- Catalogue -->
      <aside class="space-y-2 impression-cacher">
        <div v-for="s in sectionsCatalogue" :key="s.id" class="rounded border border-white/10 bg-surface-light">
          <button type="button" class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left" @click="basculer(s.id)">
            <span class="font-heading text-xs uppercase tracking-wider text-gold">{{ s.titre }}</span>
            <span class="flex shrink-0 items-center gap-2 text-xs text-stone-500">
              <span v-if="nbDansListe(s.id)" class="rounded-full bg-gold/15 px-1.5 py-0.5 text-gold">{{ nbDansListe(s.id) }}</span>
              <span>{{ s.formations.length }}</span>
              <span class="text-stone-400">{{ ouvertes.includes(s.id) ? '▴' : '▾' }}</span>
            </span>
          </button>
          <ul v-show="ouvertes.includes(s.id)" class="divide-y divide-white/5 border-t border-white/10">
            <li v-for="fid in s.formations" :key="fid" class="text-sm">
              <div class="flex items-center justify-between gap-2 px-3 py-2">
                <button type="button" class="min-w-0 flex-1 text-left" :title="detail === fid ? 'Replier' : 'Voir la composition'" @click="detail = detail === fid ? null : fid">
                  <p class="flex items-center gap-1 text-stone-100"><span class="truncate">{{ prefixeFormation(idx, idx.formations.get(fid)!) }}{{ idx.formations.get(fid)!.nom }}</span><span class="shrink-0 text-[10px] text-stone-500">{{ detail === fid ? '▴' : '▾' }}</span></p>
                  <p class="text-xs text-stone-500">{{ idx.formations.get(fid)!.variantes.map((v) => v.cout).filter((x, i, a) => a.indexOf(x) === i).join(' / ') }} pts</p>
                </button>
                <button
                  type="button"
                  class="shrink-0 rounded px-2 py-0.5 font-bold"
                  :class="plafondAtteint(fid) ? 'cursor-not-allowed bg-white/5 text-stone-600' : 'bg-gold/90 text-surface hover:bg-gold-light'"
                  :disabled="plafondAtteint(fid)"
                  :title="plafondAtteint(fid) ? `Limite atteinte : au plus ${plafondFormation(idx, fid)} dans l'armée` : 'Ajouter à la liste'"
                  @click="ajouter(fid)"
                >+</button>
              </div>
              <div v-if="detail === fid" class="space-y-1 border-t border-white/5 bg-black/10 px-3 py-2">
                <p v-for="(l, li) in lignesFormation(idx, idx.formations.get(fid)!)" :key="li" class="text-xs text-stone-300"><span v-if="l.nom" class="text-gold">{{ l.nom }} : </span>{{ l.composition }} <span class="text-stone-500">· {{ l.cout }}</span></p>
                <p class="text-[11px] text-stone-500">Les profils s'affichent sur la carte, une fois la formation ajoutée.</p>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Liste -->
      <main class="space-y-3">
        <div class="impression-seulement mb-4">
          <h1 class="font-heading text-2xl font-bold">{{ liste.nom }}</h1>
          <p>{{ c.codex.nom }} v{{ c.codex.version }} · {{ resultat.total }} / {{ liste.limite }} pts</p>
        </div>
        <p v-if="!liste.formations.length" class="rounded border border-dashed border-white/15 p-8 text-center text-stone-400">
          Ajoutez des formations depuis le catalogue à gauche.
        </p>
        <ClientOnly>
          <CodexFormationCarte
            v-for="f in liste.formations"
            :key="f.id"
            :idx="idx"
            :instance="f"
            :resolue="resolueDe(f.id)"
            :compte-armee="compteArmee"
            @supprimer="supprimer(f.id)"
            @dupliquer="dupliquer(f.id)"
          />
        </ClientOnly>
      </main>

      <!-- Bilan -->
      <aside class="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div class="rounded-lg border border-white/15 bg-surface-light p-4">
          <p class="text-xs uppercase tracking-wider text-stone-400">Total</p>
          <p class="font-heading text-3xl font-bold" :class="resultat.total > liste.limite ? 'text-red-300' : 'text-white'">
            {{ resultat.total }} <span class="text-base font-normal text-stone-400">/ {{ liste.limite }} pts</span>
          </p>
          <p class="mt-1 text-sm" :class="resultat.valide ? 'text-emerald-300' : 'text-red-300'">
            {{ resultat.valide ? '✓ Liste valide' : `${resultat.erreurs.length} problème(s)` }}
          </p>
          <p class="mt-1 text-xs text-stone-500">{{ resultat.formations.filter((f) => f.activation).length }} activation(s)</p>
        </div>

        <div v-if="resultat.budgets.length" class="rounded-lg border border-white/15 bg-surface-light p-4">
          <p class="mb-3 text-xs uppercase tracking-wider text-stone-400">Budgets</p>
          <div v-for="b in resultat.budgets" :key="b.id" class="mb-3">
            <div class="flex justify-between text-xs text-stone-300">
              <span>{{ b.libelle }}</span>
              <span :class="b.utilise > b.capacite ? 'text-red-300' : ''">{{ b.utilise }} / {{ b.capacite }} {{ b.unite === 'points' ? 'pts' : '' }}</span>
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded bg-white/10">
              <div class="h-full" :class="b.utilise > b.capacite ? 'bg-red-400' : 'bg-gold'" :style="{ width: pourcentage(b) + '%' }" />
            </div>
          </div>
        </div>

        <div v-if="erreursGlobales.length" class="rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">
          <p class="mb-2 text-xs uppercase tracking-wider">À corriger</p>
          <ul class="space-y-1">
            <li v-for="(e, i) in erreursGlobales" :key="i">⚠ {{ e.message }}</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.champ { @apply rounded border border-white/15 bg-surface px-2 py-1 text-sm text-stone-100 focus:border-gold focus:outline-none; }
.impression-seulement { display: none; }
@media print {
  .impression-cacher, aside { display: none !important; }
  .impression-seulement { display: block; }
  :global(html), :global(body) { background: #fff !important; color: #111 !important; }
  main { color: #111; }
}
</style>
