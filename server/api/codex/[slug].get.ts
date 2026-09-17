/** Codex complet au format natif. */
export default defineEventHandler(async (event) => {
  const slug = (getRouterParam(event, 'slug') ?? '').replace(/\.json$/, '')
  try {
    return await lireCodex(slug)
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: `Codex introuvable : ${slug}`, message: (e as Error).message })
  }
})
