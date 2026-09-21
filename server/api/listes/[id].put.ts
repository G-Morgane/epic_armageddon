import type { Liste } from '~~/shared/codex/liste'

/** Met à jour une liste de l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const body = await readBody<{ codex?: string; nom?: string; limite?: number; data?: Liste; total?: number; valide?: boolean }>(event)
  if (!body?.data) throw createError({ statusCode: 400, message: 'data est requis' })
  await majListe(getRouterParam(event, 'id') ?? '', user.id, {
    codex: body.codex ?? '',
    nom: body.nom?.trim() || 'Liste sans nom',
    limite: body.limite ?? 3000,
    data: body.data,
    total: body.total,
    valide: body.valide,
  })
  return { ok: true }
})
