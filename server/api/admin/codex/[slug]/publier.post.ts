import { indexerCodex, calculerListe, varianteParDefaut } from '~~/shared/codex/engine'
import { normaliserFormation } from '~~/shared/codex/liste'

/** Publie le brouillon : validation stricte + listes de test, puis snapshot versionné. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<{ version: string; changelog?: string }>(event)
  if (!body?.version?.trim()) throw createError({ statusCode: 400, message: 'Numéro de version requis' })
  // Le texte accompagne la version pour toujours : c'est lui que les joueurs
  // lisent dans l'historique, et une version sans explication ne se rattrape
  // qu'a la main en base. La regle est ici et pas seulement dans la modale :
  // l'API est ce qui publie.
  if (!body?.changelog?.trim()) {
    throw createError({ statusCode: 400, message: 'Explications de la mise à jour requises' })
  }
  try {
    // 1. validation stricte sur une copie
    const b = await lireBrouillon(slug)
    const { chargerCodex } = await import('~~/shared/codex/schema')
    const codex = chargerCodex({ ...b.data, codex: { ...b.data.codex, version: body.version } })
    // 2. listes de test
    const idx = indexerCodex(codex)
    const echecs: string[] = []
    for (const t of codex.listes_test) {
      const liste = { id: 't', nom: t.nom, codex: slug, limite: t.limite, formations: t.formations.map((f) => normaliserFormation(f as never, (id) => varianteParDefaut(idx, id))) }
      const r = calculerListe(idx, liste)
      if (t.attendu === 'valide' && !r.valide) echecs.push(`« ${t.nom} » devrait être valide : ${r.erreurs.map((e) => e.message).join(' ; ')}`)
      if (t.attendu === 'refusee' && r.valide) echecs.push(`« ${t.nom} » devrait être refusée`)
      if (t.attendu === 'refusee' && t.erreur && !r.erreurs.some((e) => e.type === t.erreur)) echecs.push(`« ${t.nom} » : erreur ${t.erreur} attendue`)
    }
    if (echecs.length) throw createError({ statusCode: 422, message: `Listes de test en échec :\n${echecs.join('\n')}` })
    // 3. publication
    const version = body.version.trim()
    await publierBrouillon(slug, version, body.changelog.trim())
    // 4. le public lit des réponses gardées une minute : les oublier, sinon la fiche
    //    et l'aperçu PDF montrent encore l'ancienne version après un Publier réussi
    await oublierCacheCodex(slug)
    // 5. PDF figé pour l'historique : si ça échoue, la publication reste valide et le PDF sera composé à la volée
    let pdf: string | null = null
    try {
      pdf = await figerPdfVersion(getRequestURL(event).origin, slug, version)
    } catch (e) {
      console.warn(`[codex] PDF de ${slug} v${version} non figé : ${(e as Error).message}`)
    }
    return { ok: true, version, pdf }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 422, message: (e as Error).message })
  }
})
