<script setup lang="ts">
import type { CodexInput } from '~~/shared/codex/schema'
import { CodexSchema, verifierReferences } from '~~/shared/codex/schema'
import { CLE_BROUILLON } from '~/composables/useBrouillonCodex'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const route = useRoute()
const slug = route.params.slug as string
const api = useAdminApi()

const brouillon = ref<CodexInput | null>(null)
const versions = ref<Array<{ version?: string; changelog?: string; publie?: string }>>([])
const existe = ref(false)
const chargement = ref(true)
const pret = ref(false)
/** dernier état enregistré (ou chargé), pour ne pas créer de brouillon sans changement réel */
let dernierEtat = ''
const erreurChargement = ref('')
const onglet = ref<'armee' | 'unites' | 'liste' | 'options' | 'apercu'>('liste')
const sauvegarde = ref<'propre' | 'modifie' | 'encours' | 'ok'>('propre')
const problemes = ref<string[]>([])
const afficherProblemes = ref(false)
const modalePublier = ref(false)
const publication = ref({ version: '', changelog: '', encours: false, erreur: '' })
const apercuCle = ref(0)

provide(CLE_BROUILLON, brouillon as Ref<CodexInput>)

onMounted(async () => {
  try {
    const r = await api.get<{ data: CodexInput; existe: boolean; versions: typeof versions.value }>(`/api/admin/codex/${slug}/brouillon`)
    brouillon.value = r.data
    dernierEtat = JSON.stringify(r.data)
    existe.value = r.existe
    versions.value = r.versions
    problemes.value = verifier()
    await nextTick()
    pret.value = true
  } catch (e) {
    erreurChargement.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    chargement.value = false
  }
})

/** Validation locale immédiate (mêmes règles que le serveur). */
function verifier(): string[] {
  if (!brouillon.value) return []
  const r = CodexSchema.safeParse(brouillon.value)
  return r.success ? verifierReferences(r.data) : r.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`)
}

let minuteur: ReturnType<typeof setTimeout> | undefined
watch(brouillon, () => {
  if (!pret.value) return
  if (JSON.stringify(brouillon.value) === dernierEtat) return
  sauvegarde.value = 'modifie'
  problemes.value = verifier()
  clearTimeout(minuteur)
  minuteur = setTimeout(enregistrer, 1200)
}, { deep: true })

async function enregistrer() {
  if (!brouillon.value) return
  sauvegarde.value = 'encours'
  try {
    const r = await api.put<{ problemes: string[] }>(`/api/admin/codex/${slug}/brouillon`, brouillon.value)
    problemes.value = r.problemes
    dernierEtat = JSON.stringify(brouillon.value)
    existe.value = true
    sauvegarde.value = 'ok'
    apercuCle.value++
  } catch (e) {
    sauvegarde.value = 'modifie'
    alert((e as { data?: { message?: string } }).data?.message ?? 'Enregistrement impossible')
  }
}

async function abandonner() {
  if (!confirm('Abandonner le brouillon et revenir à la version publiée ?')) return
  await api.del(`/api/admin/codex/${slug}/brouillon`)
  location.reload()
}

function ouvrirPublier() {
  const v = brouillon.value?.codex.version ?? '1.0'
  const parts = v.split('.').map((x) => parseInt(x, 10))
  publication.value = { version: parts.every((x) => !isNaN(x)) ? [...parts.slice(0, -1), (parts[parts.length - 1] ?? 0) + 1].join('.') : v, changelog: '', encours: false, erreur: '' }
  modalePublier.value = true
}
async function publier() {
  publication.value.encours = true
  publication.value.erreur = ''
  try {
    clearTimeout(minuteur)
    await enregistrer()
    await api.post(`/api/admin/codex/${slug}/publier`, { version: publication.value.version, changelog: publication.value.changelog })
    modalePublier.value = false
    location.reload()
  } catch (e) {
    publication.value.erreur = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    publication.value.encours = false
  }
}

const onglets = [
  { id: 'armee', label: 'Armée' },
  { id: 'unites', label: 'Unités' },
  { id: 'liste', label: "Liste d'armée" },
  { id: 'options', label: 'Améliorations' },
  { id: 'apercu', label: 'Aperçu' },
] as const
const apercuUrl = computed(() => `/codex-test/${slug}/imprimer?brouillon=1&v=${apercuCle.value}`)
</script>

<template>
  <div>
    <div v-if="chargement" class="py-20 text-center text-gray-500">Chargement…</div>
    <div v-else-if="erreurChargement" class="rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-200">{{ erreurChargement }}</div>

    <template v-else-if="brouillon">
      <!-- En-tête -->
      <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <NuxtLink to="/admin/codex" class="text-xs uppercase tracking-widest text-gold hover:underline">← Codex</NuxtLink>
          <h1 class="mt-1 flex items-center gap-3 font-heading text-3xl font-bold text-white">
            <span class="inline-block h-4 w-4 rounded-full border border-white/20" :style="{ background: brouillon.codex.couleur ?? '#8a6d3b' }" />
            {{ brouillon.codex.nom }}
            <span class="text-base font-normal text-gray-500">brouillon · publié en v{{ versions[versions.length - 1]?.version ?? brouillon.codex.version }}</span>
          </h1>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <AdminCodexGuide volet="recettes" />
          <span class="text-xs" :class="{ 'text-gray-500': sauvegarde === 'propre', 'text-amber-300': sauvegarde === 'modifie' || sauvegarde === 'encours', 'text-emerald-300': sauvegarde === 'ok' }">
            {{ sauvegarde === 'encours' ? 'Enregistrement…' : sauvegarde === 'ok' ? 'Brouillon enregistré' : sauvegarde === 'modifie' ? 'Modifications non enregistrées' : existe ? 'Brouillon en cours' : 'Aucune modification' }}
          </span>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm" :class="problemes.length ? 'border-red-400/40 text-red-300 hover:bg-red-500/10' : 'border-emerald-400/30 text-emerald-300'" @click="afficherProblemes = !afficherProblemes">
            {{ problemes.length ? `${problemes.length} problème(s)` : '✓ Cohérent' }}
          </button>
          <button v-if="existe" type="button" class="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300 hover:bg-white/5" @click="abandonner">Abandonner le brouillon</button>
          <button type="button" class="rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-40" :disabled="problemes.length > 0" :title="problemes.length ? 'Corrige les problèmes avant de publier' : ''" @click="ouvrirPublier">Publier…</button>
        </div>
      </div>

      <div v-if="afficherProblemes && problemes.length" class="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        <p class="mb-2 text-xs uppercase tracking-wider">À corriger avant publication</p>
        <ul class="list-disc space-y-0.5 pl-5"><li v-for="(p, i) in problemes" :key="i">{{ p }}</li></ul>
      </div>

      <!-- Onglets -->
      <div class="mb-5 flex gap-1 border-b border-gold/10">
        <button v-for="o in onglets" :key="o.id" type="button" class="-mb-px rounded-t-md px-4 py-2 text-sm font-medium" :class="onglet === o.id ? 'border border-gold/20 border-b-surface bg-surface text-gold' : 'text-gray-400 hover:text-gray-200'" @click="onglet = o.id">
          {{ o.label }}
          <span v-if="o.id === 'unites'" class="ml-1 text-xs text-gray-500">{{ brouillon.unites.length }}</span>
          <span v-else-if="o.id === 'liste'" class="ml-1 text-xs text-gray-500">{{ brouillon.formations.length }}</span>
          <span v-else-if="o.id === 'options'" class="ml-1 text-xs text-gray-500">{{ brouillon.options?.length ?? 0 }}</span>
        </button>
      </div>

      <AdminCodexOngletArmee v-if="onglet === 'armee'" />
      <AdminCodexOngletUnites v-else-if="onglet === 'unites'" />
      <AdminCodexOngletListe v-else-if="onglet === 'liste'" />
      <AdminCodexOngletOptions v-else-if="onglet === 'options'" />
      <div v-else class="space-y-4">
        <div class="flex flex-wrap items-center gap-3 text-sm">
          <p class="text-gray-400">Aperçu du brouillon, régénéré à chaque enregistrement.</p>
          <a :href="apercuUrl" target="_blank" class="rounded-md border border-gold/40 px-3 py-1.5 text-gold hover:bg-gold/10">Ouvrir le PDF dans un onglet</a>
          <a :href="`/builder/${slug}?brouillon=1`" target="_blank" class="rounded-md border border-white/10 px-3 py-1.5 text-gray-200 hover:bg-white/5">Tester dans le builder</a>
        </div>
        <iframe :key="apercuCle" :src="apercuUrl" class="h-[80vh] w-full rounded-lg border border-gold/10 bg-white" />
      </div>

      <!-- Versions -->
      <div v-if="versions.length && onglet === 'armee'" class="mt-6 rounded-lg border border-gold/10 bg-surface-light p-5">
        <h3 class="mb-2 font-heading text-base font-semibold text-gold">Versions publiées</h3>
        <ul class="divide-y divide-white/5 text-sm">
          <li v-for="v in [...versions].reverse()" :key="v.publie" class="flex gap-4 py-1.5"><span class="w-16 font-semibold text-gray-200">v{{ v.version }}</span><span class="w-40 text-gray-500">{{ v.publie ? new Date(v.publie).toLocaleString('fr-FR') : '' }}</span><span class="text-gray-300">{{ v.changelog }}</span></li>
        </ul>
      </div>

      <!-- Modale publier -->
      <div v-if="modalePublier" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="modalePublier = false">
        <div class="w-full max-w-md rounded-lg border border-gold/20 bg-surface-light p-6">
          <h2 class="font-heading text-xl font-bold text-white">Publier {{ brouillon.codex.nom }}</h2>
          <p class="mt-1 text-sm text-gray-400">Le brouillon est validé, ses listes de test sont rejouées, puis il devient la version publique. Le PDF est régénéré.</p>
          <label class="mt-4 flex flex-col gap-1 text-xs text-gray-400">Numéro de version<input v-model="publication.version" class="rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100"></label>
          <label class="mt-3 flex flex-col gap-1 text-xs text-gray-400">Explications de la mise à jour<textarea v-model="publication.changelog" rows="3" class="rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100" placeholder="Corrections de points, ajout d'unités…" /></label>
          <pre v-if="publication.erreur" class="mt-3 whitespace-pre-wrap rounded border border-red-400/30 bg-red-500/10 p-3 text-xs text-red-200">{{ publication.erreur }}</pre>
          <div class="mt-5 flex justify-end gap-2">
            <button type="button" class="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300" @click="modalePublier = false">Annuler</button>
            <button type="button" class="rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50" :disabled="publication.encours || !publication.version" @click="publier">{{ publication.encours ? 'Publication…' : 'Publier' }}</button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
