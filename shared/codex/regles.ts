import type { Contrainte } from './schema'

/**
 * Phrases à trous pour l'éditeur de règles. Chaque contrainte du schéma a un gabarit :
 * texte avec des trous `{champ}` ; le type du trou dit quel contrôle afficher.
 */
export type TypeTrou = 'nombre' | 'texte' | 'budget' | 'unites' | 'options' | 'bool'

export interface Gabarit {
  type: Contrainte['type']
  /** où la règle a du sens */
  portee: Array<'formation' | 'option' | 'section'>
  phrase: string
  trous: Record<string, { type: TypeTrou; defaut?: unknown }>
}

export const GABARITS: Gabarit[] = [
  { type: 'max_par_armee', portee: ['formation', 'option', 'section'], phrase: 'Au plus {valeur} dans l\'armée', trous: { valeur: { type: 'nombre', defaut: 1 } } },
  { type: 'min_par_armee', portee: ['formation', 'option', 'section'], phrase: 'Au moins {valeur} dans l\'armée', trous: { valeur: { type: 'nombre', defaut: 1 } } },
  { type: 'max_par_formation', portee: ['option'], phrase: 'Au plus {valeur} fois par formation{par_taille}', trous: { valeur: { type: 'nombre', defaut: 1 }, par_taille: { type: 'bool', defaut: false } } },
  { type: 'max_options', portee: ['formation', 'section'], phrase: 'Au plus {valeur} améliorations par formation', trous: { valeur: { type: 'nombre', defaut: 3 } } },
  { type: 'hors_quota_options', portee: ['option'], phrase: 'Ne compte pas dans le nombre d\'améliorations', trous: {} },
  { type: 'exclusif', portee: ['option'], phrase: 'Une seule option du groupe « {groupe} » par formation', trous: { groupe: { type: 'texte', defaut: 'commandant' } } },
  { type: 'exclut', portee: ['option'], phrase: 'Incompatible avec {options}', trous: { options: { type: 'options', defaut: [] } } },
  { type: 'requiert_unite', portee: ['option'], phrase: 'Seulement si la formation contient {unites}', trous: { unites: { type: 'unites', defaut: [] } } },
  { type: 'taille_max_formation', portee: ['option'], phrase: 'Formation de {valeur} unités au maximum', trous: { valeur: { type: 'nombre', defaut: 15 } } },
  { type: 'obligatoire', portee: ['option'], phrase: 'Obligatoire dans chaque formation qui la propose', trous: {} },
  { type: 'fournit', portee: ['formation', 'option', 'section'], phrase: 'Ouvre {quantite} place(s) « {budget} »', trous: { quantite: { type: 'nombre', defaut: 1 }, budget: { type: 'budget' } } },
  { type: 'consomme', portee: ['formation', 'option', 'section'], phrase: 'Compte dans le budget « {budget} » ({quoi})', trous: { budget: { type: 'budget' }, quoi: { type: 'texte', defaut: 'un' } } },
  { type: 'cout_rare', portee: ['formation'], phrase: 'Compte pour {valeur} pts dans le budget', trous: { valeur: { type: 'nombre', defaut: 0 } } },
  { type: 'initiative', portee: ['formation', 'section'], phrase: 'Initiative {valeur}', trous: { valeur: { type: 'texte', defaut: '1+' } } },
  { type: 'pas_une_activation', portee: ['formation'], phrase: 'Ne compte pas comme une activation', trous: {} },
  { type: 'non_autonome', portee: ['section', 'formation'], phrase: 'Ne se prend qu\'au sein d\'une autre formation', trous: {} },
]

export function gabaritDe(type: string): Gabarit | undefined {
  return GABARITS.find((g) => g.type === type)
}

export function nouvelleContrainte(g: Gabarit): Contrainte {
  const c: Record<string, unknown> = { type: g.type }
  for (const [k, t] of Object.entries(g.trous)) if (t.defaut !== undefined) c[k] = t.defaut
  return c as Contrainte
}

/** Découpe la phrase en segments texte / trou pour le rendu. */
export function segments(g: Gabarit): Array<{ texte: string } | { trou: string }> {
  const out: Array<{ texte: string } | { trou: string }> = []
  const re = /\{(\w+)\}/g
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(g.phrase))) {
    if (m.index > i) out.push({ texte: g.phrase.slice(i, m.index) })
    out.push({ trou: m[1]! })
    i = m.index + m[0].length
  }
  if (i < g.phrase.length) out.push({ texte: g.phrase.slice(i) })
  return out
}
