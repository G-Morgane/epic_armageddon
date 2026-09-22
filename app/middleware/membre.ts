/** Page réservée aux membres connectés ; renvoie vers la connexion et revient ici ensuite. */
export default defineNuxtRouteMiddleware((to) => {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated.value) {
    return navigateTo(`/connexion?suivant=${encodeURIComponent(to.fullPath)}`)
  }
})
