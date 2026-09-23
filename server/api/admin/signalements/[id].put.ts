import type { Statut } from '~~/server/utils/signalements'

/** Statut et note de suivi d'un signalement. */
export default defineEventHandler(async (event) => {
  const admin = await exigerAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ statut?: string; note_admin?: string }>(event)
  const statut = STATUTS.includes(body?.statut as Statut) ? (body.statut as Statut) : undefined
  if (body?.statut && !statut) throw createError({ statusCode: 400, message: 'Statut inconnu' })
  await majSignalement(id, admin?.id ?? null, { statut, note_admin: body?.note_admin })
  return { ok: true }
})
