<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Etat { slug: string; nom: string; faction: string; version: string; statut: string; couleur?: string; source: 'yaml' | 'publie'; brouillon: boolean; brouillon_modifie?: string; versions: number }

const api = useAdminApi()
const etats = ref<Etat[]>([])
const chargement = ref(true)
const modale = ref(false)
const creation = ref({ nom: '', faction: 'imperium' as 'imperium' | 'chaos' | 'xenos', encours: false, erreur: '' })

const factions: Record<string, string> = { imperium: 'Imperium', chaos: 'Chaos', xenos: 'Xenos' }
const statuts: Record<string, string> = { official: 'Officiel', beta: 'Bêta', experimental: 'Expérimental', '30k': '30k' }

async function charger() {
  chargement.value = true
  try { etats.value = await api.get<Etat[]>('/api/admin/codex') } finally { chargement.value = false }
}
onMounted(charger)

async function creer() {
  creation.value.encours = true
  creation.value.erreur = ''
  try {
    const r = await api.post<{ slug: string }>('/api/admin/codex', { nom: creation.value.nom, faction: creation.value.faction })
    await navigateTo(`/admin/codex/${r.slug}`)
  } catch (e) {
    creation.value.erreur = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    creation.value.encours = false
  }
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-heading text-3xl font-bold text-white">Codex</h1>
        <p class="mt-1 max-w-2xl text-sm text-gray-400">Une fiche par armée : unités, formations, améliorations et règles. Le PDF et le builder en découlent. <span class="text-gold">Démo</span> : les brouillons sont stockés côté serveur, la base de données viendra ensuite.</p>
      </div>
      <button type="button" class="rounded-md bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light" @click="modale = true">+ Nouvelle armée</button>
    </div>

    <div v-if="chargement" class="py-16 text-center text-gray-500">Chargement…</div>
    <div v-else class="overflow-hidden rounded-lg border border-gold/10 bg-surface-light">
      <table class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wider text-gray-500">
          <tr class="border-b border-gold/10"><th class="px-5 py-3">Armée</th><th class="py-3">Faction</th><th class="py-3">Statut</th><th class="py-3">Publié</th><th class="py-3">Brouillon</th><th class="py-3 pr-5 text-right">Actions</th></tr>
        </thead>
        <tbody>
          <tr v-for="e in etats" :key="e.slug" class="border-b border-white/5 hover:bg-white/[.02]">
            <td class="px-5 py-3">
              <NuxtLink :to="`/admin/codex/${e.slug}`" class="flex items-center gap-3 font-medium text-gray-100 hover:text-gold">
                <span class="inline-block h-3 w-3 rounded-full border border-white/20" :style="{ background: e.couleur ?? '#8a6d3b' }" />{{ e.nom }}
              </NuxtLink>
            </td>
            <td class="py-3 text-gray-300">{{ factions[e.faction] ?? e.faction }}</td>
            <td class="py-3"><span class="rounded bg-white/5 px-2 py-0.5 text-xs text-gray-300">{{ statuts[e.statut] ?? e.statut }}</span></td>
            <td class="py-3 text-gray-300">
              v{{ e.version }}
              <span class="ml-1 text-xs text-gray-500">{{ e.source === 'publie' ? `· ${e.versions} publication(s)` : '· fichier de départ' }}</span>
            </td>
            <td class="py-3">
              <span v-if="e.brouillon" class="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">modifié {{ e.brouillon_modifie ? new Date(e.brouillon_modifie).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '' }}</span>
              <span v-else class="text-xs text-gray-600">aucun</span>
            </td>
            <td class="py-3 pr-5 text-right whitespace-nowrap">
              <NuxtLink :to="`/admin/codex/${e.slug}`" class="rounded-md bg-gold/90 px-3 py-1 text-xs font-semibold text-surface hover:bg-gold-light">Modifier</NuxtLink>
              <a :href="`/codex-test/${e.slug}/imprimer`" target="_blank" class="ml-1 rounded-md border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5">PDF</a>
              <a :href="`/builder/${e.slug}`" target="_blank" class="ml-1 rounded-md border border-white/10 px-3 py-1 text-xs text-gray-300 hover:bg-white/5">Builder</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="modale" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" @click.self="modale = false">
      <div class="w-full max-w-md rounded-lg border border-gold/20 bg-surface-light p-6">
        <h2 class="font-heading text-xl font-bold text-white">Nouvelle armée</h2>
        <p class="mt-1 text-sm text-gray-400">Crée une fiche vide avec deux sections (principales, supports) et le budget « 1/3 des points ».</p>
        <label class="mt-4 flex flex-col gap-1 text-xs text-gray-400">Nom<input v-model="creation.nom" class="rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100" placeholder="Eldars d'Yme-Loc" @keyup.enter="creer"></label>
        <label class="mt-3 flex flex-col gap-1 text-xs text-gray-400">Faction
          <select v-model="creation.faction" class="rounded-md border border-white/10 bg-surface px-3 py-1.5 text-sm text-gray-100"><option value="imperium">Imperium</option><option value="chaos">Chaos</option><option value="xenos">Xenos</option></select>
        </label>
        <p v-if="creation.erreur" class="mt-3 text-xs text-red-300">{{ creation.erreur }}</p>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-300" @click="modale = false">Annuler</button>
          <button type="button" class="rounded-md bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50" :disabled="creation.encours || !creation.nom.trim()" @click="creer">Créer</button>
        </div>
      </div>
    </div>
  </div>
</template>
