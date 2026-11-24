<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabase()
const { uploadPdf } = useUploadPdf()

interface Archive {
  id: string
  title: string
  description: string | null
  annee: number
  pdf_url: string
  created_at: string
}

const archives = ref<Archive[]>([])
const loading = ref(true)
/** la table n'existe pas encore : supabase/archives.sql n'a pas été exécuté */
const tableAbsente = ref(false)
const showModal = ref(false)
const editing = ref<Archive | null>(null)
const saving = ref(false)
const formError = ref('')
const uploadFile = ref<File | null>(null)

const form = ref({ title: '', description: '', annee: new Date().getFullYear() })

async function fetchArchives() {
  loading.value = true
  const { data, error } = await supabase.from('archives').select('*').order('annee').order('title')
  tableAbsente.value = !!error && (error.code === '42P01' || /does not exist|schema cache/i.test(error.message))
  archives.value = data ?? []
  loading.value = false
}

function openCreate() {
  editing.value = null
  form.value = { title: '', description: '', annee: archives.value.at(-1)?.annee ?? 1997 }
  uploadFile.value = null
  formError.value = ''
  showModal.value = true
}

function openEdit(a: Archive) {
  editing.value = a
  form.value = { title: a.title, description: a.description ?? '', annee: a.annee }
  uploadFile.value = null
  formError.value = ''
  showModal.value = true
}

async function save() {
  if (!form.value.title.trim()) {
    formError.value = 'Le titre est obligatoire.'
    return
  }
  const annee = Number(form.value.annee)
  if (!Number.isInteger(annee) || annee < 1980 || annee > 2100) {
    formError.value = 'L\'année de publication est obligatoire (ex : 2003).'
    return
  }
  if (!editing.value && !uploadFile.value) {
    formError.value = 'Veuillez sélectionner un PDF.'
    return
  }

  saving.value = true
  formError.value = ''

  let pdfUrl = editing.value?.pdf_url ?? ''
  if (uploadFile.value) {
    const slug = form.value.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')
    try {
      pdfUrl = await uploadPdf(uploadFile.value, `archives/${annee}-${slug}-${Date.now()}.pdf`)
    } catch (e) {
      formError.value = 'Erreur upload : ' + ((e as Error).message || e)
      saving.value = false
      return
    }
  }

  const payload = { title: form.value.title.trim(), description: form.value.description.trim() || null, annee, pdf_url: pdfUrl }
  const { error } = editing.value
    ? await supabase.from('archives').update(payload).eq('id', editing.value.id)
    : await supabase.from('archives').insert(payload)
  if (error) formError.value = error.message

  if (!formError.value) {
    showModal.value = false
    await fetchArchives()
  }
  saving.value = false
}

async function remove(a: Archive) {
  if (!confirm(`Supprimer « ${a.title} » des archives ?`)) return
  await supabase.from('archives').delete().eq('id', a.id)
  await fetchArchives()
}

onMounted(fetchArchives)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="font-heading text-2xl font-bold text-gold">Archives</h1>
        <p class="mt-1 max-w-2xl text-sm text-gray-400">
          Documents d'origine du jeu et suppléments publiés par Games Workshop. La page publique « Archives » les classe par année de publication.
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light disabled:opacity-50"
        :disabled="tableAbsente"
        @click="openCreate"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Nouveau document
      </button>
    </div>

    <div v-if="tableAbsente" class="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-300">
      La table des archives n'existe pas encore : exécutez <code>supabase/archives.sql</code> dans l'éditeur SQL de Supabase.
    </div>

    <div class="mt-8 overflow-x-auto rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full min-w-[640px]">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-6 py-4 font-medium">Année</th>
            <th class="w-full px-6 py-4 font-medium">Document</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr v-if="loading">
            <td colspan="3" class="px-6 py-8 text-center text-gray-400">Chargement...</td>
          </tr>
          <tr v-else-if="!archives.length">
            <td colspan="3" class="px-6 py-8 text-center text-gray-500">Aucun document.</td>
          </tr>
          <tr v-for="a in archives" v-else :key="a.id" class="transition-colors hover:bg-surface-light/50">
            <td class="px-6 py-4 text-sm font-semibold text-gold">{{ a.annee }}</td>
            <td class="px-6 py-4">
              <a :href="a.pdf_url" target="_blank" rel="noopener" class="text-base font-medium text-gray-200 hover:text-gold">{{ a.title }}</a>
              <p v-if="a.description" class="mt-1 line-clamp-1 text-sm text-gray-500">{{ a.description }}</p>
            </td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-3">
                <button class="rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/10" @click="openEdit(a)">Modifier</button>
                <button class="rounded-lg border border-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10" @click="remove(a)">Supprimer</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">{{ editing ? 'Modifier le document' : 'Nouveau document' }}</h2>

          <form class="mt-6 space-y-4" @submit.prevent="save">
            <div v-if="formError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{{ formError }}</div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
              <div>
                <label class="block text-sm font-medium text-gray-300">Titre</label>
                <input
                  v-model="form.title"
                  type="text"
                  required
                  placeholder="ex : Epic Armageddon — livre de règles"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300">Année</label>
                <input
                  v-model.number="form.annee"
                  type="number"
                  min="1980"
                  max="2100"
                  required
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                v-model="form.description"
                rows="2"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">{{ editing ? 'Remplacer le PDF (optionnel)' : 'Fichier PDF' }}</label>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-4 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                {{ uploadFile ? uploadFile.name : 'Sélectionner un PDF' }}
                <input type="file" accept=".pdf" class="hidden" @change="uploadFile = ($event.target as HTMLInputElement).files?.[0] ?? null">
              </label>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button type="button" class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200" @click="showModal = false">Annuler</button>
              <button type="submit" :disabled="saving" class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50">
                {{ saving ? 'Enregistrement...' : (editing ? 'Enregistrer' : 'Ajouter') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
