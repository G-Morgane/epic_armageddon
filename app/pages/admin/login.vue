<script setup lang="ts">
definePageMeta({ layout: false })

const { login, isAuthenticated, init, loading } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

onMounted(async () => {
  await init()
  if (isAuthenticated.value) {
    navigateTo('/admin')
  }
})

async function handleLogin() {
  error.value = ''
  submitting.value = true
  try {
    await login(email.value, password.value)
    // Check if first login
    const { data: { user: u } } = await useSupabase().auth.getUser()
    if (u?.user_metadata?.must_change_password) {
      navigateTo('/admin/setup-password')
    } else {
      navigateTo('/admin')
    }
  } catch (e: any) {
    error.value = 'Email ou mot de passe incorrect.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm">
      <div class="text-center">
        <h1 class="font-heading text-3xl font-bold text-gold">EA Admin</h1>
        <p class="mt-2 text-sm text-gray-400">Connectez-vous pour accéder au panneau d'administration</p>
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="handleLogin">
        <div v-if="error" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {{ error }}
        </div>

        <div>
          <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="admin@epicarmageddon.fr"
          >
        </div>

        <div>
          <label for="password" class="block text-sm font-medium text-gray-300">Mot de passe</label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="••••••••"
          >
        </div>

        <button
          type="submit"
          :disabled="submitting"
          class="w-full rounded-lg bg-gold py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {{ submitting ? 'Connexion...' : 'Se connecter' }}
        </button>
      </form>

      <div class="mt-6 text-center">
        <NuxtLink to="/" class="text-sm text-gray-500 hover:text-gold">
          Retour au site
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
