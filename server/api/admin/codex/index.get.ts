export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  return etatsCodex()
})
