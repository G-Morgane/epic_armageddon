export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.dev && useRuntimeConfig().public.codexDemoSansAuth) return

  const { isAuthenticated, isAdmin, init, user } = useAuth()
  // la session est déjà connue (cookie) ; il ne manque que le rôle
  await init()

  if (!isAuthenticated.value || !isAdmin.value) {
    return navigateTo('/admin/login')
  }

  // Premier passage d'un compte invité : mot de passe à choisir
  if (user.value?.user_metadata?.must_change_password) {
    return navigateTo('/admin/setup-password')
  }
})
