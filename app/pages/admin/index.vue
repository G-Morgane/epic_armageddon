<script setup lang="ts">
import type { Army, ArmyVersion } from '~/types/database'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const supabase = useSupabase()
const { isAdmin, isSuperAdmin } = useAuth()

// Fetch all armies for admin
const { data: officialArmies, refresh: refreshOfficial } = await useFetch<ArmyWithVersion[]>('/api/armies', { query: { status: 'official' } })
const { data: betaArmiesData, refresh: refreshBeta } = await useFetch<ArmyWithVersion[]>('/api/armies', { query: { status: 'beta' } })
const { data: experimentalArmiesData, refresh: refreshExperimental } = await useFetch<ArmyWithVersion[]>('/api/armies', { query: { status: 'experimental' } })
const { data: thirtyKArmiesData, refresh: refresh30k } = await useFetch<ArmyWithVersion[]>('/api/armies', { query: { status: '30k' } })

const armies = computed(() => [
  ...(officialArmies.value ?? []),
  ...(betaArmiesData.value ?? []),
  ...(experimentalArmiesData.value ?? []),
  ...(thirtyKArmiesData.value ?? []),
])

async function refresh() {
  await Promise.all([refreshOfficial(), refreshBeta(), refreshExperimental(), refresh30k()])
}

const factionLabels: Record<string, string> = {
  imperium: 'Imperium',
  chaos: 'Chaos',
  xenos: 'Xenos',
}

const factionFilter = ref<string>('')
const statusFilter = ref<string>('')
const search = ref('')

const statusLabels: Record<string, string> = {
  official: 'Officiel',
  beta: 'Bêta',
  experimental: 'Expérimental',
  '30k': '30k',
}
const editingArmy = ref<Army | null>(null)
const editDescription = ref('')
const saving = ref(false)
const uploadingPdf = ref<string | null>(null)
const versionsArmy = ref<ArmyWithVersion | null>(null)
const versionsLoading = ref(false)
const armyVersions = ref<ArmyVersion[]>([])

// Upload modal state
const uploadArmy = ref<ArmyWithVersion | null>(null)
const uploadVersion = ref('')
const uploadChangelog = ref('')
const uploadFile = ref<File | null>(null)
const uploadError = ref('')

const filteredArmies = computed(() => {
  if (!armies.value) return []
  return armies.value.filter(a => {
    if (factionFilter.value && a.faction !== factionFilter.value) return false
    if (statusFilter.value && a.status !== statusFilter.value) return false
    if (search.value && !a.name.toLowerCase().includes(search.value.toLowerCase())) return false
    return true
  })
})

const editName = ref('')
const editFaction = ref<string>('')
const editStatus = ref<string>('official')
const editQuote = ref('')
const editQuoteAuthor = ref('')

function startEdit(army: Army) {
  editingArmy.value = army
  editName.value = army.name
  editFaction.value = army.faction
  editStatus.value = army.status ?? 'official'
  editQuote.value = army.quote ?? ''
  editQuoteAuthor.value = army.quote_author ?? ''
}

async function saveArmy() {
  if (!editingArmy.value) return
  saving.value = true
  const { error } = await supabase
    .from('armies')
    .update({
      name: editName.value,
      faction: editFaction.value,
      status: editStatus.value,
      quote: editQuote.value || null,
      quote_author: editQuoteAuthor.value || null,
    })
    .eq('id', editingArmy.value.id)
  if (!error) {
    editingArmy.value = null
    await refresh()
  }
  saving.value = false
}

// Create new army
const showCreateModal = ref(false)
const createName = ref('')
const createFaction = ref<string>('imperium')
const createVersion = ref('1.0')
const createIcon = ref<File | null>(null)
const createPdf = ref<File | null>(null)
const creating = ref(false)
const createError = ref('')

function resetCreateModal() {
  createName.value = ''
  createFaction.value = 'imperium'
  createVersion.value = '1.0'
  createIcon.value = null
  createPdf.value = null
  createError.value = ''
}

async function createArmy() {
  if (!createName.value || !createPdf.value) {
    createError.value = 'Le nom et le PDF sont obligatoires.'
    return
  }

  creating.value = true
  createError.value = ''

  const slug = createName.value.toLowerCase().replace(/[^a-z0-9]/g, '-')

  // Upload icon if provided
  let coverImage: string | null = null
  if (createIcon.value) {
    const iconName = `${slug}.svg`
    const { error: iconErr } = await supabase.storage
      .from('army-pdfs')
      .upload(`icons/${iconName}`, createIcon.value)

    if (iconErr) {
      createError.value = 'Erreur upload icône : ' + iconErr.message
      creating.value = false
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('army-pdfs')
      .getPublicUrl(`icons/${iconName}`)
    coverImage = publicUrl
  }

  // Upload PDF
  const pdfName = `${createFaction.value}/${slug}-v${createVersion.value}.pdf`
  const { error: pdfErr } = await supabase.storage
    .from('army-pdfs')
    .upload(pdfName, createPdf.value, { contentType: 'application/pdf' })

  if (pdfErr) {
    createError.value = 'Erreur upload PDF : ' + pdfErr.message
    creating.value = false
    return
  }

  const { data: { publicUrl: pdfUrl } } = supabase.storage
    .from('army-pdfs')
    .getPublicUrl(pdfName)

  // Insert army
  const { data: armyData, error: armyErr } = await supabase
    .from('armies')
    .insert({
      name: createName.value,
      faction: createFaction.value,
      cover_image: coverImage,
    })
    .select()
    .single()

  if (armyErr) {
    createError.value = 'Erreur création : ' + armyErr.message
    creating.value = false
    return
  }

  // Insert first version
  await supabase.from('army_versions').insert({
    army_id: armyData.id,
    version: createVersion.value,
    pdf_url: pdfUrl,
    changelog: 'Version initiale',
    is_current: true,
    published_at: new Date().toISOString(),
  })

  creating.value = false
  showCreateModal.value = false
  resetCreateModal()
  await refresh()
}

function openUploadModal(army: ArmyWithVersion) {
  uploadArmy.value = army
  uploadError.value = ''
  uploadFile.value = null
  uploadChangelog.value = ''
  // Auto-increment version
  const currentVersion = army.army_versions?.find(v => v.is_current)
  const versionParts = (currentVersion?.version ?? '1.0').split('.')
  versionParts[versionParts.length - 1] = String(Number(versionParts[versionParts.length - 1]) + 1)
  uploadVersion.value = versionParts.join('.')
}

function handleFileSelect(event: Event) {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function submitUpload() {
  if (!uploadArmy.value || !uploadFile.value || !uploadVersion.value) {
    uploadError.value = 'Veuillez remplir tous les champs et sélectionner un PDF.'
    return
  }

  uploadingPdf.value = uploadArmy.value.id
  uploadError.value = ''

  const army = uploadArmy.value
  const fileName = `${army.faction}/${army.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-v${uploadVersion.value}.pdf`

  const { error: storageErr } = await supabase.storage
    .from('army-pdfs')
    .upload(fileName, uploadFile.value, { contentType: 'application/pdf' })

  if (storageErr) {
    uploadError.value = 'Erreur upload : ' + storageErr.message
    uploadingPdf.value = null
    return
  }

  const { data: { publicUrl } } = supabase.storage
    .from('army-pdfs')
    .getPublicUrl(fileName)

  // Set old version as not current
  await supabase
    .from('army_versions')
    .update({ is_current: false })
    .eq('army_id', army.id)
    .eq('is_current', true)

  // Create new version
  await supabase.from('army_versions').insert({
    army_id: army.id,
    version: uploadVersion.value,
    pdf_url: publicUrl,
    changelog: uploadChangelog.value || null,
    is_current: true,
    published_at: new Date().toISOString(),
  })

  uploadingPdf.value = null
  uploadArmy.value = null
  await refresh()
}

// Version management (super admin only)
async function openVersions(army: ArmyWithVersion) {
  versionsArmy.value = army
  versionsLoading.value = true
  const { data } = await supabase
    .from('army_versions')
    .select('*')
    .eq('army_id', army.id)
    .order('published_at', { ascending: false })
  armyVersions.value = data ?? []
  versionsLoading.value = false
}

async function deleteVersion(version: ArmyVersion) {
  if (!confirm(`Supprimer la version ${version.version} ?`)) return

  await supabase
    .from('army_versions')
    .delete()
    .eq('id', version.id)

  // Refresh versions list
  if (versionsArmy.value) {
    await openVersions(versionsArmy.value)
  }
  await refresh()
}

async function rollbackTo(version: ArmyVersion) {
  if (!confirm(`Restaurer la version ${version.version} comme version actuelle ?`)) return

  // Remove current flag from all versions of this army
  await supabase
    .from('army_versions')
    .update({ is_current: false })
    .eq('army_id', version.army_id)
    .eq('is_current', true)

  // Set selected version as current
  await supabase
    .from('army_versions')
    .update({ is_current: true })
    .eq('id', version.id)

  // Refresh
  if (versionsArmy.value) {
    await openVersions(versionsArmy.value)
  }
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-heading text-2xl font-bold text-gold">Gestion des armées</h1>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
        @click="showCreateModal = true; resetCreateModal()"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Nouvelle armée
      </button>
    </div>

    <!-- Search + Filters -->
    <div class="mt-4 flex flex-wrap items-center gap-6">
      <div class="relative">
        <svg class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Rechercher..."
          class="w-52 rounded-lg border border-white/10 bg-surface py-1.5 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none"
        >
      </div>

      <div class="h-5 w-px bg-gold/10" />
      <!-- Status filter -->
      <div class="flex gap-1">
        <button
          :class="[
            'rounded-md px-3 py-1.5 text-sm transition-all',
            !statusFilter ? 'bg-gold/10 text-gold' : 'text-gray-400 hover:text-gold',
          ]"
          @click="statusFilter = ''"
        >
          Tous
        </button>
        <button
          v-for="(label, key) in statusLabels"
          :key="key"
          :class="[
            'rounded-md px-3 py-1.5 text-sm transition-all',
            statusFilter === key ? 'bg-gold/10 text-gold' : 'text-gray-400 hover:text-gold',
          ]"
          @click="statusFilter = key"
        >
          {{ label }}
        </button>
      </div>

      <div class="h-5 w-px bg-gold/10" />

      <!-- Faction filter -->
      <div class="flex gap-1">
        <button
          :class="[
            'rounded-md px-3 py-1.5 text-sm transition-all',
            !factionFilter ? 'bg-gold/10 text-gold' : 'text-gray-400 hover:text-gold',
          ]"
          @click="factionFilter = ''"
        >
          Toutes
        </button>
        <button
          v-for="(label, key) in factionLabels"
          :key="key"
          :class="[
            'rounded-md px-3 py-1.5 text-sm transition-all',
            factionFilter === key ? 'bg-gold/10 text-gold' : 'text-gray-400 hover:text-gold',
          ]"
          @click="factionFilter = key"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <!-- Army table -->
    <div class="mt-8 overflow-x-auto rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full min-w-[640px]">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-6 py-4 font-medium">Armée</th>
            <th class="px-6 py-4 font-medium">Faction</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="px-6 py-4 font-medium">Version</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr
            v-for="army in filteredArmies"
            :key="army.id"
            class="transition-colors hover:bg-surface-light/50"
          >
            <td class="px-6 py-4 text-base font-medium text-gray-200">{{ army.name }}</td>
            <td class="px-6 py-4">
              <span class="rounded-full border border-white/10 bg-surface-lighter px-3 py-1 text-xs capitalize text-gray-400">
                {{ army.faction }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  army.status === 'official' && 'bg-emerald-500/10 text-emerald-400',
                  army.status === 'beta' && 'bg-amber-500/10 text-amber-400',
                  army.status === 'experimental' && 'bg-purple-500/10 text-purple-400',
                  army.status === '30k' && 'bg-red-500/10 text-red-400',
                ]"
              >
                {{ statusLabels[army.status] ?? army.status }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span class="text-sm text-gray-400">
                {{ army.army_versions?.[0]?.version ? 'REV ' + army.army_versions[0].version : '-' }}
              </span>
            </td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
                  @click="startEdit(army)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Modifier
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 px-4 py-2 text-sm text-emerald-400 transition-colors hover:bg-emerald-500/10"
                  @click="openUploadModal(army)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                  Nouveau PDF
                </button>
                <button
                  v-if="isSuperAdmin"
                  class="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-400 transition-colors hover:bg-white/5"
                  @click="openVersions(army)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Versions
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Edit army modal -->
    <Teleport to="body">
      <div v-if="editingArmy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">Modifier l'armée</h2>

          <div class="mt-6 space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-300">Nom</label>
              <input
                v-model="editName"
                type="text"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Faction</label>
              <select
                v-model="editFaction"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
                <option value="imperium">Imperium</option>
                <option value="chaos">Chaos</option>
                <option value="xenos">Xenos</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Statut</label>
              <select
                v-model="editStatus"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
                <option value="official">Officiel</option>
                <option value="beta">Bêta</option>
                <option value="experimental">Expérimental</option>
                <option value="30k">30k</option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Citation</label>
              <textarea
                v-model="editQuote"
                rows="3"
                placeholder="« Il n'y a pas de paix parmi les étoiles... »"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Auteur de la citation</label>
              <input
                v-model="editQuoteAuthor"
                type="text"
                placeholder="ex: Commissaire Yarrick"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-3">
            <button
              class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              @click="editingArmy = null"
            >
              Annuler
            </button>
            <button
              :disabled="saving"
              class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
              @click="saveArmy"
            >
              {{ saving ? 'Enregistrement...' : 'Enregistrer' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Upload PDF modal -->
    <Teleport to="body">
      <div v-if="uploadArmy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-lg rounded-xl border border-gold/20 bg-surface-light p-6">
          <h2 class="font-heading text-xl font-bold text-gold">Nouveau PDF — {{ uploadArmy.name }}</h2>

          <form class="mt-6 space-y-4" @submit.prevent="submitUpload">
            <div v-if="uploadError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ uploadError }}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Numéro de version</label>
              <input
                v-model="uploadVersion"
                type="text"
                required
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                placeholder="ex: 1.4"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Explications de la mise à jour</label>
              <textarea
                v-model="uploadChangelog"
                rows="3"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                placeholder="Corrections de points, ajout d'unités..."
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Fichier PDF</label>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-6 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {{ uploadFile ? uploadFile.name : 'Cliquez pour sélectionner un PDF' }}
                <input type="file" accept=".pdf" class="hidden" @change="handleFileSelect">
              </label>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                @click="uploadArmy = null"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="!!uploadingPdf"
                class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
              >
                {{ uploadingPdf ? 'Upload en cours...' : 'Publier la version' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Versions modal (super admin) -->
    <Teleport to="body">
      <div v-if="versionsArmy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-6">
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-xl font-bold text-gold">Versions — {{ versionsArmy.name }}</h2>
            <button class="text-gray-400 hover:text-gray-200" @click="versionsArmy = null">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div v-if="versionsLoading" class="py-8 text-center text-gray-400">Chargement...</div>

          <div v-else class="mt-4 max-h-96 divide-y divide-gold/5 overflow-y-auto">
            <div
              v-for="v in armyVersions"
              :key="v.id"
              class="flex items-center justify-between py-3"
            >
              <div class="flex items-center gap-3">
                <span
                  :class="[
                    'rounded px-2 py-0.5 text-xs font-semibold',
                    v.is_current ? 'bg-gold/10 text-gold' : 'bg-surface-lighter text-gray-400',
                  ]"
                >
                  REV {{ v.version }}
                </span>
                <span v-if="v.is_current" class="text-xs text-emerald-400">actuelle</span>
                <span class="text-xs text-gray-500">
                  {{ new Date(v.published_at).toLocaleDateString('fr-FR') }}
                </span>
              </div>

              <div class="flex gap-2">
                <a
                  :href="v.pdf_url"
                  target="_blank"
                  rel="noopener"
                  class="rounded-md px-2 py-1 text-xs text-gray-400 hover:bg-white/5 hover:text-gray-200"
                >
                  PDF
                </a>
                <button
                  v-if="!v.is_current"
                  class="rounded-md px-2 py-1 text-xs text-gold hover:bg-gold/10"
                  @click="rollbackTo(v)"
                >
                  Restaurer
                </button>
                <button
                  v-if="!v.is_current"
                  class="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
                  @click="deleteVersion(v)"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Create army modal -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">Nouvelle armée</h2>

          <form class="mt-6 space-y-4" @submit.prevent="createArmy">
            <div v-if="createError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ createError }}
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-300">Nom de l'armée</label>
                <input
                  v-model="createName"
                  type="text"
                  required
                  placeholder="ex: Blood Ravens"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-300">Faction</label>
                <select
                  v-model="createFaction"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
                  <option value="imperium">Imperium</option>
                  <option value="chaos">Chaos</option>
                  <option value="xenos">Xenos</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Version initiale</label>
              <input
                v-model="createVersion"
                type="text"
                required
                placeholder="1.0"
                class="mt-1 w-32 rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Icône (SVG, optionnel)</label>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-4 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                {{ createIcon ? createIcon.name : 'Sélectionner une icône SVG' }}
                <input type="file" accept=".svg" class="hidden" @change="createIcon = ($event.target as HTMLInputElement).files?.[0] ?? null">
              </label>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">PDF du codex</label>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-4 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                {{ createPdf ? createPdf.name : 'Sélectionner le fichier PDF' }}
                <input type="file" accept=".pdf" class="hidden" @change="createPdf = ($event.target as HTMLInputElement).files?.[0] ?? null">
              </label>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                @click="showCreateModal = false"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="creating"
                class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
              >
                {{ creating ? 'Création...' : 'Créer l\'armée' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
