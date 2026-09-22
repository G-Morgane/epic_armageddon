/** Retire une armée des favoris. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const id = getRouterParam(event, 'id')!
  await retirerFavori(user.id, id)
  return { ok: true }
})
