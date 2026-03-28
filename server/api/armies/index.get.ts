export default defineEventHandler(async (event) => {
  const supabase = useSupabaseServer()
  const query = getQuery(event)
  const faction = query.faction as string | undefined
  const status = query.status as string | undefined
  const tag = query.tag as string | undefined

  let request = supabase
    .from('armies')
    .select('*, army_versions!inner(*), army_tag_assignments(tag_id, army_tags(*))')
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

  // Map tags into a flat array on each army
  const result = (data ?? []).map((army: any) => ({
    ...army,
    tags: army.army_tag_assignments?.map((a: any) => a.army_tags).filter(Boolean) ?? [],
    army_tag_assignments: undefined,
  }))

  // Filter by tag if requested
  if (tag) {
    return result.filter((army: any) => army.tags.some((t: any) => t.id === tag))
  }

  return result
})
