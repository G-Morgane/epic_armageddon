/** Archives (documents d'origine, suppléments GW), de la plus ancienne à la plus récente. */
export default defineCachedEventHandler(async () => {
  const supabase = useSupabaseServer()

  const { data, error } = await supabase
    .from('archives')
    .select('*')
    .order('annee', { ascending: true })
    .order('title', { ascending: true })

  if (error) {
    // table pas encore créée (supabase/archives.sql) : page vide plutôt qu'une erreur
    if (error.code === '42P01' || /does not exist|schema cache/i.test(error.message)) return []
    throw createError({ statusCode: 500, message: error.message })
  }

  return data
}, cacheDonnees('archives', () => 'v1'))
