/** Codex favoris de l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  return listerFavoris(user.id)
})
