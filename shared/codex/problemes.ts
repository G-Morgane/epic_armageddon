import type { z } from 'zod'
import { CodexSchema, verifierReferences } from './schema'

/** Onglet de l'éditeur où se corrige un problème. */
export type OngletCodex = 'armee' | 'unites' | 'liste' | 'options'

export interface Probleme {
  /** Où, en clair : « Amélioration « Armement du Reaver » › contrainte n°3 ». */
  lieu: string
  /** Quoi, en clair. */
  message: string
  onglet?: OngletCodex
  /**
   * Valeur absente de cette version de l'app (type de contrainte, d'effet…).
   * L'éditeur ne propose que les valeurs qu'il connaît : une valeur inconnue vient
   * donc d'une version plus récente de l'app, pas d'une erreur de saisie.
   */
  inconnu?: string
}

const COLLECTIONS: Record<string, { libelle: string; onglet: OngletCodex }> = {
  codex: { libelle: "Fiche de l'armée", onglet: 'armee' },
  unites: { libelle: 'Unité', onglet: 'unites' },
  options: { libelle: 'Amélioration', onglet: 'options' },
  formations: { libelle: 'Formation', onglet: 'liste' },
  sections: { libelle: 'Section', onglet: 'liste' },
  budgets: { libelle: 'Budget', onglet: 'liste' },
  listes_test: { libelle: 'Liste de test', onglet: 'liste' },
}

/** Éléments de tableau imbriqués : nommés par leur nom s'ils en ont un, sinon numérotés. */
const ELEMENTS: Record<string, string> = {
  contraintes: 'contrainte',
  variantes: 'variante',
  armes: 'arme',
  composition: 'ligne de composition',
  parmi: 'choix',
  unites: 'unité',
  regles_md: 'règle',
  exceptions: 'exception',
}

const CHAMPS: Record<string, string> = {
  nom: 'nom', titre: 'titre', libelle: 'libellé', type: 'type', valeur: 'valeur', cout: 'coût',
  cout_par_unite: 'coût par unité', unite: 'unité', option: 'amélioration', budget: 'budget',
  emplacement: 'emplacement', version: 'version', slug: 'slug', faction: 'faction', id: 'identifiant',
  total: 'total', min: 'minimum', max: 'maximum', lot: 'lot', taille: 'taille', effet: 'effet',
  groupe: 'groupe', texte: 'texte', valeur_strategique: 'valeur stratégique', initiative: 'initiative',
}

function nomDe(x: unknown): string | undefined {
  if (!x || typeof x !== 'object') return
  const o = x as Record<string, unknown>
  for (const k of ['nom', 'titre', 'libelle', 'label', 'id']) if (typeof o[k] === 'string' && o[k]) return o[k] as string
}

/** Traduit un chemin Zod (`options.11.contraintes.2.type`) en lieu lisible, en suivant les données. */
function localiser(brut: unknown, chemin: PropertyKey[]): { lieu: string; onglet?: OngletCodex } {
  const morceaux: string[] = []
  let courant: unknown = brut
  let onglet: OngletCodex | undefined
  for (let i = 0; i < chemin.length; i++) {
    const cle = chemin[i]!
    const suivant = chemin[i + 1]
    const valeur = (courant as Record<PropertyKey, unknown> | undefined)?.[cle]
    if (i === 0 && typeof cle === 'string' && COLLECTIONS[cle]) {
      const col = COLLECTIONS[cle]
      onglet = col.onglet
      if (typeof suivant === 'number') {
        const el = (valeur as unknown[] | undefined)?.[suivant]
        const nom = nomDe(el)
        morceaux.push(nom ? `${col.libelle} « ${nom} »` : `${col.libelle} n°${suivant + 1}`)
        courant = el
        i++
      } else {
        morceaux.push(col.libelle)
        courant = valeur
      }
      continue
    }
    if (typeof cle === 'string' && typeof suivant === 'number' && Array.isArray(valeur)) {
      const el = valeur[suivant]
      const nom = cle === 'contraintes' ? undefined : nomDe(el)
      const libelle = ELEMENTS[cle] ?? cle
      morceaux.push(nom ? `${libelle} « ${nom} »` : `${libelle} n°${suivant + 1}`)
      courant = el
      i++
      continue
    }
    if (typeof cle === 'string') morceaux.push(`champ « ${CHAMPS[cle] ?? cle} »`)
    courant = valeur
  }
  return { lieu: morceaux.join(' › ') || 'Codex', onglet }
}

type Issue = z.core.$ZodIssue

function decrire(issue: Issue, recu: unknown): { message: string; inconnu?: string } {
  switch (issue.code) {
    case 'invalid_type':
      return { message: recu === undefined ? 'valeur obligatoire manquante' : `attendu : ${issue.expected === 'number' ? 'un nombre' : issue.expected === 'string' ? 'du texte' : issue.expected}` }
    case 'invalid_union':
      if ('discriminator' in issue && issue.discriminator) {
        return {
          message: `type « ${String(recu)} » inconnu de cette version de l'app`,
          inconnu: String(recu),
        }
      }
      return { message: 'valeur non reconnue' }
    case 'invalid_value':
      return { message: `« ${String(recu)} » n'est pas une valeur possible (attendu : ${issue.values.map(String).join(', ')})` }
    case 'too_small':
      return { message: issue.origin === 'array' ? `au moins ${issue.minimum} élément(s) requis` : issue.inclusive ? `doit valoir au moins ${issue.minimum}` : `doit être supérieur à ${issue.minimum}` }
    case 'too_big':
      return { message: `doit valoir au plus ${issue.maximum}` }
    case 'invalid_format':
      return { message: issue.format === 'regex' ? 'format invalide (minuscules, chiffres et tirets uniquement)' : `format invalide (${issue.format})` }
    case 'unrecognized_keys':
      return { message: `champ(s) inconnu(s) : ${issue.keys.join(', ')}` }
    default:
      return { message: issue.message }
  }
}

function lire(brut: unknown, chemin: PropertyKey[]): unknown {
  return chemin.reduce<unknown>((o, k) => (o as Record<PropertyKey, unknown> | undefined)?.[k], brut)
}

/** `option armement_reaver : unité inconnue « x »` → lieu nommé + message. */
const PREFIXES_REFERENCES: Array<[RegExp, string, string, OngletCodex]> = [
  [/^unité ([\w-]+)/, 'unites', 'Unité', 'unites'],
  [/^option ([\w-]+)/, 'options', 'Amélioration', 'options'],
  [/^formation ([\w-]+)/, 'formations', 'Formation', 'liste'],
  [/^section ([\w-]+)/, 'sections', 'Section', 'liste'],
]

function problemeReference(brut: unknown, texte: string): Probleme {
  for (const [re, col, libelle, onglet] of PREFIXES_REFERENCES) {
    const m = texte.match(re)
    if (!m) continue
    const el = ((brut as Record<string, unknown[]> | undefined)?.[col] ?? []).find((x) => (x as { id?: string })?.id === m[1])
    const reste = texte.slice(m[0].length).replace(/^\s*:\s*/, '')
    return { lieu: `${libelle} « ${nomDe(el) ?? m[1]} »`, message: reste || texte, onglet }
  }
  return { lieu: 'Codex', message: texte }
}

/** Valide un brouillon et rend ses problèmes en clair (mêmes règles côté serveur et navigateur). */
export function problemesCodex(brut: unknown): Probleme[] {
  const r = CodexSchema.safeParse(brut)
  if (r.success) return verifierReferences(r.data).map((t) => problemeReference(brut, t))
  return r.error.issues.map((issue) => {
    const { lieu, onglet } = localiser(brut, issue.path)
    return { lieu, onglet, ...decrire(issue, lire(brut, issue.path)) }
  })
}
