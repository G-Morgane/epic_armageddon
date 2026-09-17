export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  try {
    const b = await lireBrouillon(slug)
    return { ...b, versions: await listerVersions(slug) }
  } catch (e) {
    throw createError({ statusCode: 404, message: (e as Error).message })
  }
})
