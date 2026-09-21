import type { Liste } from '~~/shared/codex/liste'

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

/**
 * Listes d'armée côté serveur (table `listes_armee`).
 * Sans session, tout renvoie `null` : le builder retombe sur le stockage local du navigateur.
 */
export const useListes = () => {
  const supabase = useSupabase()

  async function entetes() {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : null
  }

  async function connecte() {
    return !!(await entetes())
  }

  async function lister(): Promise<ListeEnregistree[]> {
    const h = await entetes()
    if (!h) return []
    return $fetch<ListeEnregistree[]>('/api/listes', { headers: h })
  }

  interface Corps { codex: string; nom: string; limite: number; data: Liste; total?: number; valide?: boolean }

  async function creer(corps: Corps): Promise<string> {
    const h = await entetes()
    if (!h) throw new Error('Connexion requise')
    const r = await $fetch<{ id: string }>('/api/listes', { method: 'POST', body: corps, headers: h })
    return r.id
  }

  async function enregistrer(id: string, corps: Corps): Promise<void> {
    const h = await entetes()
    if (!h) throw new Error('Connexion requise')
    await $fetch(`/api/listes/${id}`, { method: 'PUT', body: corps, headers: h })
  }

  async function supprimer(id: string): Promise<void> {
    const h = await entetes()
    if (!h) throw new Error('Connexion requise')
    await $fetch(`/api/listes/${id}`, { method: 'DELETE', headers: h })
  }

  async function partager(id: string): Promise<string> {
    const h = await entetes()
    if (!h) throw new Error('Connexion requise')
    const r = await $fetch<{ code: string }>(`/api/listes/${id}/partage`, { method: 'POST', headers: h })
    return r.code
  }

  async function retirerPartage(id: string): Promise<void> {
    const h = await entetes()
    if (!h) throw new Error('Connexion requise')
    await $fetch(`/api/listes/${id}/partage`, { method: 'DELETE', headers: h })
  }

  /** Lecture publique par code de partage, sans session. */
  async function lirePartage(code: string): Promise<ListeEnregistree> {
    return $fetch<ListeEnregistree>(`/api/listes/partage/${code}`)
  }

  return { connecte, lister, creer, enregistrer, supprimer, partager, retirerPartage, lirePartage }
}
