export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const id = getRouterParam(event, 'id')
  const body = await readBody(event)

  const { name, position } = body

  const update: Record<string, unknown> = {}
  if (name !== undefined) update.name = name
  if (position !== undefined) update.position = position

  const { data, error } = await supabase
    .from('army_tags')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
