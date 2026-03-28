export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const armyId = getRouterParam(event, 'id')

  const { data, error } = await supabase
    .from('army_tag_assignments')
    .select('tag_id, army_tags(*)')
    .eq('army_id', armyId)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data?.map(d => (d as any).army_tags) ?? []
})
