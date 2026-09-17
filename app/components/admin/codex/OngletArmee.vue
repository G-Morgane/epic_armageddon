<script setup lang="ts">
const codex = useBrouillonCodex()
const meta = computed(() => codex.value.codex)

function ajouterRegle() {
  ;(meta.value.regles_md ??= []).push({ titre: 'Règle spéciale : ', texte: '' })
}
function retirerRegle(i: number) {
  meta.value.regles_md!.splice(i, 1)
}
function ajouterException() {
  ;(meta.value.initiative.exceptions ??= []).push({ portee: '', valeur: '1+' })
}
function ajouterBudget() {
  ;(codex.value.budgets ??= []).push({ id: idUnique('budget', codex.value.budgets ?? []), libelle: 'Nouveau budget', capacite: { source: 'fournitures' } })
}
const sources = [
  { v: 'fournitures', l: 'places ouvertes par les formations' },
  { v: 'ratio_points', l: 'fraction des points de la liste' },
  { v: 'par_tranche', l: '1 par tranche de N points' },
  { v: 'fixe', l: 'nombre fixe' },
]
function changerSource(b: { capacite: Record<string, unknown> }, source: string) {
  if (source === 'fournitures') b.capacite = { source }
  else if (source === 'ratio_points') b.capacite = { source, ratio: 0.3334, base: 'limite_liste' }
  else if (source === 'par_tranche') b.capacite = { source, points: 1000 }
  else b.capacite = { source, valeur: 1 }
}
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="carte">
      <h3 class="titre-carte">Identité</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <label class="champ-label">Nom<input v-model="meta.nom" class="champ"></label>
        <label class="champ-label">Version<input v-model="meta.version" class="champ"></label>
        <label class="champ-label">Faction
          <select v-model="meta.faction" class="champ"><option value="imperium">Imperium</option><option value="chaos">Chaos</option><option value="xenos">Xenos</option></select>
        </label>
        <label class="champ-label">Statut
          <select v-model="meta.statut" class="champ"><option value="official">Officiel</option><option value="beta">Bêta</option><option value="experimental">Expérimental</option><option value="30k">30k</option></select>
        </label>
        <label class="champ-label">Couleur<input v-model="meta.couleur" type="color" class="champ h-9 p-1"></label>
        <label class="champ-label">Valeur stratégique<input v-model="meta.valeur_strategique" class="champ"></label>
        <label class="champ-label">Initiative par défaut<input v-model="meta.initiative.defaut" class="champ w-24"></label>
      </div>
      <div class="mt-3">
        <p class="mb-1 text-xs uppercase tracking-wider text-gray-500">Exceptions d'initiative</p>
        <div v-for="(e, i) in meta.initiative.exceptions" :key="i" class="mb-1 flex gap-2">
          <input v-model="e.portee" class="champ flex-1" placeholder="Soutiens de l'Adeptus Titanicus">
          <input v-model="e.valeur" class="champ w-20" placeholder="1+">
          <button type="button" class="text-gray-500 hover:text-red-300" @click="meta.initiative.exceptions!.splice(i, 1)">✕</button>
        </div>
        <button type="button" class="lien" @click="ajouterException">+ Ajouter une exception</button>
      </div>
    </section>

    <section class="carte">
      <h3 class="titre-carte">Citation et crédits</h3>
      <label class="champ-label">Citation<textarea :value="meta.citation?.texte" rows="3" class="champ" @input="meta.citation = { ...(meta.citation ?? {}), texte: ($event.target as HTMLTextAreaElement).value }" /></label>
      <label class="champ-label mt-2">Auteur<input :value="meta.citation?.auteur" class="champ" @input="meta.citation = { texte: meta.citation?.texte ?? '', auteur: ($event.target as HTMLInputElement).value }"></label>
      <label class="champ-label mt-2">Crédits (bas de page)<textarea v-model="meta.credits" rows="2" class="champ" /></label>
    </section>

    <section class="carte lg:col-span-2">
      <h3 class="titre-carte">Utiliser la liste d'armée <span class="text-xs font-normal text-gray-500">(texte d'introduction, paragraphes séparés par une ligne vide)</span></h3>
      <textarea v-model="meta.intro_md" rows="7" class="champ font-body text-base" />
    </section>

    <section class="carte lg:col-span-2">
      <h3 class="titre-carte">Règles spéciales <span class="text-xs font-normal text-gray-500">(texte libre, affiché dans le PDF)</span></h3>
      <div v-for="(r, i) in meta.regles_md" :key="i" class="mb-3 rounded-md border border-white/10 p-3">
        <div class="flex gap-2">
          <input v-model="r.titre" class="champ flex-1 font-semibold" placeholder="Règle spéciale : …">
          <button type="button" class="text-gray-500 hover:text-red-300" @click="retirerRegle(i)">✕</button>
        </div>
        <textarea v-model="r.texte" rows="4" class="champ mt-2 font-body text-base" />
      </div>
      <button type="button" class="lien" @click="ajouterRegle">+ Ajouter une règle spéciale</button>
    </section>

    <section class="carte lg:col-span-2">
      <h3 class="titre-carte">Budgets <span class="text-xs font-normal text-gray-500">(places d'appui, quota rare, commissaires gratuits… utilisés par les règles « Ouvre » et « Compte dans »)</span></h3>
      <div v-for="(b, i) in codex.budgets" :key="b.id" class="mb-2 grid gap-2 rounded-md border border-white/10 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <label class="champ-label">Libellé<input v-model="b.libelle" class="champ"></label>
        <label class="champ-label">Capacité
          <select :value="b.capacite.source" class="champ" @change="changerSource(b as any, ($event.target as HTMLSelectElement).value)">
            <option v-for="s in sources" :key="s.v" :value="s.v">{{ s.l }}</option>
          </select>
        </label>
        <div class="champ-label">
          <template v-if="b.capacite.source === 'ratio_points'">Fraction<input v-model.number="(b.capacite as any).ratio" type="number" step="0.01" class="champ"></template>
          <template v-else-if="b.capacite.source === 'par_tranche'">Points par tranche<input v-model.number="(b.capacite as any).points" type="number" class="champ"><input v-model="(b.capacite as any).perimetre" class="champ mt-1" placeholder="section:compagnies (optionnel)"></template>
          <template v-else-if="b.capacite.source === 'fixe'">Valeur<input v-model.number="(b.capacite as any).valeur" type="number" class="champ"></template>
          <template v-else>Phrase du PDF<input v-model="b.phrase_pdf" class="champ" placeholder="Jusqu'à 2 formations d'appui par compagnie"></template>
        </div>
        <button type="button" class="self-end pb-2 text-gray-500 hover:text-red-300" @click="codex.budgets!.splice(i, 1)">✕</button>
        <label v-if="b.capacite.source !== 'fournitures'" class="champ-label sm:col-span-3">Phrase du PDF<input v-model="b.phrase_pdf" class="champ"></label>
      </div>
      <button type="button" class="lien" @click="ajouterBudget">+ Ajouter un budget</button>
    </section>
  </div>
</template>

<style scoped>
.carte { @apply rounded-lg border border-gold/10 bg-surface-light p-5; }
.titre-carte { @apply mb-3 font-heading text-base font-semibold text-gold; }
.champ-label { @apply flex flex-col gap-1 text-xs text-gray-400; }
.champ { @apply rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100 focus:border-gold focus:outline-none; }
.lien { @apply text-sm text-gold hover:underline; }
</style>
