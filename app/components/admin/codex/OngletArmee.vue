<script setup lang="ts">
const codex = useBrouillonCodex()
const meta = computed(() => codex.value.codex)

const { uploadImage } = useUploadPdf()
/* Couverture et icône s'envoient pareil : même dépôt, seul le champ visé change. */
const envoi = ref<'illustration' | 'logo' | null>(null)
const erreurImage = ref('')
async function envoyerImage(e: Event, champ: 'illustration' | 'logo', suffixe: string) {
  const input = e.target as HTMLInputElement
  const fichier = input.files?.[0]
  if (!fichier) return
  envoi.value = champ
  erreurImage.value = ''
  try {
    const ext = fichier.name.split('.').pop()?.toLowerCase() || 'jpg'
    meta.value[champ] = await uploadImage(fichier, `codex/${meta.value.slug}-${suffixe}.${ext}`)
  } catch (err) {
    erreurImage.value = (err as Error).message
  } finally {
    envoi.value = null
    input.value = ''
  }
}

/* Rattachement à la fiche d'armée publique : la page /armees cherche d'abord par
   `armee_id`, et seulement à défaut par le nom. Sans ce champ, un codex créé ici
   n'avait aucun moyen d'être relié autrement que par une coïncidence de nom. */
const { data: armees } = await useFetch<{ id: string; name: string }[]>('/api/armies', {
  query: { status: 'official,beta,experimental,30k,archived' },
  default: () => [],
})
const armeeInconnue = computed(() => {
  const id = meta.value.armee_id
  return id && !(armees.value ?? []).some((a) => a.id === id) ? id : ''
})

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
  <!--
    Trois blocs, un par question posée à celui qui remplit : de quelle armée
    parle-t-on, comment elle se joue, à quoi elle ressemble. Une seule colonne de
    lecture : en deux colonnes, les cartes de hauteurs différentes laissaient un
    trou à droite et cassaient l'ordre de lecture.
  -->
  <div class="space-y-8">
    <section>
      <h3 class="titre-bloc">Identité</h3>
      <p class="sous-titre-bloc">Ce qui désigne l'armée, ici comme sur le site.</p>
      <div class="carte mt-3">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="champ-label">Nom<input v-model="meta.nom" class="champ"></label>
          <label class="champ-label">Version<input v-model="meta.version" class="champ"></label>
          <label class="champ-label">Faction
            <select v-model="meta.faction" class="champ"><option value="imperium">Imperium</option><option value="chaos">Chaos</option><option value="xenos">Xenos</option></select>
          </label>
          <label class="champ-label">Type
            <select v-model="meta.type" class="champ"><option value="armee">Armée jouable</option><option value="soutien">Liste de soutien partagée (alliance)</option></select>
          </label>
          <label class="champ-label">Statut
            <select v-model="meta.statut" class="champ"><option value="official">Officiel</option><option value="beta">Bêta</option><option value="experimental">Expérimental</option><option value="30k">30k</option></select>
          </label>
          <label class="champ-label">Couleur<input v-model="meta.couleur" type="color" class="champ h-9 p-1"></label>
          <label class="champ-label sm:col-span-2">Fiche d'armée du site
            <select v-model="meta.armee_id" class="champ">
              <option :value="undefined">Aucune (rattachement par le nom)</option>
              <option v-if="armeeInconnue" :value="armeeInconnue">Armée inconnue ({{ armeeInconnue }})</option>
              <option v-for="a in armees" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
            <span class="aide">Sans rattachement, le site s'en remet au nom exact.</span>
          </label>
        </div>
      </div>
    </section>

    <section>
      <h3 class="titre-bloc">Règles du codex</h3>
      <p class="sous-titre-bloc">Ce que le constructeur d'armée applique quand on monte une liste.</p>

      <div class="carte mt-3">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label class="champ-label">Valeur stratégique<input v-model="meta.valeur_strategique" class="champ"></label>
          <label class="champ-label">Initiative par défaut<input v-model="meta.initiative.defaut" class="champ"></label>
        </div>

        <div class="mt-5 border-t border-white/5 pt-4">
          <p class="mb-2 text-xs uppercase tracking-wider text-gray-500">Exceptions d'initiative</p>
          <!-- En-têtes de colonnes : les deux champs affichent « 1+ » et « 2+ », le
               placeholder qui disait lequel était la portée disparaît dès la saisie. -->
          <!-- Largeurs portées par des conteneurs, pas par les champs : `.champ` applique
               `w-full`, et cette règle scopée passe après les utilitaires Tailwind, donc un
               `w-20` posé sur l'input ne prend pas. La portée tombait à 26 px. -->
          <div v-if="meta.initiative.exceptions?.length" class="mb-1 flex gap-2 text-[11px] uppercase tracking-wider text-gray-600">
            <span class="flex-1">Ce qu'elle vise</span>
            <span class="w-24 shrink-0">Initiative</span>
            <span class="w-6 shrink-0" />
          </div>
          <div v-for="(e, i) in meta.initiative.exceptions" :key="i" class="mb-1 flex gap-2">
            <div class="min-w-0 flex-1"><input v-model="e.portee" class="champ" placeholder="Soutiens de l'Adeptus Titanicus"></div>
            <div class="w-24 shrink-0"><input v-model="e.valeur" class="champ" placeholder="1+"></div>
            <button type="button" class="w-6 shrink-0 text-gray-500 hover:text-red-300" @click="meta.initiative.exceptions!.splice(i, 1)">✕</button>
          </div>
          <p v-if="!meta.initiative.exceptions?.length" class="mb-1 text-xs text-gray-600">Aucune : toutes les formations utilisent l'initiative par défaut.</p>
          <button type="button" class="lien" @click="ajouterException">+ Ajouter une exception</button>
        </div>

        <div class="mt-5 border-t border-white/5 pt-4">
          <p class="text-xs uppercase tracking-wider text-gray-500">Budgets</p>
          <p class="aide mb-2">Places d'appui, quota rare, commissaires gratuits… ce que visent les règles « Ouvre » et « Compte dans ».</p>
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
        </div>
      </div>
    </section>

    <section>
      <h3 class="titre-bloc">Images du PDF <span class="text-sm font-normal text-gray-500">(optionnelles)</span></h3>
      <p class="sous-titre-bloc">Les textes imprimés sont dans l'onglet « Texte du PDF ».</p>

      <div class="carte mt-3 grid gap-6 lg:grid-cols-2">
        <div>
          <p class="mb-2 text-xs uppercase tracking-wider text-gray-500">Couverture</p>
          <div class="flex items-start gap-3">
            <div class="flex h-24 w-[68px] shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/30 text-[10px] text-gray-600">
              <img v-if="meta.illustration" :src="meta.illustration" alt="" class="h-full w-full object-cover">
              <span v-else>Aucune</span>
            </div>
            <div class="min-w-0 flex-1">
              <input v-model="meta.illustration" class="champ w-full" placeholder="https://…/imperium/black-templars.jpg">
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <label class="lien cursor-pointer">
                  {{ envoi === 'illustration' ? 'Envoi…' : 'Choisir une image…' }}
                  <input type="file" accept="image/*" class="hidden" :disabled="!!envoi" @change="envoyerImage($event, 'illustration', 'couverture')">
                </label>
                <button v-if="meta.illustration" type="button" class="text-xs text-gray-500 hover:text-red-300" @click="meta.illustration = undefined">Retirer</button>
              </div>
              <p class="aide mt-1">Format portrait conseillé (environ 1450 × 2050). L'image occupe toute la page, le titre du codex se pose dessus. Sans illustration, la couverture garde son fond blanc.</p>
            </div>
          </div>
        </div>

        <div>
          <p class="mb-2 text-xs uppercase tracking-wider text-gray-500">Icône de l'armée</p>
          <div class="flex items-start gap-3">
            <div class="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded border border-white/10 bg-black/30 text-[10px] text-gray-600">
              <img v-if="meta.logo" :src="meta.logo" alt="" class="h-full w-full object-contain p-1">
              <span v-else>Aucune</span>
            </div>
            <div class="min-w-0 flex-1">
              <input v-model="meta.logo" class="champ w-full" placeholder="https://…/imperium/black-templars-icone.png">
              <div class="mt-2 flex flex-wrap items-center gap-2">
                <label class="lien cursor-pointer">
                  {{ envoi === 'logo' ? 'Envoi…' : 'Choisir une image…' }}
                  <input type="file" accept="image/*" class="hidden" :disabled="!!envoi" @change="envoyerImage($event, 'logo', 'icone')">
                </label>
                <button v-if="meta.logo" type="button" class="text-xs text-gray-500 hover:text-red-300" @click="meta.logo = undefined">Retirer</button>
              </div>
              <p class="aide mt-1">Posée sur la couverture et à côté du titre de la page de présentation. Elle est aplatie en silhouette : une image nette sur fond transparent rend le mieux.</p>
            </div>
          </div>
        </div>

        <p v-if="erreurImage" class="text-xs text-red-300 lg:col-span-2">{{ erreurImage }}</p>

      </div>
    </section>
  </div>
</template>

<style scoped>
.titre-bloc { @apply font-heading text-lg font-semibold text-gold; }
.sous-titre-bloc { @apply text-xs text-gray-500; }
.carte { @apply rounded-lg border border-gold/10 bg-surface-light p-5; }
.champ-label { @apply flex flex-col gap-1 text-xs text-gray-400; }
.champ { @apply w-full rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100 focus:border-gold focus:outline-none; }
.aide { @apply text-[11px] leading-snug text-gray-500; }
.lien { @apply text-sm text-gold hover:underline; }
</style>
