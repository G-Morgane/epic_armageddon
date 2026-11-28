/** Listes d'armée de l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  return listerListes(user.id)
})
