import { CodexSchema } from "~~/shared/codex/schema"
/** Codex complet au format natif. `?brouillon=1` : le brouillon d'admin (non validé strictement). */
export default defineEventHandler(async (event) => {
  const slug = (getRouterParam(event, 'slug') ?? '').replace(/\.json$/, '')
  const q = getQuery(event)
  try {
    if (q.brouillon) {
      const b = await lireBrouillon(slug)
      // le brouillon est parsé avec valeurs par défaut mais sans exiger la cohérence des références
      const res = CodexSchema.safeParse(b.data)
      if (!res.success) throw createError({ statusCode: 422, statusMessage: 'Brouillon invalide', message: res.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('\n') })
      return res.data
    }
    return await lireCodex(slug)
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 404, statusMessage: `Codex introuvable : ${slug}`, message: (e as Error).message })
  }
})
