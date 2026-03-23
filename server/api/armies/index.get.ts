export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const query = getQuery(event)
  const faction = query.faction as string | undefined
  const status = query.status as string | undefined

  let request = supabase
    .from('armies')
    .select('*, army_versions!inner(*)')
    .eq('army_versions.is_current', true)
    .order('name')

  if (faction) {
    request = request.eq('faction', faction)
  }

  if (status) {
    request = request.eq('status', status)
  } else {
    request = request.eq('status', 'official')
  }

  const { data, error } = await request

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
