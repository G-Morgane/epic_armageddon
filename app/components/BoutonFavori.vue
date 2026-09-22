<script setup lang="ts">
/**
 * Étoile « mettre ce codex en favori », sur la fiche d'une armée.
 * Sans session, elle renvoie vers la connexion et revient ici ensuite.
 */
const props = defineProps<{
  armee: { id: string; name: string; faction: string; cover_image?: string | null }
}>()

const { connecte, init, estFavori, basculer } = useFavoris()
const route = useRoute()
const lienConnexion = computed(() => `/connexion?suivant=${encodeURIComponent(route.fullPath)}`)
const occupe = ref(false)
const erreur = ref('')

// l'état de l'étoile n'est pas bloquant pour la page : chargement sans attente
onMounted(() => { init() })

const actif = computed(() => estFavori(props.armee.id))

async function cliquer() {
  occupe.value = true
  erreur.value = ''
  try { await basculer(props.armee) }
  catch (e) { erreur.value = (e as { data?: { message?: string } }).data?.message ?? 'Enregistrement impossible' }
  finally { occupe.value = false }
}
</script>

<template>
  <div>
    <NuxtLink
      v-if="!connecte"
      :to="lienConnexion"
      class="inline-flex items-center gap-2 rounded-lg border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:border-gold/70 hover:bg-gold/20"
    >
      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.13 4.32 4.77.69c.46.07.64.63.31.95l-3.45 3.36.81 4.75c.08.46-.4.81-.81.59L12 15.9l-4.27 2.25c-.41.22-.89-.13-.81-.59l.81-4.75-3.45-3.36a.56.56 0 01.31-.95l4.77-.69L11.48 3.5z" />
      </svg>
      Connecte-toi pour mettre en favori
    </NuxtLink>

    <button
      v-else
      type="button"
      :disabled="occupe"
      :aria-pressed="actif"
      class="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50"
      :class="actif
        ? 'border-gold bg-gold text-surface hover:bg-gold-light'
        : 'border-gold/40 bg-gold/10 text-gold hover:border-gold/70 hover:bg-gold/20'"
      @click="cliquer"
    >
      <svg class="h-5 w-5" :fill="actif ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.5a.56.56 0 011.04 0l2.13 4.32 4.77.69c.46.07.64.63.31.95l-3.45 3.36.81 4.75c.08.46-.4.81-.81.59L12 15.9l-4.27 2.25c-.41.22-.89-.13-.81-.59l.81-4.75-3.45-3.36a.56.56 0 01.31-.95l4.77-.69L11.48 3.5z" />
      </svg>
      {{ actif ? 'En favori' : 'Mettre en favori' }}
    </button>

    <p v-if="erreur" class="mt-1 text-xs text-red-400">{{ erreur }}</p>
  </div>
</template>
