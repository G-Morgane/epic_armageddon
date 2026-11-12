import type { SupabaseClient } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import { serverSupabaseUser } from '#supabase/server'
import type { Liste } from '~~/shared/codex/liste'

/**
 * Listes d'armée du builder, stockées dans `listes_armee` (voir supabase/listes.sql).
 * Tout passe par la clé service : la table n'a aucune policy publique.
 */

/** Client non typé : la table n'est pas dans les types générés du projet. */
const sb = () => useSupabaseServer() as unknown as SupabaseClient

/** Une liste sans son contenu : ce que le tiroir « Mes listes » affiche. */
export type ResumeListe = Omit<ListeEnregistree, 'data'>

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

/** Utilisateur de la session Supabase (cookie) ; erreur 401 s'il n'y en a pas. */
export async function exigerUtilisateur(event: H3Event): Promise<{ id: string }> {
  const claims = await serverSupabaseUser(event).catch(() => null)
  if (!claims?.sub) throw createError({ statusCode: 401, message: 'Connexion requise pour enregistrer une liste' })
  return { id: claims.sub }
}

const CHAMPS = 'id, codex, nom, limite, data, code_partage, total, valide, updated_at'
/** Le tiroir n'affiche que l'en-tête des listes : inutile de descendre l'armée complète de chacune. */
const CHAMPS_RESUME = 'id, codex, nom, limite, code_partage, total, valide, updated_at'

export async function listerListes(userId: string): Promise<ResumeListe[]> {
  const { data, error } = await sb().from('listes_armee').select(CHAMPS_RESUME).eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) erreurSql(error, 'lecture des listes')
  return (data ?? []) as unknown as ResumeListe[]
}

export async function lireListe(id: string, userId: string): Promise<ListeEnregistree | null> {
  const { data, error } = await sb().from('listes_armee').select(CHAMPS).eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) erreurSql(error, 'lecture de la liste')
  return (data as unknown as ListeEnregistree) ?? null
}

/**
 * Liste partagée : lecture publique par son code, sans session.
 * Le pseudo de l'auteur accompagne la liste ; son email, jamais.
 * `profiles` n'est pas joignable par PostgREST ici (la clé étrangère vise
 * auth.users), d'où la seconde requête.
 */
export async function lireListePartagee(code: string): Promise<(ListeEnregistree & { pseudo: string | null }) | null> {
  const { data, error } = await sb().from('listes_armee').select(`${CHAMPS}, user_id`).eq('code_partage', code).maybeSingle()
  if (error) erreurSql(error, 'lecture de la liste partagée')
  if (!data) return null
  const { user_id: userId, ...liste } = data as unknown as ListeEnregistree & { user_id: string | null }
  let pseudo: string | null = null
  if (userId) {
    const { data: profil } = await sb().from('profiles').select('display_name').eq('id', userId).maybeSingle()
    pseudo = (profil as { display_name?: string } | null)?.display_name ?? null
  }
  return { ...(liste as ListeEnregistree), pseudo }
}

/** Liste publique telle que l'accueil la montre : en-tête, code de partage et pseudo, ni id ni propriétaire. */
export interface ListePublique {
  code_partage: string
  codex: string
  nom: string
  limite: number
  total: number | null
  updated_at: string
  pseudo: string | null
}

/** Une liste partagée est publique : les plus récentes, avec le pseudo de leur auteur. */
export async function listerListesPubliques(nombre: number): Promise<ListePublique[]> {
  return (await chercherListesPubliques({ nombre })).listes
}

export interface RechercheListes {
  nombre: number
  decalage?: number
  /** slugs de codex acceptés ; vide = tous */
  codex?: string[]
  /** cherche dans le nom de la liste et dans le pseudo de l'auteur */
  texte?: string
}

/**
 * Annuaire des listes publiques : filtres, page et total.
 * Le pseudo vit dans `profiles`, sans jointure possible (voir lireListePartagee) :
 * la recherche par pseudo passe donc d'abord par les ids des profils trouvés.
 */
export async function chercherListesPubliques(r: RechercheListes): Promise<{ listes: ListePublique[]; total: number }> {
  let requete = sb().from('listes_armee')
    .select('code_partage, codex, nom, limite, total, updated_at, user_id', { count: 'exact' })
    .not('code_partage', 'is', null)
  if (r.codex?.length) requete = requete.in('codex', r.codex)
  // les caractères qui structurent le filtre `or` de PostgREST sont retirés de la saisie
  const texte = (r.texte ?? '').replace(/[,()%*\\]/g, ' ').trim()
  if (texte) {
    const { data: profils } = await sb().from('profiles').select('id').ilike('display_name', `%${texte}%`).limit(200)
    const ids = ((profils ?? []) as { id: string }[]).map((p) => p.id)
    requete = requete.or(ids.length ? `nom.ilike.%${texte}%,user_id.in.(${ids.join(',')})` : `nom.ilike.%${texte}%`)
  }
  const debut = r.decalage ?? 0
  const { data, error, count } = await requete
    .order('updated_at', { ascending: false })
    .range(debut, debut + r.nombre - 1)
  if (error) erreurSql(error, 'lecture des listes publiques')
  const lignes = (data ?? []) as unknown as (Omit<ListePublique, 'pseudo'> & { user_id: string | null })[]
  const ids = [...new Set(lignes.map((l) => l.user_id).filter((id): id is string => !!id))]
  const pseudos = new Map<string, string | null>()
  if (ids.length) {
    const { data: profils } = await sb().from('profiles').select('id, display_name').in('id', ids)
    for (const p of (profils ?? []) as { id: string; display_name: string | null }[]) pseudos.set(p.id, p.display_name)
  }
  const listes = lignes.map(({ user_id: userId, ...l }) => ({ ...l, pseudo: userId ? pseudos.get(userId) ?? null : null }))
  return { listes, total: count ?? listes.length }
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
  // seul le code existant nous intéresse ici, pas le contenu de la liste
  const { data: actuelle, error } = await sb().from('listes_armee').select('code_partage').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) erreurSql(error, 'lecture de la liste')
  if (!actuelle) throw createError({ statusCode: 404, message: 'Liste introuvable' })
  if (actuelle.code_partage) return actuelle.code_partage as string
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
