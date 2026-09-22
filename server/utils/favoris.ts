import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Codex mis en favori par un membre, stockés dans `favoris_armee` (voir supabase/favoris.sql).
 * Tout passe par la clé service : la table n'a aucune policy publique.
 */

/** Client non typé : la table n'est pas dans les types générés du projet. */
const sb = () => useSupabaseServer() as unknown as SupabaseClient

/** Un favori tel que la page « Mon compte » l'affiche : de quoi faire la carte et le lien. */
export interface FavoriArmee {
  army_id: string
  nom: string
  faction: string
  cover_image: string | null
  created_at: string
}

function erreurSql(e: { message?: string; code?: string } | null, action: string): never {
  const manque = e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message ?? '')
  throw createError({
    statusCode: manque ? 503 : 500,
    message: manque
      ? `Table des favoris absente : exécuter supabase/favoris.sql dans le SQL editor Supabase (${action})`
      : `${action} : ${e?.message ?? 'erreur Supabase'}`,
  })
}

export async function listerFavoris(userId: string): Promise<FavoriArmee[]> {
  const { data, error } = await sb()
    .from('favoris_armee')
    .select('army_id, created_at, armies (name, faction, cover_image)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) erreurSql(error, 'lecture des favoris')
  type Ligne = { army_id: string; created_at: string; armies: { name: string; faction: string; cover_image: string | null } | null }
  // une armée supprimée entre-temps laisserait une ligne sans jointure : elle n'a rien à afficher
  return ((data ?? []) as unknown as Ligne[]).flatMap((l) => l.armies
    ? [{ army_id: l.army_id, nom: l.armies.name, faction: l.armies.faction, cover_image: l.armies.cover_image, created_at: l.created_at }]
    : [])
}

/** Ajout idempotent : re-cliquer sur l'étoile ne doit pas échouer sur la clé primaire. */
export async function ajouterFavori(userId: string, armyId: string): Promise<void> {
  const { error } = await sb().from('favoris_armee').upsert({ user_id: userId, army_id: armyId })
  if (error) {
    // 23503 : l'armée n'existe pas, ce n'est pas une panne serveur
    if (error.code === '23503') throw createError({ statusCode: 404, message: 'Armée introuvable' })
    erreurSql(error, 'ajout du favori')
  }
}

export async function retirerFavori(userId: string, armyId: string): Promise<void> {
  const { error } = await sb().from('favoris_armee').delete().eq('user_id', userId).eq('army_id', armyId)
  if (error) erreurSql(error, 'retrait du favori')
}
