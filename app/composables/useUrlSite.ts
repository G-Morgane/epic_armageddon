/**
 * Construit les URL absolues du site sur l'environnement courant.
 *
 * Open Graph exige une URL absolue : écrite en dur, elle faisait annoncer les
 * adresses de prod par le staging. La base est lue une fois au montage, pour
 * que les `ogUrl` calculés restent appelables hors contexte Nuxt.
 */
export function useUrlSite() {
  const { siteUrl } = useRuntimeConfig().public

  return (chemin = '/') => `${siteUrl}${chemin === '/' ? '' : chemin}`
}
