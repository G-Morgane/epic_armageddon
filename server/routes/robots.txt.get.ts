// robots.txt est servi dynamiquement : le fichier statique était figé sur
// l'URL de prod et aurait ouvert le staging aux moteurs.
export default defineEventHandler((event) => {
  const { siteUrl, indexable } = useRuntimeConfig().public

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')

  if (!indexable) return 'User-Agent: *\nDisallow: /\n'

  return `User-Agent: *\nDisallow: /admin/\n\nSitemap: ${siteUrl}/sitemap.xml\n`
})
