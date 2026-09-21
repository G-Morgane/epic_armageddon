/** Crée (ou renvoie) le code de partage d'une liste. */
export default defineEventHandler(async (event) => {
  const user = await exigerUtilisateur(event)
  const code = await partagerListe(getRouterParam(event, 'id') ?? '', user.id)
  return { code }
})
