import type { Liste } from '~~/shared/codex/liste'

/** Une liste sans son contenu : ce que le tiroir affiche. */
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

/**
 * Listes d'armée côté serveur (table `listes_armee`).
 * Sans session, tout renvoie `null` : le builder retombe sur le stockage local du navigateur.
 */
export const useListes = () => {
  const utilisateur = useSupabaseUser()

  /** Vrai si une session est ouverte : le cookie porte l'authentification, pas nous. */
  function connecte() {
    return !!utilisateur.value
  }

  /** En-têtes seuls : le contenu d'une liste ne descend qu'à son ouverture. */
  async function lister(): Promise<ResumeListe[]> {
    if (!connecte()) return []
    return $fetch<ResumeListe[]>('/api/listes')
  }

  async function lire(id: string): Promise<ListeEnregistree> {
    return $fetch<ListeEnregistree>(`/api/listes/${id}`)
  }

  interface Corps { codex: string; nom: string; limite: number; data: Liste; total?: number; valide?: boolean }

  async function creer(corps: Corps): Promise<string> {
    const r = await $fetch<{ id: string }>('/api/listes', { method: 'POST', body: corps })
    return r.id
  }

  async function enregistrer(id: string, corps: Corps): Promise<void> {
    await $fetch(`/api/listes/${id}`, { method: 'PUT', body: corps })
  }

  async function supprimer(id: string): Promise<void> {
    await $fetch(`/api/listes/${id}`, { method: 'DELETE' })
  }

  async function partager(id: string): Promise<string> {
    const r = await $fetch<{ code: string }>(`/api/listes/${id}/partage`, { method: 'POST' })
    return r.code
  }

  async function retirerPartage(id: string): Promise<void> {
    await $fetch(`/api/listes/${id}/partage`, { method: 'DELETE' })
  }

  /** Lecture publique par code de partage, sans session. Porte le pseudo de l'auteur. */
  async function lirePartage(code: string): Promise<ListeEnregistree & { pseudo: string | null }> {
    return $fetch<ListeEnregistree & { pseudo: string | null }>(`/api/listes/partage/${code}`)
  }

  return { connecte, lister, lire, creer, enregistrer, supprimer, partager, retirerPartage, lirePartage }
}
