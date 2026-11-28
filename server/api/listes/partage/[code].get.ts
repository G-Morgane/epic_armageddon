/** Lecture publique d'une liste partagée, sans jeton. */
export default defineEventHandler(async (event) => {
  const code = getRouterParam(event, 'code') ?? ''
  if (!/^[a-z0-9]{6,32}$/.test(code)) throw createError({ statusCode: 400, message: 'code invalide' })
  const liste = await lireListePartagee(code)
  if (!liste) throw createError({ statusCode: 404, message: 'Cette liste partagée n\'existe pas ou n\'est plus partagée' })
  return liste
})
