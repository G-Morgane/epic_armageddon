/** Met une armée en favori. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const { army_id: armyId } = await readBody<{ army_id?: string }>(event)
  if (!armyId) throw createError({ statusCode: 400, message: 'army_id manquant' })
  await ajouterFavori(user.id, armyId)
  return { ok: true }
})
