/**
 * Mise en forme légère des textes saisis dans l'admin : gras et italique.
 * Le texte est échappé avant, donc le HTML produit est sûr pour `v-html`.
 *
 *   **gras**  ou  __gras__
 *   *italique*  ou  _italique_
 */

const ECHAPPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }

/** Texte enrichi (gras / italique) en HTML sûr. */
export function enrichir(texte?: string): string {
  if (!texte) return ''
  return texte
    .replace(/[&<>"]/g, (c) => ECHAPPES[c]!)
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
}

/** Paragraphes d'un texte, chacun enrichi. */
export function paragraphesEnrichis(texte?: string): string[] {
  return (texte ?? '').split(/\n\s*\n/).map((p) => enrichir(p.trim())).filter(Boolean)
}

/** Texte sans les marqueurs, pour les endroits qui n'acceptent pas de HTML (attributs, PDF brut). */
export function sansMarqueurs(texte?: string): string {
  if (!texte) return ''
  return texte.replace(/\*\*|__/g, '').replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\w)/g, '$1$2').replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1$2')
}

/**
 * Règle saisie comme une liste d'armes ou d'équipements, à imprimer en tableau
 * plutôt qu'en texte au fil des colonnes. Trois formes de puces sont reconnues,
 * toutes les puces de la règle devant suivre la même :
 *
 *   - **Nom**, coût, portée, puissance de feu        → tableau d'armes avec coût
 *   - **Nom**, portée, puissance de feu              → tableau d'armes (coût dans le titre)
 *   - **Nom** (+25 pts) : effet                      → tableau d'équipements
 *
 * Dans la puissance de feu, « / » (entouré d'espaces) sépare deux profils,
 * imprimés sur deux lignes. Les paragraphes hors liste deviennent le chapeau.
 */
export interface TableauRegle {
  chapeau: string[]
  colonnes: string[]
  /** colonne alignée à droite (le coût), -1 si aucune */
  colonneCout: number
  /** colonnes étroites, sur une seule ligne (coût, portée) */
  courtes: number[]
  /** cellules en HTML sûr ; une cellule peut tenir sur plusieurs lignes */
  lignes: string[][][]
}

const COUT = /^(gratuit|[+-]?\s*\d+\s*pts?)$/i
/** une portée : « 45cm », « (contact) », « 30cm et (15cm) », « illimité »… */
const PORTEE = /^(?:\(?\s*(?:\d+\s*cm|contact|illimitée?)\s*\)?(?:\s+(?:et|ou)\s+|$))+$/i
const ARME = /^\*\*(.+?)\*\*\s*,\s*(.+)$/
const EQUIPEMENT = /^\*\*(.+?)\*\*\s*\(([^)]*\d+\s*pts?[^)]*)\)\s*:\s*(.+)$/i
const profils = (t: string) => t.split(/\s+\/\s+/).map((x) => enrichir(x.trim()))

export function tableauRegle(texte?: string): TableauRegle | null {
  const lignes = (texte ?? '').split('\n')
  const puces = lignes.filter((l) => /^\s*-\s+/.test(l)).map((l) => l.replace(/^\s*-\s+/, '').trim())
  if (puces.length < 2) return null
  const chapeau = paragraphesEnrichis(lignes.filter((l) => !/^\s*-\s+/.test(l)).join('\n'))

  const armes = puces.map((p) => {
    const m = p.match(ARME)
    if (!m) return null
    const [cout, portee, ...reste] = m[2]!.split(/,\s*/)
    if (!cout || !COUT.test(cout.trim()) || !portee || !reste.length) return null
    return [[enrichir(m[1])], [enrichir(cout.trim())], [enrichir(portee.trim())], profils(reste.join(', '))]
  })
  if (armes.every(Boolean)) return { chapeau, colonnes: ['Nom', 'Coût', 'Portée', 'Puissance de feu'], colonneCout: -1, courtes: [1, 2], lignes: armes as string[][][] }

  const armesSansCout = puces.map((p) => {
    const m = p.match(ARME)
    if (!m) return null
    const [portee, ...reste] = m[2]!.split(/,\s*/)
    if (!portee || !PORTEE.test(portee.trim()) || !reste.length) return null
    return [[enrichir(m[1])], [enrichir(portee.trim())], profils(reste.join(', '))]
  })
  if (armesSansCout.every(Boolean)) return { chapeau, colonnes: ['Nom', 'Portée', 'Puissance de feu'], colonneCout: -1, courtes: [1], lignes: armesSansCout as string[][][] }

  const equipements = puces.map((p) => {
    const m = p.match(EQUIPEMENT)
    return m ? [[enrichir(m[1])], [enrichir(m[3]!.trim())], [enrichir(m[2]!.trim())]] : null
  })
  if (equipements.every(Boolean)) return { chapeau, colonnes: ['Amélioration', 'Effet', 'Coût'], colonneCout: 2, courtes: [], lignes: equipements as string[][][] }
  return null
}
