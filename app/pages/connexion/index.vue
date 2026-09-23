<script setup lang="ts">
/**
 * Connexion des membres : un lien reçu par email, pas de mot de passe.
 * Le même formulaire crée le compte : il n'y a pas d'inscription séparée.
 */
const route = useRoute()
const { isAuthenticated, envoyerLienMagique, connexionGoogle } = useAuth()

useHead({ title: 'Connexion' })

const suivant = computed(() => {
  const v = route.query.suivant
  // uniquement un chemin interne : une URL absolue ouvrirait une redirection ailleurs
  return typeof v === 'string' && /^\/(?!\/)/.test(v) ? v : '/'
})

const email = ref('')
const envoye = ref(false)
const envoi = ref(false)
const google = ref(false)
const erreur = ref('')

onMounted(() => {
  if (isAuthenticated.value) navigateTo(suivant.value)
})

async function envoyer() {
  erreur.value = ''
  envoi.value = true
  try {
    await envoyerLienMagique(email.value, suivant.value)
    envoye.value = true
  } catch (e) {
    erreur.value = (e as Error).message === 'Email rate limit exceeded'
      ? 'Trop de liens demandés pour cette adresse. Réessaie dans quelques minutes.'
      : "Impossible d'envoyer le lien. Vérifie l'adresse et réessaie."
  } finally {
    envoi.value = false
  }
}

async function allerChezGoogle() {
  erreur.value = ''
  google.value = true
  try {
    // succès = le navigateur quitte la page, on ne repasse pas ici
    await connexionGoogle(suivant.value)
  } catch {
    erreur.value = 'Impossible de joindre Google. Réessaie, ou utilise le lien par email.'
    google.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-16">
    <h1 class="font-heading text-3xl font-bold text-gold">Connexion</h1>

    <template v-if="!envoye">
      <p class="mt-3 text-sm text-gray-400">
        Entre ton adresse email : tu recevras un lien de connexion. Pas de mot de passe à retenir.
        Si tu n'as pas encore de compte, il se crée tout seul.
      </p>

      <div v-if="erreur" class="mt-8 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
        {{ erreur }}
      </div>

      <form class="mt-8 space-y-5" @submit.prevent="envoyer">
        <div>
          <label for="email" class="block text-sm font-medium text-gray-300">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="mt-1 w-full rounded-lg border border-white/10 bg-surface-light px-4 py-2.5 text-gray-200 placeholder-gray-500 focus:border-gold/30 focus:outline-none focus:ring-1 focus:ring-gold/20"
            placeholder="toi@exemple.fr"
          >
        </div>

        <button
          type="submit"
          :disabled="envoi"
          class="w-full rounded-lg bg-gold py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-gold-light disabled:opacity-50"
        >
          {{ envoi ? 'Envoi...' : 'Recevoir mon lien de connexion' }}
        </button>
      </form>

      <div class="my-6 flex items-center gap-4">
        <span class="h-px flex-1 bg-white/10" />
        <span class="text-xs uppercase tracking-wide text-gray-500">ou</span>
        <span class="h-px flex-1 bg-white/10" />
      </div>

      <button
        type="button"
        :disabled="google"
        class="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-surface-light py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:border-white/20 disabled:opacity-50"
        @click="allerChezGoogle"
      >
        <svg class="h-4 w-4" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8a10.1 10.1 0 0 1-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z" />
          <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5a13 13 0 0 1-19.4-6.8H4.7v5.7A22 22 0 0 0 24 46z" />
          <path fill="#FBBC05" d="M11.9 28.4a13.2 13.2 0 0 1 0-8.4v-5.7H4.7a22 22 0 0 0 0 19.8l7.2-5.7z" />
          <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3A21.9 21.9 0 0 0 4.7 14.3l7.2 5.7A13 13 0 0 1 24 10.8z" />
        </svg>
        {{ google ? 'Redirection...' : 'Continuer avec Google' }}
      </button>

      <p class="mt-6 text-xs text-gray-500">
        Ton email sert uniquement à te reconnecter et à retrouver tes listes. Rien d'autre.
      </p>
    </template>

    <template v-else>
      <div class="mt-6 rounded-lg border border-gold/20 bg-gold/5 p-5">
        <p class="text-sm text-gray-200">
          Lien envoyé à <strong class="text-gold">{{ email }}</strong>.
        </p>
        <p class="mt-2 text-sm text-gray-400">
          Ouvre ta boîte mail et clique sur le lien pour te connecter. Il est valable une heure.
          Pense à regarder dans les indésirables.
        </p>
      </div>
      <button class="mt-5 text-sm text-gray-400 underline hover:text-gold" @click="envoye = false">
        Utiliser une autre adresse
      </button>
    </template>
  </div>
</template>
