/** Retire le partage d'une liste : le lien cesse de fonctionner. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  await retirerPartage(getRouterParam(event, 'id') ?? '', user.id)
  return { ok: true }
})
