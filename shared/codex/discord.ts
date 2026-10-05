import type { Codex } from './schema'
import type { FormationResolue, ResultatListe } from './engine'

/** Le nom de la variante n'apprend rien quand il n'y en a qu'une. */
function nomFormation(f: FormationResolue): string {
  return f.def.variantes.length > 1 && f.variante.nom ? `${f.def.nom} (${f.variante.nom})` : f.def.nom
}

/**
 * Liste d'armée en Markdown Discord, à coller dans un salon : titre, nombre de
 * formations, BLM (la plus grosse formation, en points), puis une ligne par
 * formation. Les améliorations et sous-formations passent en petit texte (`-#`).
 */
export function texteDiscord(codex: Codex, resultat: ResultatListe): string {
  const fs = resultat.formations
  const lignes = [`## ${codex.codex.nom} (${resultat.total} pts)`, `Formations : ***${fs.length}***`]
  const blm = fs.reduce<FormationResolue | undefined>((max, f) => (!max || f.cout > max.cout ? f : max), undefined)
  if (blm) lignes.push(`***BLM : ${nomFormation(blm)} (${blm.cout} pts)***`)
  lignes.push('')
  fs.forEach((f, i) => {
    lignes.push(`**${i + 1}. ${nomFormation(f)}** (${f.cout} pts)`)
    const extras = [...f.options.map((o) => o.libelle), ...f.sous_formations.map(nomFormation)]
    if (extras.length) lignes.push(`-# + ${extras.join(', + ')}`)
  })
  return lignes.join('\n')
}
