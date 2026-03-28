export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const body = await readBody(event)

  const { name, faction, position } = body

  if (!name || !faction) {
    throw createError({ statusCode: 400, message: 'name and faction are required' })
  }

  const { data, error } = await supabase
    .from('army_tags')
    .insert({ name, faction, position: position ?? 0 })
    .select()
    .single()

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
