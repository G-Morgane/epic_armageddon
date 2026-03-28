export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const query = getQuery(event)
  const faction = query.faction as string | undefined

  let request = supabase
    .from('army_tags')
    .select('*')
    .order('position')
    .order('name')

  if (faction) {
    request = request.eq('faction', faction)
  }

  const { data, error } = await request

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
