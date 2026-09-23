export default defineCachedEventHandler(async () => {
  const supabase = useSupabaseServer()

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
}, cacheDonnees('documents', () => 'v1'))
