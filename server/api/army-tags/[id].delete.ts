export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const id = getRouterParam(event, 'id')

  const { error } = await supabase
    .from('army_tags')
    .delete()
    .eq('id', id)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return { success: true }
})
