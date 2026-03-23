<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabase()

interface Tool {
  id: string
  name: string
  description: string | null
  url: string
  button_label: string
  sort_order: number
  created_at: string
}

const tools = ref<Tool[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingTool = ref<Tool | null>(null)
const saving = ref(false)
const formError = ref('')

const form = ref({
  name: '',
  description: '',
  url: '',
  button_label: 'Ouvrir',
  sort_order: 0,
})

async function fetchTools() {
  loading.value = true
  const { data } = await supabase.from('tools').select('*').order('sort_order')
  tools.value = data ?? []
  loading.value = false
}

function openCreate() {
  editingTool.value = null
  form.value = { name: '', description: '', url: '', button_label: 'Ouvrir', sort_order: tools.value.length + 1 }
  formError.value = ''
  showModal.value = true
}

function openEdit(tool: Tool) {
  editingTool.value = tool
  form.value = {
    name: tool.name,
    description: tool.description ?? '',
    url: tool.url,
    button_label: tool.button_label,
    sort_order: tool.sort_order,
  }
  formError.value = ''
  showModal.value = true
}

async function saveTool() {
  if (!form.value.name || !form.value.url) {
    formError.value = 'Le nom et l\'URL sont obligatoires.'
    return
  }

  saving.value = true
  formError.value = ''

  const payload = {
    name: form.value.name,
    description: form.value.description || null,
    url: form.value.url,
    button_label: form.value.button_label || 'Ouvrir',
    sort_order: form.value.sort_order,
  }

  if (editingTool.value) {
    const { error } = await supabase.from('tools').update(payload).eq('id', editingTool.value.id)
    if (error) formError.value = error.message
  } else {
    const { error } = await supabase.from('tools').insert(payload)
    if (error) formError.value = error.message
  }

  if (!formError.value) {
    showModal.value = false
    await fetchTools()
  }
  saving.value = false
}

async function deleteTool(tool: Tool) {
  if (!confirm(`Supprimer "${tool.name}" ?`)) return
  await supabase.from('tools').delete().eq('id', tool.id)
  await fetchTools()
}

onMounted(fetchTools)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-heading text-2xl font-bold text-gold">Outils</h1>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
        @click="openCreate"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Nouvel outil
      </button>
    </div>

    <!-- Table -->
    <div class="mt-8 overflow-hidden rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-6 py-4 font-medium">Ordre</th>
            <th class="px-6 py-4 font-medium">Outil</th>
            <th class="px-6 py-4 font-medium">URL</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr v-if="loading">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">Chargement...</td>
          </tr>
          <tr
            v-for="tool in tools"
            v-else
            :key="tool.id"
            class="transition-colors hover:bg-surface-light/50"
          >
            <td class="px-6 py-4 text-sm text-gray-500">{{ tool.sort_order }}</td>
            <td class="px-6 py-4">
              <p class="text-base font-medium text-gray-200">{{ tool.name }}</p>
              <p v-if="tool.description" class="mt-1 line-clamp-1 text-sm text-gray-500">{{ tool.description }}</p>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              <a :href="tool.url" target="_blank" class="hover:text-gold">{{ tool.url.substring(0, 40) }}...</a>
            </td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
                  @click="openEdit(tool)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Modifier
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  @click="deleteTool(tool)"
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
        <div class="w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">
            {{ editingTool ? 'Modifier l\'outil' : 'Nouvel outil' }}
          </h2>

          <form class="mt-6 space-y-4" @submit.prevent="saveTool">
            <div v-if="formError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ formError }}
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-300">Nom</label>
                <input
                  v-model="form.name"
                  type="text"
                  required
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
              <div class="flex gap-4">
                <div class="flex-1">
                  <label class="block text-sm font-medium text-gray-300">Label du bouton</label>
                  <input
                    v-model="form.button_label"
                    type="text"
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
              <label class="block text-sm font-medium text-gray-300">URL</label>
              <input
                v-model="form.url"
                type="url"
                required
                placeholder="https://..."
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                v-model="form.description"
                rows="3"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              />
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
                {{ saving ? 'Enregistrement...' : (editingTool ? 'Enregistrer' : 'Créer') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
