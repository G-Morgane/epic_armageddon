/** Suppression définitive : réservée au super admin (le spam se marque « refuse » sinon). */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event, ['super_admin'])
  await supprimerSignalement(getRouterParam(event, 'id')!)
  return { ok: true }
})
