/** Abandonne le brouillon : retour à la version publiée. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  await supprimerBrouillon(getRouterParam(event, 'slug') ?? '')
  return { ok: true }
})
