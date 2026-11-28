/** Supprime une liste de l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  await supprimerListe(getRouterParam(event, 'id') ?? '', user.id)
  return { ok: true }
})
