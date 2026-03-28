export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const armyId = getRouterParam(event, 'id')
  const body = await readBody(event)
  const tagIds: string[] = body.tagIds ?? []

  // Remove all existing assignments
  await supabase
    .from('army_tag_assignments')
    .delete()
    .eq('army_id', armyId)

  // Insert new assignments
  if (tagIds.length > 0) {
    const { error } = await supabase
      .from('army_tag_assignments')
      .insert(tagIds.map(tag_id => ({ army_id: armyId!, tag_id })))

    if (error) {
      throw createError({ statusCode: 500, message: error.message })
    }
  }

  return { success: true }
})
