/**
 * Historique public d'un codex : une entrée par numéro de version, la plus récente d'abord.
 * Republier une même REV (reprise du YAML, correction de forme) ne crée pas une seconde entrée.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  try {
    const versions = await listerVersions(slug)
    const parVersion = new Map<string, typeof versions[number]>()
    for (const v of versions) parVersion.set(v.version, v) // ordre croissant : la dernière publication gagne
    return [...parVersion.values()].reverse()
  } catch (e) {
    throw createError({ statusCode: 404, statusMessage: `Codex introuvable : ${slug}`, message: (e as Error).message })
  }
})
