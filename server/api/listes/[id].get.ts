/** Une liste de l'utilisateur connecté. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const liste = await lireListe(getRouterParam(event, 'id') ?? '', user.id)
  if (!liste) throw createError({ statusCode: 404, message: 'Liste introuvable' })
  return liste
})
