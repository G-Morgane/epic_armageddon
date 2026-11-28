/** Liste publique telle que la servent `/api/listes/publiques` et `/api/listes/annuaire`. */
export interface ListePublique {
  code_partage: string
  codex: string
  nom: string
  limite: number
  total: number | null
  updated_at: string
  pseudo: string | null
}
