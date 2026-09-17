import type { H3Event } from 'h3'

/** Vérifie le jeton Supabase et le rôle admin ; renvoie l'utilisateur. */
export async function exigerAdmin(event: H3Event) {
  if (import.meta.dev && process.env.CODEX_DEMO_SANS_AUTH === '1') return null
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const supabase = useSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (error || !user) throw createError({ statusCode: 401, message: 'Non authentifié' })
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as { role?: string } | null)?.role
  if (!role || !['admin', 'super_admin'].includes(role)) throw createError({ statusCode: 403, message: 'Accès refusé' })
  return user
}
