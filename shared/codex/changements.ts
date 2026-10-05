import { stringify } from 'yaml'
import type { OngletCodex } from './problemes'

/**
 * Différences entre la version publiée d'un codex et son brouillon, à la manière d'une
 * revue de code : un bloc par élément touché (unité, amélioration, formation…), avec
 * ses lignes YAML ajoutées et retirées entourées d'un peu de contexte.
 */

export interface LigneDiff {
  /** `@` : coupure entre deux morceaux, les lignes identiques entre eux sont masquées. */
  type: ' ' | '+' | '-' | '@'
  texte: string
}

export interface Changement {
  cle: string
  libelle: string
  nom: string
  statut: 'ajoute' | 'supprime' | 'modifie'
  onglet: OngletCodex
  lignes: LigneDiff[]
  ajouts: number
  suppressions: number
}

const COLLECTIONS: Array<{ cle: string; libelle: string; onglet: OngletCodex }> = [
  { cle: 'budgets', libelle: 'Budget', onglet: 'liste' },
  { cle: 'unites', libelle: 'Unité', onglet: 'unites' },
  { cle: 'options', libelle: 'Amélioration', onglet: 'options' },
  { cle: 'formations', libelle: 'Formation', onglet: 'liste' },
  { cle: 'sections', libelle: 'Section', onglet: 'liste' },
  { cle: 'listes_test', libelle: 'Liste de test', onglet: 'liste' },
]

const CONTEXTE = 3

type Brut = Record<string, unknown>

function cleDe(x: unknown, i: number): string {
  const o = x as Brut | undefined
  return typeof o?.id === 'string' ? o.id : typeof o?.nom === 'string' ? `nom:${o.nom}` : `#${i}`
}

function nomDe(x: unknown, defaut: string): string {
  const o = x as Brut | undefined
  for (const k of ['nom', 'titre', 'libelle', 'id']) if (typeof o?.[k] === 'string' && o[k]) return o[k] as string
  return defaut
}

/** Comparaison insensible à l'ordre des clés : l'éditeur peut réécrire un objet dans un autre ordre. */
function stable(x: unknown): string {
  if (Array.isArray(x)) return `[${x.map(stable).join(',')}]`
  if (x && typeof x === 'object') {
    return `{${Object.keys(x).filter((k) => (x as Brut)[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stable((x as Brut)[k])}`).join(',')}}`
  }
  return JSON.stringify(x)
}

/** Range les clés de `avant` dans l'ordre de `apres`, pour que le diff ne montre que de vrais changements. */
function aligner(avant: unknown, apres: unknown): unknown {
  if (Array.isArray(avant) && Array.isArray(apres)) return avant.map((x, i) => aligner(x, apres[i]))
  if (!avant || typeof avant !== 'object' || Array.isArray(avant) || !apres || typeof apres !== 'object') return avant
  const a = avant as Brut
  const ordre = [...Object.keys(apres).filter((k) => k in a), ...Object.keys(a).filter((k) => !(k in (apres as Brut)))]
  return Object.fromEntries(ordre.map((k) => [k, aligner(a[k], (apres as Brut)[k])]))
}

function yaml(x: unknown): string[] {
  if (x === undefined) return []
  return stringify(x, { lineWidth: 0 }).replace(/\n$/, '').split('\n')
}

/** Diff ligne à ligne (plus longue sous-suite commune), puis découpe en morceaux avec contexte. */
export function diffLignes(avant: string[], apres: string[]): LigneDiff[] {
  const n = avant.length
  const m = apres.length
  const lcs = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = avant[i] === apres[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
    }
  }
  const brut: LigneDiff[] = []
  let i = 0
  let j = 0
  while (i < n || j < m) {
    if (i < n && j < m && avant[i] === apres[j]) { brut.push({ type: ' ', texte: avant[i]! }); i++; j++ }
    // Retraits avant ajouts, comme une revue de code.
    else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) { brut.push({ type: '-', texte: avant[i]! }); i++ }
    else { brut.push({ type: '+', texte: apres[j]! }); j++ }
  }
  const garder = brut.map(() => false)
  brut.forEach((l, k) => {
    if (l.type === ' ') return
    for (let d = Math.max(0, k - CONTEXTE); d <= Math.min(brut.length - 1, k + CONTEXTE); d++) garder[d] = true
  })
  const out: LigneDiff[] = []
  let coupe = false
  brut.forEach((l, k) => {
    if (garder[k]) {
      if (coupe && out.length) out.push({ type: '@', texte: '' })
      out.push(l)
      coupe = false
    } else coupe = true
  })
  return out
}

function changement(base: Omit<Changement, 'lignes' | 'ajouts' | 'suppressions'>, avant: unknown, apres: unknown): Changement {
  const lignes = diffLignes(yaml(aligner(avant, apres)), yaml(apres))
  return {
    ...base,
    lignes,
    ajouts: lignes.filter((l) => l.type === '+').length,
    suppressions: lignes.filter((l) => l.type === '-').length,
  }
}

export function changementsCodex(avant: unknown, apres: unknown): Changement[] {
  const a = (avant ?? {}) as Brut
  const b = (apres ?? {}) as Brut
  const out: Changement[] = []

  // La fiche de l'armée, sans le numéro de version : il change à chaque publication.
  const ficheA = { ...(a.codex as Brut | undefined), version: undefined }
  const ficheB = { ...(b.codex as Brut | undefined), version: undefined }
  if (stable(ficheA) !== stable(ficheB)) {
    out.push(changement({ cle: 'codex', libelle: "Fiche de l'armée", nom: nomDe(b.codex, 'Codex'), statut: 'modifie', onglet: 'armee' }, ficheA, ficheB))
  }

  for (const col of COLLECTIONS) {
    const listeA = (a[col.cle] as unknown[] | undefined) ?? []
    const listeB = (b[col.cle] as unknown[] | undefined) ?? []
    const parCleA = new Map(listeA.map((x, i) => [cleDe(x, i), x]))
    const vues = new Set<string>()
    listeB.forEach((x, i) => {
      const cle = cleDe(x, i)
      vues.add(cle)
      const ancien = parCleA.get(cle)
      const base = { cle: `${col.cle}:${cle}`, libelle: col.libelle, nom: nomDe(x, cle), onglet: col.onglet }
      if (ancien === undefined) out.push(changement({ ...base, statut: 'ajoute' }, undefined, x))
      else if (stable(ancien) !== stable(x)) out.push(changement({ ...base, statut: 'modifie' }, ancien, x))
    })
    for (const [cle, x] of parCleA) {
      if (!vues.has(cle)) out.push(changement({ cle: `${col.cle}:${cle}`, libelle: col.libelle, nom: nomDe(x, cle), statut: 'supprime', onglet: col.onglet }, x, undefined))
    }
  }
  return out
}
