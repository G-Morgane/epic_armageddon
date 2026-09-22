import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'

/**
 * Vérifie la session Supabase (cookie) et le rôle applicatif ; renvoie l'identifiant.
 * `roles` restreint l'accès, par exemple aux seuls super_admin.
 */
export async function exigerAdmin(event: H3Event, roles: string[] = ['admin', 'super_admin']) {
  if (import.meta.dev && process.env.CODEX_DEMO_SANS_AUTH === '1') return null
  const claims = await serverSupabaseUser(event).catch(() => null)
  if (!claims?.sub) throw createError({ statusCode: 401, message: 'Non authentifié' })
  // `claims.role` est le rôle Postgres (`authenticated`), pas le nôtre : le rôle
  // applicatif se lit dans profiles.
  const supabase = useSupabaseServer()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', claims.sub).single()
  const role = (profile as { role?: string } | null)?.role
  if (!role || !roles.includes(role)) throw createError({ statusCode: 403, message: 'Accès refusé' })
  return { id: claims.sub as string }
}
