<script setup lang="ts">
import type { Army, ArmyVersion, ArmyTag } from '~/types/database'
import { codexDeArmee } from '~/utils/codex-armee'

definePageMeta({ layout: 'admin', middleware: 'admin' })

type ArmyWithVersion = Army & { army_versions: ArmyVersion[] }

const supabase = useSupabase()
const { isAdmin, isSuperAdmin } = useAuth()
const { uploadPdf } = useUploadPdf()

// Toutes les armées de l'admin, tous statuts : la route les prend séparés par des
// virgules. Les cinq appels d'avant s'enchaînaient, donc cinq allers-retours en file.
// `fresh` : l'admin écrit puis relit dans la foulée, il lui faut la base, pas le
// cache de la route (voir server/utils/cache.ts).
const { data: toutesArmees, refresh } = await useFetch<ArmyWithVersion[]>('/api/armies', {
  query: { status: 'official,beta,experimental,30k,archived', fresh: 1 },
})

const armies = computed(() => toutesArmees.value ?? [])

/**
 * État des codex, tel que `/admin/codex` l'affichait avant la fusion des deux
 * écrans. Chargé dans le navigateur : la route s'authentifie par le cookie
 * Supabase, que le rendu serveur ne relaie pas.
 */
interface EtatCodex {
  slug: string
  nom: string
  armee_id?: string
  faction: string
  version: string
  statut: string
  couleur?: string
  source: 'yaml' | 'publie' | 'brouillon'
  brouillon: boolean
  brouillon_modifie?: string
  versions: number
  stockage: string
  type: 'armee' | 'soutien'
}

const etatsCodex = ref<EtatCodex[]>([])
const codexCharges = ref(false)

async function chargerCodex() {
  try {
    etatsCodex.value = await $fetch<EtatCodex[]>('/api/admin/codex')
  } finally {
    codexCharges.value = true
  }
}
onMounted(chargerCodex)

/**
 * Une ligne par armée : la fiche publique et son codex côte à côte. Un codex sans
 * fiche (liste de soutien, codex tout juste créé) garde sa propre ligne, sinon il
 * n'aurait plus d'écran depuis la disparition de `/admin/codex`.
 */
interface Ligne {
  cle: string
  nom: string
  faction: string
  statut: string
  armee?: ArmyWithVersion
  codex?: EtatCodex
}

const lignes = computed<Ligne[]>(() => {
  const orphelins = new Set(etatsCodex.value.map(c => c.slug))
  const out: Ligne[] = armies.value.map((a) => {
    const c = codexDeArmee(etatsCodex.value, a.id, a.name)
    if (c) orphelins.delete(c.slug)
    // Le codex fait foi sur le nom et le statut : la fiche n'est recopiée qu'à la
    // publication, donc elle retarde d'un brouillon.
    return { cle: a.id, nom: c?.nom ?? a.name, faction: c?.faction ?? a.faction, statut: a.status ?? 'official', armee: a, codex: c }
  })
  for (const c of etatsCodex.value) {
    if (orphelins.has(c.slug)) out.push({ cle: `codex:${c.slug}`, nom: c.nom, faction: c.faction, statut: c.statut, codex: c })
  }
  return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
})

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
  archived: 'Archivé',
}
const editingArmy = ref<Army | null>(null)
const editDescription = ref('')
const saving = ref(false)
const uploadingPdf = ref<string | null>(null)
const versionsArmy = ref<ArmyWithVersion | null>(null)
const versionsLoading = ref(false)
const armyVersions = ref<ArmyVersion[]>([])

// Upload state (inside versions modal)
const showAddVersion = ref(false)
const uploadVersion = ref('')
const uploadChangelog = ref('')
const uploadDate = ref('')
const uploadIsCurrent = ref(true)
const uploadFile = ref<File | null>(null)
const uploadError = ref('')

const lignesFiltrees = computed(() => lignes.value.filter((l) => {
  if (factionFilter.value && l.faction !== factionFilter.value) return false
  if (statusFilter.value && l.statut !== statusFilter.value) return false
  if (search.value && !l.nom.toLowerCase().includes(search.value.toLowerCase())) return false
  return true
}))

const editName = ref('')
const editFaction = ref<string>('')
const editStatus = ref<string>('official')
const editQuote = ref('')
const editQuoteAuthor = ref('')
const editIcon = ref<File | null>(null)
const editIconUploading = ref(false)

/** Codex de l'armée en cours d'édition : il décide des champs que la fiche laisse encore saisir. */
const editingCodex = ref<EtatCodex | null>(null)

async function startEdit(army: Army, codex?: EtatCodex) {
  editingArmy.value = army
  editingCodex.value = codex ?? null
  editName.value = army.name
  editFaction.value = army.faction
  editStatus.value = army.status ?? 'official'
  editQuote.value = army.quote ?? ''
  editQuoteAuthor.value = army.quote_author ?? ''
  editIcon.value = null
  await loadTags()
  await loadArmyTags(army.id)
}

async function saveArmy() {
  if (!editingArmy.value) return
  saving.value = true

  // Upload new icon if provided
  let coverImage: string | null | undefined = undefined
  if (editIcon.value && !editingCodex.value) {
    editIconUploading.value = true
    const slug = editName.value.toLowerCase().replace(/[^a-z0-9]/g, '-')
    const iconName = `${slug}-${Date.now()}.svg`
    const { error: iconErr } = await supabase.storage
      .from('army-pdfs')
      .upload(`icons/${iconName}`, editIcon.value)

    if (iconErr) {
      editIconUploading.value = false
      saving.value = false
      return
    }

    const { data: { publicUrl } } = supabase.storage
      .from('army-pdfs')
      .getPublicUrl(`icons/${iconName}`)
    coverImage = publicUrl
    editIconUploading.value = false
  }

  // Avec un codex rattaché, nom, faction, citation et icône n'existent plus qu'une
  // fois : le codex les écrit ici à chaque publication. Les renvoyer depuis la fiche
  // écraserait la publication par ce que l'écran affichait.
  const updateData: Record<string, unknown> = { status: editStatus.value }
  if (!editingCodex.value) {
    updateData.name = editName.value
    updateData.faction = editFaction.value
    updateData.quote = editQuote.value || null
    updateData.quote_author = editQuoteAuthor.value || null
    if (coverImage !== undefined) updateData.cover_image = coverImage
  }

  const { error } = await supabase
    .from('armies')
    .update(updateData)
    .eq('id', editingArmy.value.id)
  if (!error) {
    // Save tag assignments
    await $fetch(`/api/armies/${editingArmy.value.id}/tags`, {
      method: 'PUT',
      body: { tagIds: editArmyTags.value },
    })
    editingArmy.value = null
    editingCodex.value = null
    await refresh()
  }
  saving.value = false
}

async function archiveArmy(army: Army) {
  const action = army.status === 'archived' ? 'restaurer' : 'archiver'
  if (!confirm(`Voulez-vous ${action} "${army.name}" ?`)) return

  const newStatus = army.status === 'archived' ? 'official' : 'archived'
  await supabase
    .from('armies')
    .update({ status: newStatus })
    .eq('id', army.id)
  await refresh()
}

// ── Création d'un codex ──
// Une nouvelle armée naît désormais de son codex : c'est lui qui porte le nom, la
// faction, le statut, la citation et l'icône, et qui produit le PDF. La fiche
// `armies` n'est conservée que pour les armées historiques, dont le PDF a été
// téléversé à la main.
const showCreateModal = ref(false)
const createName = ref('')
const createFaction = ref<'imperium' | 'chaos' | 'xenos'>('imperium')
const createType = ref<'armee' | 'soutien'>('armee')
const creating = ref(false)
const createError = ref('')

function resetCreateModal() {
  createName.value = ''
  createFaction.value = 'imperium'
  createType.value = 'armee'
  createError.value = ''
}

async function createArmy() {
  if (!createName.value.trim()) {
    createError.value = 'Le nom est obligatoire.'
    return
  }
  creating.value = true
  createError.value = ''
  try {
    const r = await $fetch<{ slug: string }>('/api/admin/codex', {
      method: 'POST',
      body: { nom: createName.value.trim(), faction: createFaction.value, type: createType.value },
    })
    await navigateTo(`/admin/codex/${r.slug}`)
  } catch (e) {
    createError.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
  } finally {
    creating.value = false
  }
}

/** Transcrit une armée historique : le codex part de son nom et garde le lien vers sa fiche. */
const creationPour = ref<string | null>(null)
async function creerCodexPour(army: ArmyWithVersion) {
  creationPour.value = army.id
  try {
    const r = await $fetch<{ slug: string }>('/api/admin/codex', {
      method: 'POST',
      body: { nom: army.name, faction: army.faction, armee_id: army.id },
    })
    await navigateTo(`/admin/codex/${r.slug}`)
  } catch (e) {
    createError.value = (e as { data?: { message?: string } }).data?.message ?? (e as Error).message
    showCreateModal.value = false
    alert(createError.value)
  } finally {
    creationPour.value = null
  }
}

function openAddVersion() {
  showAddVersion.value = true
  uploadError.value = ''
  uploadFile.value = null
  uploadChangelog.value = ''
  uploadDate.value = new Date().toISOString().slice(0, 10)
  uploadIsCurrent.value = true
  // Auto-increment version from latest
  const currentVersion = armyVersions.value.find(v => v.is_current) ?? armyVersions.value[0]
  const versionParts = (currentVersion?.version ?? '1.0').split('.')
  versionParts[versionParts.length - 1] = String(Number(versionParts[versionParts.length - 1]) + 1)
  uploadVersion.value = versionParts.join('.')
}

async function quickNewVersion(army: ArmyWithVersion) {
  await openVersions(army)
  openAddVersion()
}

function handleFileSelect(event: Event) {
  uploadFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

async function submitUpload() {
  if (!versionsArmy.value || !uploadFile.value || !uploadVersion.value) {
    uploadError.value = 'Veuillez remplir tous les champs et sélectionner un PDF.'
    return
  }
  // Le texte suit la version dans l'historique public : publier une mise à jour
  // sans dire ce qui change laisse le joueur devant un numéro de version seul.
  if (!uploadChangelog.value.trim()) {
    uploadError.value = 'Expliquez ce que change cette version : ce texte est affiché aux joueurs.'
    return
  }

  uploadingPdf.value = versionsArmy.value.id
  uploadError.value = ''

  const army = versionsArmy.value
  const filePath = `${army.faction}/${army.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-v${uploadVersion.value}.pdf`

  let publicUrl: string
  try {
    publicUrl = await uploadPdf(uploadFile.value, filePath)
  } catch (e: any) {
    uploadError.value = 'Erreur upload : ' + (e.message || e)
    uploadingPdf.value = null
    return
  }

  // If marking as current, unset previous current version
  if (uploadIsCurrent.value) {
    await supabase
      .from('army_versions')
      .update({ is_current: false })
      .eq('army_id', army.id)
      .eq('is_current', true)
  }

  // Create new version
  const publishedAt = uploadDate.value
    ? new Date(uploadDate.value).toISOString()
    : new Date().toISOString()

  await supabase.from('army_versions').insert({
    army_id: army.id,
    version: uploadVersion.value,
    pdf_url: publicUrl,
    changelog: uploadChangelog.value.trim(),
    is_current: uploadIsCurrent.value,
    published_at: publishedAt,
  })

  uploadingPdf.value = null
  showAddVersion.value = false
  await openVersions(army)
  await refresh()
}

// Version management
async function openVersions(army: ArmyWithVersion) {
  versionsArmy.value = army
  versionsLoading.value = true
  showAddVersion.value = false
  editingVersionId.value = null
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

// Inline version editing
const editingVersionId = ref<string | null>(null)
const editVersionChangelog = ref('')
const savingVersion = ref(false)

function startEditVersion(version: ArmyVersion) {
  editingVersionId.value = version.id
  editVersionChangelog.value = version.changelog ?? ''
}

function cancelEditVersion() {
  editingVersionId.value = null
  editVersionChangelog.value = ''
}

async function saveVersionChangelog(version: ArmyVersion) {
  savingVersion.value = true
  await supabase
    .from('army_versions')
    .update({ changelog: editVersionChangelog.value || null })
    .eq('id', version.id)

  editingVersionId.value = null
  if (versionsArmy.value) {
    await openVersions(versionsArmy.value)
  }
  savingVersion.value = false
}

// ── Tag management ──
const showTagsModal = ref(false)
const tagsLoading = ref(false)
const allTags = ref<ArmyTag[]>([])
const newTagName = ref('')
const newTagFaction = ref<string>('imperium')
const tagSaving = ref(false)
const tagError = ref('')

async function loadTags() {
  tagsLoading.value = true
  try {
    allTags.value = await $fetch<ArmyTag[]>('/api/army-tags', { query: { fresh: 1 } })
  } catch {
    allTags.value = []
  }
  tagsLoading.value = false
}

function openTagsModal() {
  showTagsModal.value = true
  tagError.value = ''
  newTagName.value = ''
  loadTags()
}

async function createTag() {
  if (!newTagName.value.trim()) return
  tagSaving.value = true
  tagError.value = ''

  const { error } = await supabase
    .from('army_tags')
    .insert({ name: newTagName.value.trim(), faction: newTagFaction.value, position: 0 })

  if (error) {
    tagError.value = error.message
  } else {
    newTagName.value = ''
    await loadTags()
  }
  tagSaving.value = false
}

async function deleteTag(tag: ArmyTag) {
  if (!confirm(`Supprimer le tag "${tag.name}" ?`)) return
  await supabase.from('army_tags').delete().eq('id', tag.id)
  await loadTags()
}

// ── Tag assignment for army editing ──
const editArmyTags = ref<string[]>([])

async function loadArmyTags(armyId: string) {
  const { data } = await supabase
    .from('army_tag_assignments')
    .select('tag_id')
    .eq('army_id', armyId)
  editArmyTags.value = data?.map(d => d.tag_id) ?? []
}

function toggleArmyTag(tagId: string) {
  const idx = editArmyTags.value.indexOf(tagId)
  if (idx >= 0) {
    editArmyTags.value.splice(idx, 1)
  } else {
    editArmyTags.value.push(tagId)
  }
}

// Tags available for the faction of the army being edited
const editFactionTags = computed(() =>
  allTags.value.filter(t => t.faction === editFaction.value),
)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-heading text-2xl font-bold text-gold">Armées</h1>
        <p class="mt-1 max-w-2xl text-sm text-gray-400">
          Une ligne par armée : son codex (unités, formations, règles) et sa fiche publique. Le codex fait foi sur le nom, la faction, le statut, la citation et l'icône ; la fiche ne garde que les tags et les PDF téléversés à la main.
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <AdminCodexGuide libelle="Comment créer une armée" />
        <button
          class="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          @click="openTagsModal"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" /><path stroke-linecap="round" stroke-linejoin="round" d="M6 6h.008v.008H6V6z" /></svg>
          Gérer les tags
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
          @click="showCreateModal = true; resetCreateModal()"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
          Nouvelle armée
        </button>
      </div>
    </div>

    <!-- Search + Filters -->
    <div class="mt-4 flex flex-wrap items-center gap-6">
      <BarreRecherche
        v-model="search"
        class="w-52"
        placeholder="Rechercher..."
        label="Rechercher une armée"
      />

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

    <!-- Liste unique : la fiche publique et le codex d'une armée sur la même ligne -->
    <div class="mt-8 overflow-x-auto rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full min-w-[820px]">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="w-full px-6 py-4 font-medium">Armée</th>
            <th class="px-6 py-4 font-medium">Faction</th>
            <th class="px-6 py-4 font-medium">Statut</th>
            <th class="whitespace-nowrap px-6 py-4 font-medium">Codex</th>
            <th class="whitespace-nowrap px-6 py-4 font-medium">PDF téléversé</th>
            <th class="px-6 py-4 font-medium text-right" colspan="4">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr
            v-for="ligne in lignesFiltrees"
            :key="ligne.cle"
            class="transition-colors hover:bg-surface-light/50"
          >
            <td class="px-6 py-4 text-base font-medium text-gray-200">
              <!-- Le genre de la liste se lit avant son nom : la pastille passe au-dessus plutôt qu'à la suite. -->
              <span
                v-if="ligne.codex?.type === 'soutien'"
                class="mb-1 inline-block rounded bg-gold/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-gold"
              >soutien partagé</span>
              <span class="flex items-center gap-3 whitespace-nowrap">
                <span
                  v-if="ligne.codex"
                  class="inline-block h-3 w-3 shrink-0 rounded-full border border-white/20"
                  :style="{ background: ligne.codex.couleur ?? '#8a6d3b' }"
                />
                {{ ligne.nom }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span class="rounded-full border border-white/10 bg-surface-lighter px-3 py-1 text-xs capitalize text-gray-400">
                {{ ligne.faction }}
              </span>
            </td>
            <td class="px-6 py-4">
              <span
                :class="[
                  'rounded-full px-3 py-1 text-xs font-semibold',
                  ligne.statut === 'official' && 'bg-emerald-500/10 text-emerald-400',
                  ligne.statut === 'beta' && 'bg-amber-500/10 text-amber-400',
                  ligne.statut === 'experimental' && 'bg-purple-500/10 text-purple-400',
                  ligne.statut === '30k' && 'bg-red-500/10 text-red-400',
                  ligne.statut === 'archived' && 'bg-gray-500/10 text-gray-400',
                ]"
              >
                {{ statusLabels[ligne.statut] ?? ligne.statut }}
              </span>
            </td>
            <td class="whitespace-nowrap px-6 py-4 text-sm">
              <template v-if="ligne.codex">
                <span :class="ligne.codex.source === 'brouillon' ? 'text-gray-500' : 'text-gray-300'">
                  {{ ligne.codex.source === 'brouillon' ? 'jamais publié' : 'REV ' + ligne.codex.version }}
                </span>
                <span
                  v-if="ligne.codex.brouillon"
                  class="ml-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300"
                  :title="ligne.codex.brouillon_modifie ? 'Modifié le ' + new Date(ligne.codex.brouillon_modifie).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''"
                >brouillon</span>
              </template>
              <span v-else-if="!codexCharges" class="text-gray-600">…</span>
              <span v-else class="text-gray-600">aucun</span>
            </td>
            <td class="px-6 py-4">
              <span class="text-sm text-gray-400">
                {{ ligne.armee?.army_versions?.[0]?.version ? 'REV ' + ligne.armee.army_versions[0].version : '-' }}
              </span>
            </td>
            <!-- Une cellule par action : c'est le tableau qui les aligne, sinon le bouton
                 Codex glisse d'une ligne à l'autre selon le nombre de boutons qui suivent. -->
            <td class="whitespace-nowrap py-4 pl-6 pr-1 text-right">
              <NuxtLink
                v-if="ligne.codex"
                :to="`/admin/codex/${ligne.codex.slug}`"
                class="inline-flex items-center gap-1.5 rounded-lg bg-gold/90 px-3 py-1.5 text-xs font-semibold text-surface transition-colors hover:bg-gold-light"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                Codex
              </NuxtLink>
              <button
                v-else-if="ligne.armee && codexCharges"
                :disabled="creationPour === ligne.armee.id"
                class="inline-flex items-center gap-1.5 rounded-lg border border-gold/20 px-3 py-1.5 text-xs text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
                @click="creerCodexPour(ligne.armee)"
              >
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                {{ creationPour === ligne.armee.id ? 'Création…' : 'Créer le codex' }}
              </button>
            </td>

            <template v-if="ligne.armee">
              <td class="whitespace-nowrap py-4 px-1 text-right">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5"
                  @click="startEdit(ligne.armee, ligne.codex)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Fiche
                </button>
              </td>
              <td class="whitespace-nowrap py-4 px-1 text-right">
                <button
                  class="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white/5"
                  @click="openVersions(ligne.armee)"
                >
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  PDF
                </button>
              </td>
              <td class="whitespace-nowrap py-4 pl-1 pr-6 text-right">
                <button
                  :class="[
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    ligne.armee.status === 'archived'
                      ? 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10'
                      : 'border-red-500/20 text-red-400 hover:bg-red-500/10',
                  ]"
                  @click="archiveArmy(ligne.armee)"
                >
                  <svg v-if="ligne.armee.status === 'archived'" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                  <svg v-else class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>
                  {{ ligne.armee.status === 'archived' ? 'Restaurer' : 'Archiver' }}
                </button>
              </td>
            </template>
            <td v-else colspan="3" class="whitespace-nowrap py-4 pl-3 pr-6 text-xs text-gray-600">pas de fiche publique</td>
          </tr>
        </tbody>
      </table>
    </div>
    <!-- Edit army modal -->
    <Teleport to="body">
      <div v-if="editingArmy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div class="flex w-full max-w-2xl max-h-[90vh] flex-col rounded-xl border border-gold/20 bg-surface-light">
          <div class="shrink-0 px-4 pt-4 sm:px-8 sm:pt-8">
            <h2 class="font-heading text-2xl font-bold text-gold">Fiche publique</h2>
          </div>

          <div class="flex-1 overflow-y-auto px-4 py-4 sm:px-8 space-y-4">
            <!-- Avec un codex, la fiche n'a plus rien à saisir en double : tout ce qui suit se règle là-bas. -->
            <NuxtLink
              v-if="editingCodex"
              :to="`/admin/codex/${editingCodex.slug}`"
              class="block rounded-lg border border-gold/20 bg-gold/5 px-4 py-3 text-sm text-gray-300 transition-colors hover:bg-gold/10"
            >
              Nom, faction, statut, citation et icône viennent du codex
              <span class="font-semibold text-gold">{{ editingCodex.nom }}</span>, et la fiche les reçoit à chaque publication.
              <span class="mt-1 block text-xs text-gold">Ouvrir le codex pour les modifier</span>
            </NuxtLink>

            <div v-if="!editingCodex">
              <label class="block text-sm font-medium text-gray-300">Nom</label>
              <input
                v-model="editName"
                type="text"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div v-if="!editingCodex">
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

            <div v-if="!editingCodex">
              <label class="block text-sm font-medium text-gray-300">Statut</label>
              <select
                v-model="editStatus"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
                <option value="official">Officiel</option>
                <option value="beta">Bêta</option>
                <option value="experimental">Expérimental</option>
                <option value="30k">30k</option>
                <option value="archived">Archivé</option>
              </select>
            </div>

            <div v-if="!editingCodex">
              <label class="block text-sm font-medium text-gray-300">Citation</label>
              <textarea
                v-model="editQuote"
                rows="3"
                placeholder="« Il n'y a pas de paix parmi les étoiles... »"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              />
            </div>

            <div v-if="!editingCodex">
              <label class="block text-sm font-medium text-gray-300">Auteur de la citation</label>
              <input
                v-model="editQuoteAuthor"
                type="text"
                placeholder="ex: Commissaire Yarrick"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div v-if="!editingCodex">
              <label class="block text-sm font-medium text-gray-300">Icône (SVG)</label>
              <div v-if="editingArmy?.cover_image" class="mt-1 mb-2 flex items-center gap-3">
                <img :src="editingArmy.cover_image" alt="Icône actuelle" class="h-10 w-10 rounded object-contain">
                <span class="text-xs text-gray-500">Icône actuelle</span>
              </div>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-4 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" /></svg>
                {{ editIcon ? editIcon.name : 'Changer l\'icône (optionnel)' }}
                <input type="file" accept=".svg" class="hidden" @change="editIcon = ($event.target as HTMLInputElement).files?.[0] ?? null">
              </label>
            </div>

            <div v-if="editFactionTags.length">
              <label class="block text-sm font-medium text-gray-300">Tags</label>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="tag in editFactionTags"
                  :key="tag.id"
                  type="button"
                  :class="[
                    'rounded-full border px-3 py-1 text-xs font-semibold transition-all',
                    editArmyTags.includes(tag.id)
                      ? 'border-gold/30 bg-gold/15 text-gold'
                      : 'border-white/10 bg-surface text-gray-400 hover:border-gold/20 hover:text-gray-300',
                  ]"
                  @click="toggleArmyTag(tag.id)"
                >
                  {{ tag.name }}
                </button>
              </div>
            </div>
          </div>

          <div class="shrink-0 flex justify-end gap-3 border-t border-gold/10 px-4 py-4 sm:px-8">
            <button
              class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
              @click="editingArmy = null; editingCodex = null"
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

    <!-- Versions modal -->
    <Teleport to="body">
      <div v-if="versionsArmy" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-6 sm:mx-0">
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-xl font-bold text-gold">Versions ({{ versionsArmy.name }})</h2>
            <button class="text-gray-400 hover:text-gray-200" @click="versionsArmy = null">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Add version button -->
          <div v-if="!showAddVersion && !versionsLoading" class="mt-4">
            <button
              class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
              @click="openAddVersion"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
              Ajouter une version
            </button>
          </div>

          <!-- Add version form -->
          <div v-if="showAddVersion" class="mt-4 rounded-lg border border-gold/20 bg-surface/50 p-4">
            <h3 class="text-sm font-semibold text-gold">Nouvelle version</h3>
            <form class="mt-3 space-y-3" @submit.prevent="submitUpload">
              <div v-if="uploadError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {{ uploadError }}
              </div>

              <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label class="block text-xs font-medium text-gray-400">Numéro de version</label>
                  <input
                    v-model="uploadVersion"
                    type="text"
                    required
                    placeholder="ex: 1.4"
                    class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  >
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-400">Date de publication</label>
                  <input
                    v-model="uploadDate"
                    type="date"
                    required
                    class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  >
                </div>

                <div>
                  <label class="block text-xs font-medium text-gray-400">Fichier PDF</label>
                  <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-3 py-2 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                    <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span class="truncate">{{ uploadFile ? uploadFile.name : 'Sélectionner un PDF' }}</span>
                    <input type="file" accept=".pdf" class="hidden" @change="handleFileSelect">
                  </label>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-400">Explications de la mise à jour</label>
                <p class="mt-0.5 text-xs text-gray-500">Affiché aux joueurs dans l'historique des versions.</p>
                <textarea
                  v-model="uploadChangelog"
                  rows="2"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  placeholder="Ce qui change pour le joueur : corrections de points, ajout d'unités..."
                />
              </div>

              <label class="flex items-center gap-2">
                <input
                  v-model="uploadIsCurrent"
                  type="checkbox"
                  class="h-4 w-4 rounded border-white/10 bg-surface text-gold accent-gold focus:ring-gold/20"
                >
                <span class="text-xs text-gray-400">Définir comme version actuelle</span>
              </label>

              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200"
                  @click="showAddVersion = false"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  :disabled="!!uploadingPdf || !uploadChangelog.trim()"
                  class="rounded-lg bg-gold px-4 py-1.5 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
                >
                  {{ uploadingPdf ? 'Upload en cours...' : 'Publier' }}
                </button>
              </div>
            </form>
          </div>

          <div v-if="versionsLoading" class="py-8 text-center text-gray-400">Chargement...</div>

          <!-- Versions list -->
          <div v-else class="mt-4 max-h-80 divide-y divide-gold/5 overflow-y-auto">
            <div
              v-for="v in armyVersions"
              :key="v.id"
              class="py-3"
            >
              <div class="flex items-center justify-between">
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
                    v-if="editingVersionId !== v.id"
                    class="rounded-md px-2 py-1 text-xs text-blue-400 hover:bg-blue-400/10"
                    @click="startEditVersion(v)"
                  >
                    Modifier
                  </button>
                  <button
                    v-if="!v.is_current"
                    class="rounded-md px-2 py-1 text-xs text-gold hover:bg-gold/10"
                    @click="rollbackTo(v)"
                  >
                    Restaurer
                  </button>
                  <button
                    v-if="!v.is_current && isSuperAdmin"
                    class="rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-400/10"
                    @click="deleteVersion(v)"
                  >
                    Supprimer
                  </button>
                </div>
              </div>

              <!-- Changelog display -->
              <div v-if="editingVersionId !== v.id && v.changelog" class="mt-1 pl-2 text-xs text-gray-500 italic">
                {{ v.changelog }}
              </div>

              <!-- Changelog inline edit -->
              <div v-if="editingVersionId === v.id" class="mt-2">
                <textarea
                  v-model="editVersionChangelog"
                  rows="2"
                  placeholder="Description de la version..."
                  class="w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                />
                <div class="mt-1 flex justify-end gap-2">
                  <button
                    class="rounded-md px-2 py-1 text-xs text-gray-400 hover:text-gray-200"
                    @click="cancelEditVersion"
                  >
                    Annuler
                  </button>
                  <button
                    :disabled="savingVersion"
                    class="rounded-md bg-gold/10 px-3 py-1 text-xs font-semibold text-gold hover:bg-gold/20 disabled:opacity-50"
                    @click="saveVersionChangelog(v)"
                  >
                    {{ savingVersion ? 'Sauvegarde...' : 'Enregistrer' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Nouvelle armée : on crée son codex, c'est lui qui porte tout le reste -->
    <Teleport to="body">
      <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" @click.self="showCreateModal = false">
        <div class="w-full max-w-md rounded-xl border border-gold/20 bg-surface-light p-6">
          <h2 class="font-heading text-2xl font-bold text-gold">Nouvelle armée</h2>
          <p class="mt-1 text-sm text-gray-400">
            Une armée naît de son codex : unités, formations et règles. Le PDF et la construction d'armée en découlent.
          </p>

          <form class="mt-5 space-y-4" @submit.prevent="createArmy">
            <div class="grid grid-cols-2 gap-2 text-sm">
              <button
                type="button"
                :class="[
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  createType === 'armee' ? 'border-gold bg-gold/10 text-gray-100' : 'border-white/10 text-gray-400 hover:border-white/30',
                ]"
                @click="createType = 'armee'"
              >
                <span class="block font-semibold">Armée jouable</span>
                <span class="block text-xs">Codex complet : deux sections de départ et le budget « 1/3 des points ».</span>
              </button>
              <button
                type="button"
                :class="[
                  'rounded-md border px-3 py-2 text-left transition-colors',
                  createType === 'soutien' ? 'border-gold bg-gold/10 text-gray-100' : 'border-white/10 text-gray-400 hover:border-white/30',
                ]"
                @click="createType = 'soutien'"
              >
                <span class="block font-semibold">Liste de soutien partagée</span>
                <span class="block text-xs">Titans, aviation… proposée en alliance par d'autres codex, pas jouable seule.</span>
              </button>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Nom</label>
              <input
                v-model="createName"
                type="text"
                required
                placeholder="ex: Eldars d'Yme-Loc"
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

            <div v-if="createError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ createError }}
            </div>

            <div class="flex justify-end gap-3 pt-1">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                @click="showCreateModal = false"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="creating || !createName.trim()"
                class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
              >
                {{ creating ? 'Création...' : 'Créer' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Tags management modal -->
    <Teleport to="body">
      <div v-if="showTagsModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <div class="flex items-center justify-between">
            <h2 class="font-heading text-2xl font-bold text-gold">Gestion des tags</h2>
            <button class="text-gray-400 hover:text-gray-200" @click="showTagsModal = false">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p class="mt-2 text-sm text-gray-400">
            Les tags permettent de filtrer les armées sur les pages publiques (ex: Eldars, Orcs sur la page Xenos).
          </p>

          <!-- Add tag form -->
          <form class="mt-6 flex items-end gap-3" @submit.prevent="createTag">
            <div class="flex-1">
              <label class="block text-xs font-medium text-gray-400">Nom du tag</label>
              <input
                v-model="newTagName"
                type="text"
                required
                placeholder="ex: Eldars"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-400">Faction</label>
              <select
                v-model="newTagFaction"
                class="mt-1 rounded-lg border border-white/10 bg-surface px-3 py-2 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
                <option value="imperium">Imperium</option>
                <option value="chaos">Chaos</option>
                <option value="xenos">Xenos</option>
              </select>
            </div>
            <button
              type="submit"
              :disabled="tagSaving"
              class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
            >
              Ajouter
            </button>
          </form>

          <div v-if="tagError" class="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {{ tagError }}
          </div>

          <!-- Tags list grouped by faction -->
          <div v-if="tagsLoading" class="mt-6 py-8 text-center text-gray-400">Chargement...</div>
          <div v-else class="mt-6 space-y-6">
            <div v-for="fac in ['imperium', 'chaos', 'xenos']" :key="fac">
              <h3
                v-if="allTags.filter(t => t.faction === fac).length"
                class="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                {{ factionLabels[fac] }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <div
                  v-for="tag in allTags.filter(t => t.faction === fac)"
                  :key="tag.id"
                  class="group flex items-center gap-1.5 rounded-full border border-white/10 bg-surface px-3 py-1.5"
                >
                  <span class="text-sm text-gray-200">{{ tag.name }}</span>
                  <button
                    class="ml-1 text-gray-500 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                    @click="deleteTag(tag)"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="!tagsLoading && !allTags.length" class="mt-6 py-8 text-center text-gray-500">
            Aucun tag pour le moment.
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
