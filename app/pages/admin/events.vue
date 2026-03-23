<script setup lang="ts">
import type { GameEvent } from '~/types/database'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabase()

const events = ref<GameEvent[]>([])
const loading = ref(true)
const showModal = ref(false)
const editingEvent = ref<GameEvent | null>(null)
const saving = ref(false)
const formError = ref('')

// Form
const form = ref({
  title: '',
  description: '',
  external_link: '',
  address: '',
  contact: '',
  event_date: '',
  event_end_date: '',
})

async function fetchEvents() {
  loading.value = true
  const { data } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: false })
  events.value = data ?? []
  loading.value = false
}

function openCreate() {
  editingEvent.value = null
  form.value = {
    title: '',
    description: '',
    external_link: '',
    address: '',
    contact: '',
    event_date: '',
    event_end_date: '',
  }
  formError.value = ''
  showModal.value = true
}

function openEdit(event: GameEvent) {
  editingEvent.value = event
  form.value = {
    title: event.title,
    description: event.description ?? '',
    external_link: event.external_link ?? '',
    address: event.address ?? '',
    contact: event.contact ?? '',
    event_date: event.event_date,
    event_end_date: event.event_end_date ?? '',
  }
  formError.value = ''
  showModal.value = true
}

async function saveEvent() {
  if (!form.value.title || !form.value.event_date) {
    formError.value = 'Le titre et la date sont obligatoires.'
    return
  }

  saving.value = true
  formError.value = ''

  const payload = {
    title: form.value.title,
    description: form.value.description || null,
    external_link: form.value.external_link || null,
    address: form.value.address || null,
    contact: form.value.contact || null,
    event_date: form.value.event_date,
    event_end_date: form.value.event_end_date || null,
  }

  if (editingEvent.value) {
    const { error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', editingEvent.value.id)
    if (error) formError.value = error.message
  } else {
    const { error } = await supabase
      .from('events')
      .insert(payload)
    if (error) formError.value = error.message
  }

  if (!formError.value) {
    showModal.value = false
    await fetchEvents()
  }
  saving.value = false
}

async function deleteEvent(event: GameEvent) {
  if (!confirm(`Supprimer "${event.title}" ?`)) return
  await supabase.from('events').delete().eq('id', event.id)
  await fetchEvents()
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

onMounted(fetchEvents)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-heading text-2xl font-bold text-gold">Événements</h1>
      <button
        class="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface transition-colors hover:bg-gold-light"
        @click="openCreate"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
        Nouvel événement
      </button>
    </div>

    <!-- Events table -->
    <div class="mt-8 overflow-x-auto rounded-xl border border-gold/10 bg-surface-light/30">
      <table class="w-full min-w-[640px]">
        <thead class="border-b border-gold/10 bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-6 py-4 font-medium">Événement</th>
            <th class="px-6 py-4 font-medium">Date</th>
            <th class="px-6 py-4 font-medium">Lieu</th>
            <th class="px-6 py-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr v-if="loading">
            <td colspan="4" class="px-6 py-8 text-center text-gray-400">Chargement...</td>
          </tr>
          <tr v-else-if="!events.length">
            <td colspan="4" class="px-6 py-8 text-center text-gray-500">Aucun événement</td>
          </tr>
          <tr
            v-for="event in events"
            v-else
            :key="event.id"
            class="transition-colors hover:bg-surface-light/50"
          >
            <td class="px-6 py-4">
              <p class="text-base font-medium text-gray-200">{{ event.title }}</p>
              <p v-if="event.description" class="mt-1 line-clamp-1 text-sm text-gray-500">{{ event.description }}</p>
            </td>
            <td class="px-6 py-4 text-sm text-gray-400">
              {{ formatDate(event.event_date) }}
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              {{ event.address ?? '-' }}
            </td>
            <td class="px-6 py-4">
              <div class="flex justify-end gap-3">
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-gold/20 px-4 py-2 text-sm text-gold transition-colors hover:bg-gold/10"
                  @click="openEdit(event)"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" /></svg>
                  Modifier
                </button>
                <button
                  class="inline-flex items-center gap-2 rounded-lg border border-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/10"
                  @click="deleteEvent(event)"
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

    <!-- Create/Edit modal -->
    <Teleport to="body">
      <div v-if="showModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-2xl rounded-xl border border-gold/20 bg-surface-light p-4 sm:mx-0 sm:p-8">
          <h2 class="font-heading text-2xl font-bold text-gold">
            {{ editingEvent ? 'Modifier l\'événement' : 'Nouvel événement' }}
          </h2>

          <form class="mt-6 space-y-4" @submit.prevent="saveEvent">
            <div v-if="formError" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
              {{ formError }}
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Titre</label>
              <input
                v-model="form.title"
                type="text"
                required
                placeholder="ex: Tournoi EA Championship 2026"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Description</label>
              <textarea
                v-model="form.description"
                rows="3"
                placeholder="Décrivez l'événement..."
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              />
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-300">Date de début</label>
                <input
                  v-model="form.event_date"
                  type="date"
                  required
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300">Date de fin (optionnel)</label>
                <input
                  v-model="form.event_end_date"
                  type="date"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-300">Adresse / Lieu</label>
              <input
                v-model="form.address"
                type="text"
                placeholder="ex: Salle des fêtes, 75001 Paris"
                class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
              >
            </div>

            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="block text-sm font-medium text-gray-300">Contact</label>
                <input
                  v-model="form.contact"
                  type="text"
                  placeholder="ex: Jean Dupont (Discord: jean#1234)"
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-300">Lien externe (optionnel)</label>
                <input
                  v-model="form.external_link"
                  type="url"
                  placeholder="https://..."
                  class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
                >
              </div>
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
                {{ saving ? 'Enregistrement...' : (editingEvent ? 'Enregistrer' : 'Créer') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
