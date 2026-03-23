export default defineEventHandler(async () => {
  const supabase = useSupabaseServer()

  const threeMonthsAgo = new Date()
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
  const cutoff = threeMonthsAgo.toISOString()

  // Try official armies updated in last 3 months first
  const { data: official } = await supabase
    .from('army_versions')
    .select('*, armies!inner(*)')
    .eq('is_current', true)
    .eq('armies.status', 'official')
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(3)

  if (official && official.length >= 3) {
    return official
  }

  // Not enough official, fill with other statuses
  const officialIds = (official ?? []).map(v => v.id)

  const { data: others } = await supabase
    .from('army_versions')
    .select('*, armies!inner(*)')
    .eq('is_current', true)
    .gte('published_at', cutoff)
    .order('published_at', { ascending: false })
    .limit(3 - (official?.length ?? 0))

  const combined = [...(official ?? []), ...(others ?? []).filter(v => !officialIds.includes(v.id))]

  // If still not enough, just get the most recent ones
  if (combined.length < 3) {
    const existingIds = combined.map(v => v.id)
    const { data: fallback } = await supabase
      .from('army_versions')
      .select('*, armies(*)')
      .eq('is_current', true)
      .order('published_at', { ascending: false })
      .limit(3)

    // Merge without duplicates
    for (const v of fallback ?? []) {
      if (!existingIds.includes(v.id) && combined.length < 3) {
        combined.push(v)
        existingIds.push(v.id)
      }
    }
  }

  return combined.slice(0, 3)
})
