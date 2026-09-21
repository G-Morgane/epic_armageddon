/**
 * Composition du PDF d'un codex : ce qu'on imprime et dans quel sens.
 * Les mêmes options servent à la page imprimable (query string) et au générateur PDF.
 */

import type { Unite } from './schema'

export interface OptionsPdf {
  /** page de garde avec le nom du codex */
  couverture: boolean
  /** règles spéciales et liste d'armée : toujours imprimées */
  /** une fiche par unité, à l'ancienne */
  profils: boolean
  /** tableau récapitulatif de tous les profils */
  references: boolean
  orientation: 'portrait' | 'paysage'
}

export const OPTIONS_PDF_DEFAUT: OptionsPdf = { couverture: true, profils: false, references: true, orientation: 'portrait' }

const vrai = (v: unknown, defaut: boolean) => (v === undefined || v === null || v === '' ? defaut : v !== '0' && v !== 'false' && v !== false)

/** Lit les options depuis une query string (valeurs absentes : valeurs par défaut). */
export function lireOptionsPdf(q: Record<string, unknown>): OptionsPdf {
  return {
    couverture: vrai(q.couverture, OPTIONS_PDF_DEFAUT.couverture),
    profils: vrai(q.profils, OPTIONS_PDF_DEFAUT.profils),
    references: vrai(q.references, OPTIONS_PDF_DEFAUT.references),
    orientation: q.orientation === 'paysage' ? 'paysage' : 'portrait',
  }
}

/** Query string correspondante (seulement ce qui diffère du défaut). */
export function requeteOptionsPdf(o: OptionsPdf, extra: Record<string, string> = {}): string {
  const p = new URLSearchParams(extra)
  if (o.couverture !== OPTIONS_PDF_DEFAUT.couverture) p.set('couverture', o.couverture ? '1' : '0')
  if (o.profils !== OPTIONS_PDF_DEFAUT.profils) p.set('profils', o.profils ? '1' : '0')
  if (o.references !== OPTIONS_PDF_DEFAUT.references) p.set('references', o.references ? '1' : '0')
  if (o.orientation !== OPTIONS_PDF_DEFAUT.orientation) p.set('orientation', o.orientation)
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * Ordre d'affichage des unités dans la feuille de références : par type de figurine.
 * Les types inconnus passent à la fin, dans l'ordre de saisie.
 */
const ORDRE_TYPES = ['PERSO', 'INF', 'VL', 'VB', 'EG', 'A', 'A/EG', 'VS']

const rangType = (type: string) => {
  const t = type.trim().toUpperCase()
  const i = ORDRE_TYPES.indexOf(t)
  return i === -1 ? ORDRE_TYPES.length : i
}

/** Trie les unités par type, en gardant l'ordre d'origine à l'intérieur d'un type. */
export function trierParType<T extends Pick<Unite, 'type'>>(unites: T[]): T[] {
  return unites.map((u, i) => ({ u, i })).sort((a, b) => rangType(a.u.type) - rangType(b.u.type) || a.i - b.i).map((x) => x.u)
}

/**
 * Lignes de bas de fiche d'une unité : uniquement celles qui sont renseignées.
 * `compact` : forme courte pour la feuille de références (CD 3 / BI 2).
 */
export function lignesComplementaires(u: Unite, compact = false): Array<{ label?: string; texte: string }> {
  const out: Array<{ label?: string; texte: string }> = []
  if (u.degats) {
    const bi = u.degats.bi !== undefined ? ` / BI ${u.degats.bi}` : ''
    out.push(compact ? { texte: `CD ${u.degats.cd}${bi}` } : { label: 'Capacité de dommage', texte: `${u.degats.cd}${bi}` })
  }
  if (u.degats?.critique) out.push({ label: 'Critique', texte: u.degats.critique })
  if (u.notes.length) out.push({ label: 'Notes', texte: u.notes.join(', ') })
  return out
}
