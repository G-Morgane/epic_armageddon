import type { SupabaseClient } from '@supabase/supabase-js'
import type { Liste } from '~~/shared/codex/liste'

/**
 * Signalements de bugs, stockés dans `signalements` (voir supabase/signalements.sql).
 * Tout passe par la clé service : la table n'a aucune policy publique.
 */

/** Client non typé : la table n'est pas dans les types générés du projet. */
const sb = () => useSupabaseServer() as unknown as SupabaseClient

export const CATEGORIES = ['points', 'formation', 'option', 'regles', 'affichage', 'sauvegarde', 'pdf', 'autre'] as const
export const STATUTS = ['nouveau', 'en_cours', 'resolu', 'refuse'] as const
export type Categorie = (typeof CATEGORIES)[number]
export type Statut = (typeof STATUTS)[number]

export interface Signalement {
  id: string
  user_id: string | null
  pseudo: string | null
  email: string | null
  categorie: Categorie
  message: string
  page: string
  emplacement: string | null
  url: string | null
  codex: string | null
  codex_nom: string | null
  codex_version: string | null
  faction: string | null
  liste_id: string | null
  liste_nom: string | null
  liste_total: number | null
  liste_limite: number | null
  liste_valide: boolean | null
  liste_data: Liste | null
  liste_erreurs: string[] | null
  user_agent: string | null
  ecran: string | null
  statut: Statut
  note_admin: string | null
  traite_par: string | null
  traite_le: string | null
  created_at: string
  updated_at: string
}

/** Un signalement sans sa liste : ce que le tableau de l'admin affiche. */
export type ResumeSignalement = Omit<Signalement, 'liste_data' | 'liste_erreurs'>

function erreurSql(e: { message?: string; code?: string } | null, action: string): never {
  const manque = e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message ?? '')
  throw createError({
    statusCode: manque ? 503 : 500,
    message: manque
      ? `Table des signalements absente : exécuter supabase/signalements.sql dans le SQL editor Supabase (${action})`
      : `${action} : ${e?.message ?? 'erreur Supabase'}`,
  })
}

const CHAMPS = '*'
/**
 * Le tableau n'affiche pas les listes : une liste complète pèse plus lourd que
 * tout le reste de la ligne, et il y en a une par signalement.
 */
const CHAMPS_RESUME = 'id, user_id, pseudo, email, categorie, message, page, emplacement, url, codex, codex_nom, codex_version, faction, liste_id, liste_nom, liste_total, liste_limite, liste_valide, user_agent, ecran, statut, note_admin, traite_par, traite_le, created_at, updated_at'

export interface EntreeSignalement {
  user_id: string | null
  pseudo?: string | null
  email?: string | null
  categorie: Categorie
  message: string
  page: string
  emplacement?: string | null
  url?: string | null
  codex?: string | null
  codex_nom?: string | null
  codex_version?: string | null
  faction?: string | null
  liste_id?: string | null
  liste_nom?: string | null
  liste_total?: number | null
  liste_limite?: number | null
  liste_valide?: boolean | null
  liste_data?: Liste | null
  liste_erreurs?: string[] | null
  user_agent?: string | null
  ecran?: string | null
}

export async function creerSignalement(e: EntreeSignalement): Promise<{ id: string }> {
  const { data, error } = await sb().from('signalements').insert(e).select('id').single()
  if (error) erreurSql(error, 'envoi du signalement')
  return data as { id: string }
}

export interface FiltresSignalements {
  statut?: string
  codex?: string
  recherche?: string
}

export async function listerSignalements(f: FiltresSignalements = {}): Promise<ResumeSignalement[]> {
  let q = sb().from('signalements').select(CHAMPS_RESUME).order('created_at', { ascending: false }).limit(300)
  if (f.statut) q = q.in('statut', f.statut.split(','))
  if (f.codex) q = q.eq('codex', f.codex)
  // le texte du bug et le nom de la liste : ce sur quoi on cherche quand on se souvient d'un signalement.
  // Virgules et parenthèses sont la syntaxe même du filtre PostgREST : tapées dans
  // la recherche, elles casseraient la requête.
  const motif = f.recherche?.replace(/[,()*%\\]/g, ' ').trim()
  if (motif) q = q.or(`message.ilike.%${motif}%,liste_nom.ilike.%${motif}%,codex_nom.ilike.%${motif}%`)
  const { data, error } = await q
  if (error) erreurSql(error, 'lecture des signalements')
  return (data ?? []) as unknown as ResumeSignalement[]
}

export async function lireSignalement(id: string): Promise<Signalement | null> {
  const { data, error } = await sb().from('signalements').select(CHAMPS).eq('id', id).maybeSingle()
  if (error) erreurSql(error, 'lecture du signalement')
  return (data as unknown as Signalement) ?? null
}

/** Compteur par statut, pour la pastille de la navigation admin. */
export async function compterSignalements(): Promise<Record<Statut, number>> {
  const { data, error } = await sb().from('signalements').select('statut')
  if (error) erreurSql(error, 'comptage des signalements')
  const compte = { nouveau: 0, en_cours: 0, resolu: 0, refuse: 0 } as Record<Statut, number>
  for (const l of (data ?? []) as Array<{ statut: Statut }>) compte[l.statut] = (compte[l.statut] ?? 0) + 1
  return compte
}

export async function majSignalement(id: string, adminId: string | null, e: { statut?: Statut; note_admin?: string }): Promise<void> {
  const patch: Record<string, unknown> = {}
  if (e.statut) {
    patch.statut = e.statut
    // qui a tranché et quand : un signalement qui quitte « nouveau » porte son traitement
    patch.traite_par = e.statut === 'nouveau' ? null : adminId
    patch.traite_le = e.statut === 'nouveau' ? null : new Date().toISOString()
  }
  if (e.note_admin !== undefined) patch.note_admin = e.note_admin || null
  if (!Object.keys(patch).length) return
  const { error, count } = await sb().from('signalements').update(patch, { count: 'exact' }).eq('id', id)
  if (error) erreurSql(error, 'mise à jour du signalement')
  if (count === 0) throw createError({ statusCode: 404, message: 'Signalement introuvable' })
}

export async function supprimerSignalement(id: string): Promise<void> {
  const { error } = await sb().from('signalements').delete().eq('id', id)
  if (error) erreurSql(error, 'suppression du signalement')
}
