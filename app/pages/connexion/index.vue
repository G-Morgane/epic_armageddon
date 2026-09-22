<script setup lang="ts">
/**
 * Connexion des membres : un lien reçu par email, pas de mot de passe.
 * Le même formulaire crée le compte : il n'y a pas d'inscription séparée.
 */
const route = useRoute()
const { isAuthenticated, envoyerLienMagique } = useAuth()

useHead({ title: 'Connexion' })

const suivant = computed(() => {
  const v = route.query.suivant
  // uniquement un chemin interne : une URL absolue ouvrirait une redirection ailleurs
  return typeof v === 'string' && /^\/(?!\/)/.test(v) ? v : '/'
})

const email = ref('')
const envoye = ref(false)
const envoi = ref(false)
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
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-16">
    <h1 class="font-heading text-3xl font-bold text-gold">Connexion</h1>

    <template v-if="!envoye">
      <p class="mt-3 text-sm text-gray-400">
        Entre ton adresse email : tu recevras un lien de connexion. Pas de mot de passe à retenir.
        Si tu n'as pas encore de compte, il se crée tout seul.
      </p>

      <form class="mt-8 space-y-5" @submit.prevent="envoyer">
        <div v-if="erreur" class="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          {{ erreur }}
        </div>

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
