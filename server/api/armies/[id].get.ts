export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const id = getRouterParam(event, 'id')

  const { data, error } = await supabase
    .from('armies')
    .select('*, army_versions(*)')
    .eq('id', id)
    .order('published_at', { referencedTable: 'army_versions', ascending: false })
    .single()

  if (error) {
    throw createError({ statusCode: 404, message: 'Armée non trouvée' })
  }

  return data
})
