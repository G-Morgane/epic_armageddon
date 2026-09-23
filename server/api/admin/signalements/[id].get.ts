/** Un signalement complet, avec la copie de la liste au moment de l'envoi. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const id = getRouterParam(event, 'id')!
  const signalement = await lireSignalement(id)
  if (!signalement) throw createError({ statusCode: 404, message: 'Signalement introuvable' })
  return signalement
})
