import { problemesCodex } from '~~/shared/codex/problemes'

/** Enregistre le brouillon. Renvoie les problèmes de validation sans bloquer l'enregistrement. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const brut = await readBody(event)
  if (!brut?.codex) throw createError({ statusCode: 400, message: 'Corps invalide' })
  brut.codex.slug = slug
  await ecrireBrouillon(slug, brut)
  return { ok: true, problemes: problemesCodex(brut), modifie: new Date().toISOString() }
})
