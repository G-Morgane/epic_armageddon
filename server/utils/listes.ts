import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { Liste } from '~~/shared/codex/liste'

/**
 * Listes d'armée du builder, stockées dans `listes_armee` (voir supabase/listes.sql).
 * Tout passe par la clé service : la table n'a aucune policy publique.
 */

/** Client non typé : la table n'est pas dans les types générés du projet. */
const sb = () => useSupabaseServer() as unknown as SupabaseClient

export interface ListeEnregistree {
  id: string
  codex: string
  nom: string
  limite: number
  data: Liste
  code_partage: string | null
  total: number | null
  valide: boolean | null
  updated_at: string
}

function erreurSql(e: { message?: string; code?: string } | null, action: string): never {
  const manque = e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message ?? '')
  throw createError({
    statusCode: manque ? 503 : 500,
    message: manque
      ? `Table des listes absente : exécuter supabase/listes.sql dans le SQL editor Supabase (${action})`
      : `${action} : ${e?.message ?? 'erreur Supabase'}`,
  })
}

/** Utilisateur du jeton Supabase ; erreur 401 s'il n'y en a pas. */
export async function exigerUtilisateur(event: H3Event): Promise<{ id: string }> {
  const entete = getHeader(event, 'authorization')
  if (!entete) throw createError({ statusCode: 401, message: 'Connexion requise pour enregistrer une liste' })
  const { data, error } = await useSupabaseServer().auth.getUser(entete.replace('Bearer ', ''))
  if (error || !data.user) throw createError({ statusCode: 401, message: 'Session expirée, reconnecte-toi' })
  return { id: data.user.id }
}

const CHAMPS = 'id, codex, nom, limite, data, code_partage, total, valide, updated_at'

export async function listerListes(userId: string): Promise<ListeEnregistree[]> {
  const { data, error } = await sb().from('listes_armee').select(CHAMPS).eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) erreurSql(error, 'lecture des listes')
  return (data ?? []) as unknown as ListeEnregistree[]
}

export async function lireListe(id: string, userId: string): Promise<ListeEnregistree | null> {
  const { data, error } = await sb().from('listes_armee').select(CHAMPS).eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) erreurSql(error, 'lecture de la liste')
  return (data as unknown as ListeEnregistree) ?? null
}

/** Liste partagée : lecture publique par son code, sans jeton. */
export async function lireListePartagee(code: string): Promise<ListeEnregistree | null> {
  const { data, error } = await sb().from('listes_armee').select(CHAMPS).eq('code_partage', code).maybeSingle()
  if (error) erreurSql(error, 'lecture de la liste partagée')
  return (data as unknown as ListeEnregistree) ?? null
}

interface Entree {
  codex: string
  nom: string
  limite: number
  data: Liste
  total?: number
  valide?: boolean
}

export async function creerListe(userId: string, e: Entree): Promise<{ id: string }> {
  const { data, error } = await sb().from('listes_armee')
    .insert({ user_id: userId, codex: e.codex, nom: e.nom, limite: e.limite, data: e.data, total: e.total ?? null, valide: e.valide ?? null })
    .select('id').single()
  if (error) erreurSql(error, 'enregistrement de la liste')
  return data as { id: string }
}

export async function majListe(id: string, userId: string, e: Entree): Promise<void> {
  const { error, count } = await sb().from('listes_armee')
    .update({ nom: e.nom, limite: e.limite, data: e.data, total: e.total ?? null, valide: e.valide ?? null }, { count: 'exact' })
    .eq('id', id).eq('user_id', userId)
  if (error) erreurSql(error, 'mise à jour de la liste')
  if (count === 0) throw createError({ statusCode: 404, message: 'Liste introuvable' })
}

export async function supprimerListe(id: string, userId: string): Promise<void> {
  const { error } = await sb().from('listes_armee').delete().eq('id', id).eq('user_id', userId)
  if (error) erreurSql(error, 'suppression de la liste')
}

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'
const nouveauCode = () => Array.from({ length: 10 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

/** Crée le code de partage s'il n'existe pas encore, et le renvoie. */
export async function partagerListe(id: string, userId: string): Promise<string> {
  const actuelle = await lireListe(id, userId)
  if (!actuelle) throw createError({ statusCode: 404, message: 'Liste introuvable' })
  if (actuelle.code_partage) return actuelle.code_partage
  for (let essai = 0; essai < 5; essai++) {
    const code = nouveauCode()
    const { error } = await sb().from('listes_armee').update({ code_partage: code }).eq('id', id).eq('user_id', userId)
    if (!error) return code
    if (error.code !== '23505') erreurSql(error, 'partage de la liste')
  }
  throw createError({ statusCode: 500, message: 'Impossible de générer un code de partage' })
}

export async function retirerPartage(id: string, userId: string): Promise<void> {
  const { error } = await sb().from('listes_armee').update({ code_partage: null }).eq('id', id).eq('user_id', userId)
  if (error) erreurSql(error, 'retrait du partage')
}
