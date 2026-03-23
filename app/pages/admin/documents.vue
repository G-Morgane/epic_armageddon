<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabase()

interface Document {
  id: string
  title: string
  description: string | null
  version: string | null
  pdf_url: string
  sort_order: number
  created_at: string
}

const documents = ref<Document[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingDoc = ref<Document | null>(null)
const saving = ref(false)
const formError = ref('')
const uploadFile = ref<File | null>(null)

const form = ref({
  title: '',
  description: '',
  version: '',
  sort_order: 0,
})

async function fetchDocuments() {
  loading.value = true
  const { data } = await supabase.from('documents').select('*').order('sort_order')
  documents.value = data ?? []
  loading.value = false
}

function openCreate() {
  editingDoc.value = null
  form.value = { title: '', description: '', version: '', sort_order: documents.value.length + 1 }
  uploadFile.value = null
  formError.value = ''
  showModal.value = true
}

function openEdit(doc: Document) {
  editingDoc.value = doc
  form.value = {
    title: doc.title,
    description: doc.description ?? '',
    version: doc.version ?? '',
    sort_order: doc.sort_order,
  }
  uploadFile.value = null
  formError.value = ''
  showModal.value = true
}

async function saveDocument() {
  if (!form.value.title) {
    formError.value = 'Le titre est obligatoire.'
    return
  }
  if (!editingDoc.value && !uploadFile.value) {
    formError.value = 'Veuillez sélectionner un PDF.'
    return
  }

  saving.value = true
  formError.value = ''

  let pdfUrl = editingDoc.value?.pdf_url ?? ''

  // Upload new PDF if provided
  if (uploadFile.value) {
    const slug = form.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fileName = `regles/${slug}-${Date.now()}.pdf`

    const { error: upErr } = await supabase.storage
      .from('army-pdfs')
      .upload(fileName, uploadFile.value, { contentType: 'application/pdf' })

    if (upErr) {
      formError.value = 'Erreur upload : ' + upErr.message
      saving.value = false
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('army-pdfs').getPublicUrl(fileName)
    pdfUrl = publicUrl
  }

  const payload = {
    title: form.value.title,
    description: form.value.description || null,
    version: form.value.version || null,
    pdf_url: pdfUrl,
    sort_order: form.value.sort_order,
  }

  if (editingDoc.value) {
    const { error } = await supabase.from('documents').update(payload).eq('id', editingDoc.value.id)
    if (error) formError.value = error.message
  } else {
    const { error } = await supabase.from('documents').insert(payload)
    if (error) formError.value = error.message
  }

  if (!formError.value) {
    showModal.value = false
    await fetchDocuments()
  }
  saving.value = false
}

async function deleteDocument(doc: Document) {
  if (!confirm(`Supprimer "${doc.title}" ?`)) return
  await supabase.from('documents').delete().eq('id', doc.id)
  await fetchDocuments()
}

onMounted(fetchDocuments)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-heading text-2xl font-bold text-gold">Documents & Règles</h1>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
        @click="openCreate"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Nouveau document
      </button>
    </div>

    <!-- Table -->
    <div class="mt-8 overflow-x-auto rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full min-w-[640px]">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-6 py-4 font-medium">Ordre</th>
            <th class="px-6 py-4 font-medium">Document</th>
            <th class="px-6 py-4 font-medium">Version</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr v-if="loading">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">Chargement...</td>
          </tr>
          <tr
            v-for="doc in documents"
            v-else
            :key="doc.id"
            class="transition-colors hover:bg-surface-light/50"
          >
            <td class="px-6 py-4 text-sm text-gray-500">{{ doc.sort_order }}</td>
            <td class="px-6 py-4">
              <p class="text-base font-medium text-gray-200">{{ doc.title }}</p>
              <p v-if="doc.description" class="mt-1 line-clamp-1 text-sm text-gray-500">{{ doc.description }}</p>
            </td>
            <td class="px-6 py-4 text-sm text-gray-400">{{ doc.version ?? '-' }}</td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
                  @click="openEdit(doc)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Modifier
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  @click="deleteDocument(doc)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                  Supprimer
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">
            {{ editingDoc ? 'Modifier le document' : 'Nouveau document' }}
          </h2>

          <form class="mt-6 space-y-4" @submit.prevent="saveDocument">
            <div v-if="formError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ formError }}
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-300">Titre</label>
                <input
                  v-model="form.title"
                  type="text"
                  required
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium text-gray-300">Version</label>
                  <input
                    v-model="form.version"
                    type="text"
                    placeholder="ex: V.3"
                    class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  >
                </div>
                <div class="w-24">
                  <label class="block text-sm font-medium text-gray-300">Ordre</label>
                  <input
                    v-model.number="form.sort_order"
                    type="number"
                    class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                  >
                </div>
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
              <label class="block text-sm font-medium text-gray-300">
                {{ editingDoc ? 'Remplacer le PDF (optionnel)' : 'Fichier PDF' }}
              </label>
              <label class="mt-1 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-surface px-4 py-4 text-sm text-gray-400 transition-colors hover:border-gold/30 hover:text-gray-300">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                {{ uploadFile ? uploadFile.name : 'Sélectionner un PDF' }}
                <input type="file" accept=".pdf" class="hidden" @change="uploadFile = ($event.target as HTMLInputElement).files?.[0] ?? null">
              </label>
            </div>

            <div class="flex justify-end gap-3 pt-2">
              <button
                type="button"
                class="rounded-lg px-4 py-2 text-sm text-gray-400 hover:text-gray-200"
                @click="showModal = false"
              >
                Annuler
              </button>
              <button
                type="submit"
                :disabled="saving"
                class="rounded-lg bg-gold px-5 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
              >
                {{ saving ? 'Enregistrement...' : (editingDoc ? 'Enregistrer' : 'Créer') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
