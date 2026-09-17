import { indexerCodex, calculerListe, varianteParDefaut } from '~~/shared/codex/engine'
import { normaliserFormation } from '~~/shared/codex/liste'

/** Publie le brouillon : validation stricte + listes de test, puis snapshot versionné. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<{ version: string; changelog?: string }>(event)
  if (!body?.version?.trim()) throw createError({ statusCode: 400, message: 'Numéro de version requis' })
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
    await publierBrouillon(slug, body.version.trim(), body.changelog ?? '')
    return { ok: true, version: body.version }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 422, message: (e as Error).message })
  }
})
