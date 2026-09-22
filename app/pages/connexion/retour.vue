<script setup lang="ts">
/**
 * Page d'atterrissage du lien reçu par email.
 *
 * Deux formes de lien selon le gabarit d'email configuré dans Supabase :
 * - `?token_hash=...&type=magiclink` : vérifié ici, fonctionne depuis n'importe
 *   quel navigateur (lien ouvert sur le téléphone, session demandée sur l'ordi).
 * - `?code=...` : échangé automatiquement par le client Supabase, mais seulement
 *   dans le navigateur qui a demandé le lien (PKCE).
 */
import type { EmailOtpType } from '@supabase/supabase-js'

definePageMeta({ layout: false })

const supabase = useSupabase()
const route = useRoute()
const { fetchProfile } = useAuth()
const suivantCookie = useCookie<string | null>('ea_suivant')

const erreur = ref('')

onMounted(async () => {
  const tokenHash = route.query.token_hash
  if (typeof tokenHash === 'string' && tokenHash) {
    const type = (route.query.type as EmailOtpType) || 'magiclink'
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (error) return echouer()
  } else {
    // laisse au client Supabase le temps d'échanger le `code` de l'URL
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      await new Promise((r) => setTimeout(r, 1200))
      const { data: retente } = await supabase.auth.getSession()
      if (!retente.session) return echouer()
    }
  }

  await fetchProfile()
  const destination = suivantCookie.value && /^\/(?!\/)/.test(suivantCookie.value) ? suivantCookie.value : '/'
  suivantCookie.value = null
  await navigateTo(destination)
})

function echouer() {
  erreur.value = "Ce lien n'est plus valable. Il a peut-être expiré, ou il a déjà servi."
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm text-center">
      <template v-if="erreur">
        <h1 class="font-heading text-2xl font-bold text-gold">Lien expiré</h1>
        <p class="mt-3 text-sm text-gray-400">{{ erreur }}</p>
        <NuxtLink
          to="/connexion"
          class="mt-6 inline-block rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-surface hover:bg-gold-light"
        >
          Demander un nouveau lien
        </NuxtLink>
      </template>
      <template v-else>
        <p class="text-sm text-gray-400">Connexion en cours...</p>
      </template>
    </div>
  </div>
</template>
