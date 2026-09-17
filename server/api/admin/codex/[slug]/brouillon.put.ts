import { CodexSchema, verifierReferences } from '~~/shared/codex/schema'

/** Enregistre le brouillon. Renvoie les problèmes de validation sans bloquer l'enregistrement. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const brut = await readBody(event)
  if (!brut?.codex) throw createError({ statusCode: 400, message: 'Corps invalide' })
  brut.codex.slug = slug
  await ecrireBrouillon(slug, brut)
  const res = CodexSchema.safeParse(brut)
  const problemes = res.success ? verifierReferences(res.data) : res.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`)
  return { ok: true, problemes, modifie: new Date().toISOString() }
})
