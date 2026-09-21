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
