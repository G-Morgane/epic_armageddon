import type { Liste } from '~~/shared/codex/liste'

/** Enregistre une nouvelle liste pour l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const body = await readBody<{ codex?: string; nom?: string; limite?: number; data?: Liste; total?: number; valide?: boolean }>(event)
  if (!body?.codex || !body.data) throw createError({ statusCode: 400, message: 'codex et data sont requis' })
  return creerListe(user.id, {
    codex: body.codex,
    nom: body.nom?.trim() || 'Liste sans nom',
    limite: body.limite ?? 3000,
    data: body.data,
    total: body.total,
    valide: body.valide,
  })
})
