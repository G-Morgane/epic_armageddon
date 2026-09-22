/**
 * PDF d'un codex, composé à la demande.
 * `?version=` : une REV de l'historique ; sinon la version publiée.
 * Une version figée à la publication est servie depuis R2 par une redirection.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[a-z0-9-]+$/.test(slug)) throw createError({ statusCode: 400, statusMessage: 'slug invalide' })
  const requete = getQuery(event) as Record<string, unknown>
  const version = typeof requete.version === 'string' ? requete.version : ''

  // Version figée : le fichier existe déjà, inutile de relancer Chromium.
  if (version && !requete.brouillon) {
    const fige = (await listerVersions(slug)).find((v) => v.version === version)?.pdf_url
    if (fige) return sendRedirect(event, fige, 302)
  }

  const pdf = await genererPdfCodex(getRequestURL(event).origin, slug, requete)
  setHeader(event, 'Content-Type', 'application/pdf')
  setHeader(event, 'Content-Disposition', `inline; filename="codex-${slug}${version ? `-v${version}` : ''}.pdf"`)
  // Une version passée ne bouge plus ; la version courante peut être republiée.
  if (requete.brouillon) setHeader(event, 'Cache-Control', 'no-store')
  else if (version) setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  else setHeader(event, 'Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
  return pdf
})
