export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  try {
    const b = await lireBrouillon(slug)
    // `reference` : ce que le brouillon modifie, pour l'onglet Changements.
    return { ...b, versions: await listerVersions(slug), reference: await lireReference(slug) }
  } catch (e) {
    throw createError({ statusCode: 404, message: (e as Error).message })
  }
})
