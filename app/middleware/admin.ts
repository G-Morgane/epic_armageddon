export default defineNuxtRouteMiddleware(async () => {
  const { isAuthenticated, isAdmin, loading, init, user } = useAuth()

  if (loading.value) {
    await init()
  }

  if (!isAuthenticated.value || !isAdmin.value) {
    return navigateTo('/admin/login')
  }

  // Check if user must change password (first login)
  if (user.value?.user_metadata?.must_change_password) {
    return navigateTo('/admin/setup-password')
  }
})
