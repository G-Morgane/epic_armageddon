/**
 * Une liste d'armée en cours de construction (côté builder) ou une fixture de test.
 * Indépendante de tout framework : sérialisable en JSON.
 */

export interface OptionInstance {
  /** identifiant local, stable pour l'UI */
  id: string
  option: string
  /** nombre de lots pour les options quantifiables (cout_par_unite) ou de lots de remplacement */
  quantite?: number
  /** effet `choix` : id du choix retenu */
  choix?: string
  /** effet `ajouter` avec `variantes` : id ou index de la variante retenue */
  variante?: string
  /** effet `choix_multiple` : quantité par unité */
  repartition?: Record<string, number>
}

export interface FormationInstance {
  id: string
  formation: string
  variante: string
  /** choix de composition : index de ligne (string) -> quantité par unité (en pioches) */
  choix: Record<string, Record<string, number>>
  options: OptionInstance[]
  sous_formations: FormationInstance[]
}

export interface Liste {
  id: string
  nom: string
  codex: string
  limite: number
  formations: FormationInstance[]
}

let compteur = 0
export function genererId(prefixe = 'x'): string {
  compteur += 1
  return `${prefixe}_${Date.now().toString(36)}_${compteur.toString(36)}`
}

/** Complète une instance partielle (fixtures YAML, imports) avec les champs obligatoires. */
export function normaliserFormation(entree: {
  formation: string
  variante?: string
  choix?: Record<string, Record<string, number>>
  options?: Array<Partial<OptionInstance> & { option: string }>
  sous_formations?: Array<Parameters<typeof normaliserFormation>[0]>
}, varianteDefaut: (formation: string) => string): FormationInstance {
  return {
    id: genererId('f'),
    formation: entree.formation,
    variante: entree.variante ?? varianteDefaut(entree.formation),
    choix: entree.choix ?? {},
    options: (entree.options ?? []).map((o) => ({ id: genererId('o'), ...o })),
    sous_formations: (entree.sous_formations ?? []).map((s) => normaliserFormation(s, varianteDefaut)),
  }
}
