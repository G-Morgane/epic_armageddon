/**
 * `false` au rendu serveur, `true` une fois la page hydratée.
 *
 * Sert aux affichages qui dépendent de la session. Le jeton Supabase est dans
 * un cookie, donc `useSupabaseUser()` est déjà rempli côté serveur : un rendu
 * serveur qui s'en sert produit un HTML différent selon le visiteur. Or les
 * pages publiques sont mises en cache par Vercel (voir `routeRules` dans
 * nuxt.config) : ce HTML serait ensuite resservi à tout le monde. On rend donc
 * toujours l'état « visiteur anonyme », que le navigateur corrige après
 * l'hydratation.
 */
export const useMonte = () => {
  const monte = ref(false)
  onMounted(() => { monte.value = true })
  return monte
}
