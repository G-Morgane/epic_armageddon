<script setup lang="ts">
definePageMeta({ layout: false })

const supabase = useSupabase()
const { user, init, loading } = useAuth()

const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const saving = ref(false)

onMounted(async () => {
  await init()
  if (!user.value) {
    navigateTo('/admin/login')
  }
})

async function handleSetPassword() {
  error.value = ''

  if (newPassword.value.length < 6) {
    error.value = 'Le mot de passe doit faire au moins 6 caractères.'
    return
  }

  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  saving.value = true

  const { error: updateErr } = await supabase.auth.updateUser({
    password: newPassword.value,
    data: { must_change_password: false },
  })

  if (updateErr) {
    error.value = updateErr.message
    saving.value = false
    return
  }

  navigateTo('/admin')
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm">
      <div class="text-center">
        <h1 class="font-heading text-3xl font-bold text-gold">Créer votre mot de passe</h1>
        <p class="mt-2 text-sm text-gray-400">C'est votre première connexion, veuillez définir un mot de passe sécurisé.</p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleSetPassword">
        <div v-if="error" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {{ error }}
        </div>

        <div>
          <label for="new-password" class="block text-sm font-medium text-gray-300">Nouveau mot de passe</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="••••••••"
          >
        </div>

        <div>
          <label for="confirm-password" class="block text-sm font-medium text-gray-300">Confirmer le mot de passe</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="••••••••"
          >
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full rounded-lg bg-gold py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {{ saving ? 'Enregistrement...' : 'Définir le mot de passe' }}
        </button>
      </form>
    </div>
  </div>
</template>
