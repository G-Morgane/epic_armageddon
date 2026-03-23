export default defineEventHandler(async () => {
  const supabase = useSupabaseServer()

  const { data, error } = await supabase
    .from('army_versions')
    .select('*, armies(*)')
    .eq('is_current', true)
    .order('published_at', { ascending: false })
    .limit(3)

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
})
