import { CodexSchema } from "~~/shared/codex/schema"
/**
 * Codex complet au format natif.
 * `?brouillon=1` : le brouillon d'admin (non validé strictement).
 * `?version=` : une REV de l'historique, relue avec les alliés du jour.
 */
export default defineCachedEventHandler(async (event) => {
  const slug = (getRouterParam(event, 'slug') ?? '').replace(/\.json$/, '')
  const q = getQuery(event)
  try {
    if (q.brouillon) {
      const b = await lireBrouillon(slug)
      // le brouillon est parsé avec valeurs par défaut mais sans exiger la cohérence des références
      const res = CodexSchema.safeParse(b.data)
      if (!res.success) throw createError({ statusCode: 422, statusMessage: 'Brouillon invalide', message: res.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`).join('\n') })
      return await avecAllies(res.data)
    }
    return await lireCodex(slug, typeof q.version === 'string' && q.version ? q.version : undefined)
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 404, statusMessage: `Codex introuvable : ${slug}`, message: (e as Error).message })
  }
}, {
  // Le builder, la page d'impression et le Chromium qui compose les PDF tapent tous ici :
  // recomposer le codex (requête + parse + fusion des alliés) à chaque fois ne sert à rien.
  maxAge: 60,
  swr: true,
  name: 'codex-fiche',
  // le brouillon change à chaque enregistrement de l'admin : jamais de cache dessus
  shouldBypassCache: (event) => !!getQuery(event).brouillon,
  getKey: (event) => {
    const q = getQuery(event)
    const slug = (getRouterParam(event, 'slug') ?? '').replace(/\.json$/, '')
    return `${slug}:${typeof q.version === 'string' && q.version ? q.version : 'courant'}`
  },
})
