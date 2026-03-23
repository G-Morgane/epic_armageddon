<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const supabase = useSupabase()
const { isSuperAdmin } = useAuth()

// Redirect if not super admin
if (!isSuperAdmin.value) {
  navigateTo('/admin')
}

interface Profile {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'super_admin'
  created_at: string
}

const profiles = ref<Profile[]>([])
const loading = ref(true)
const showInvite = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<'admin' | 'super_admin'>('admin')
const inviting = ref(false)
const inviteError = ref('')
const inviteSuccess = ref('')

async function fetchProfiles() {
  loading.value = true
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  profiles.value = data ?? []
  loading.value = false
}

async function updateRole(profile: Profile, newRole: 'admin' | 'super_admin') {
  await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', profile.id)
  await fetchProfiles()
}

async function deleteUser(profile: Profile) {
  if (!confirm(`Supprimer ${profile.email} ?`)) return
  await supabase
    .from('profiles')
    .delete()
    .eq('id', profile.id)
  await fetchProfiles()
}

async function inviteUser() {
  inviteError.value = ''
  inviteSuccess.value = ''
  inviting.value = true

  const { data: { session } } = await supabase.auth.getSession()
  const { error } = await $fetch('/api/admin/invite', {
    method: 'POST',
    body: { email: inviteEmail.value, role: inviteRole.value },
    headers: { Authorization: `Bearer ${session?.access_token}` },
  }).catch((e: any) => ({ error: e.data?.message ?? 'Erreur' })) as any

  if (error) {
    inviteError.value = typeof error === 'string' ? error : 'Erreur lors de l\'invitation'
  } else {
    inviteSuccess.value = `Invitation envoyée à ${inviteEmail.value}`
    inviteEmail.value = ''
    await fetchProfiles()
  }
  inviting.value = false
}

onMounted(fetchProfiles)
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <h1 class="font-heading text-2xl font-bold text-gold">Gestion des utilisateurs</h1>
      <button
        class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light"
        @click="showInvite = !showInvite"
      >
        Inviter un utilisateur
      </button>
    </div>

    <!-- Invite form -->
    <div v-if="showInvite" class="mt-4 rounded-lg border border-gold/20 bg-surface-light p-4">
      <form class="flex flex-wrap items-end gap-4" @submit.prevent="inviteUser">
        <div class="flex-1">
          <label class="block text-sm font-medium text-gray-300">Email</label>
          <input
            v-model="inviteEmail"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-gray-200 focus:border-gold/30 focus:outline-none"
            placeholder="email@exemple.com"
          >
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300">Rôle</label>
          <select
            v-model="inviteRole"
            class="mt-1 rounded-lg border border-white/10 bg-surface px-4 py-2 text-sm text-gray-200 focus:border-gold/30 focus:outline-none"
          >
            <option value="admin">Admin</option>
            <option value="super_admin">Super Admin</option>
          </select>
        </div>
        <button
          type="submit"
          :disabled="inviting"
          class="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-surface hover:bg-gold-light disabled:opacity-50"
        >
          {{ inviting ? 'Envoi...' : 'Inviter' }}
        </button>
      </form>
      <p v-if="inviteError" class="mt-2 text-sm text-red-400">{{ inviteError }}</p>
      <p v-if="inviteSuccess" class="mt-2 text-sm text-emerald-400">{{ inviteSuccess }}</p>
    </div>

    <!-- Users table -->
    <div class="mt-6 overflow-hidden rounded-lg border border-gold/10">
      <table class="w-full">
        <thead class="bg-surface-light text-left text-sm text-gray-400">
          <tr>
            <th class="px-4 py-3 font-medium">Utilisateur</th>
            <th class="px-4 py-3 font-medium">Email</th>
            <th class="px-4 py-3 font-medium">Rôle</th>
            <th class="px-4 py-3 font-medium">Inscrit le</th>
            <th class="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gold/5">
          <tr v-if="loading">
            <td colspan="5" class="px-4 py-8 text-center text-gray-400">Chargement...</td>
          </tr>
          <tr
            v-for="p in profiles"
            v-else
            :key="p.id"
            class="hover:bg-surface-light/50"
          >
            <td class="px-4 py-3 text-sm text-gray-200">{{ p.display_name ?? '-' }}</td>
            <td class="px-4 py-3 text-sm text-gray-400">{{ p.email }}</td>
            <td class="px-4 py-3">
              <select
                :value="p.role"
                class="rounded-md border border-white/10 bg-surface px-2 py-1 text-xs text-gray-300 focus:outline-none"
                @change="updateRole(p, ($event.target as HTMLSelectElement).value as any)"
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </td>
            <td class="px-4 py-3 text-sm text-gray-500">
              {{ new Date(p.created_at).toLocaleDateString('fr-FR') }}
            </td>
            <td class="px-4 py-3">
              <button
                class="rounded-md px-3 py-1 text-xs text-red-400 hover:bg-red-400/10"
                @click="deleteUser(p)"
              >
                Supprimer
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
