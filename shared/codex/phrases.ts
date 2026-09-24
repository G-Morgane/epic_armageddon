import type { Arme, Contrainte, Formation, Option, Section, Variante } from './schema'
import type { IndexCodex } from './engine'
import { armesPossibles } from './engine'

/**
 * Phrases du PDF générées à partir des données structurées.
 * Une `phrase_pdf` explicite l'emporte toujours sur la génération.
 */

function nom(idx: IndexCodex, id: string, n = 1): string {
  const u = idx.unites.get(id)
  if (!u) return id
  return n > 1 ? pluriel(u.nom) : u.nom
}

/** Pluriel simple : n'ajoute un s qu'aux noms sans marque de pluriel ni chiffre, jamais aux noms composés. */
export function pluriel(mot: string): string {
  if (/[sxz]$/i.test(mot) || /\d/.test(mot) || /\s/.test(mot) || /'$/.test(mot)) return mot
  return `${mot}s`
}

export function joindre(parts: string[]): string {
  const p = parts.filter(Boolean)
  if (p.length <= 1) return p.join('')
  return `${p.slice(0, -1).join(', ')} et ${p[p.length - 1]}`
}

function plageTexte(total: number | { min: number; max: number | 'besoin_transport' }): string {
  if (typeof total === 'number') return `${total}`
  if (total.max === 'besoin_transport') return `jusqu'à autant que d'unités à transporter`
  if (total.min === 0) return `jusqu'à ${total.max}`
  return `${total.min} à ${total.max}`
}

// ---------- Formations ----------

/**
 * Places de transport apportées par une variante.
 *
 * On choisit entre « 2 Thunderhawks transporteurs » et « 3 » sans savoir ce
 * qu'ils embarquent : la composition nomme les véhicules, jamais leur capacité.
 * Seules les lignes à effectif fixe comptent. Une ligne `transports` est
 * dimensionnée par le moteur d'après ce qu'il reste à embarquer, et une ligne
 * `choix` dépend de ce que le joueur y met : ni l'une ni l'autre n'a de total
 * connu avant l'ajout.
 */
export function placesVariante(idx: IndexCodex, v: Variante): number {
  let total = 0
  for (const l of v.composition) {
    if (!('unite' in l)) continue
    const capacite = idx.unites.get(l.unite)?.transport?.capacite
    if (capacite) total += capacite * l.nombre
  }
  return total
}

export function phraseComposition(idx: IndexCodex, v: Variante): string {
  const parts: string[] = []
  for (const l of v.composition) {
    if ('unite' in l) {
      if (l.implicite) continue
      parts.push(`${l.nombre} ${nom(idx, l.unite, l.nombre)}`)
    } else if ('choix' in l) {
      if (l.choix.phrase_pdf) { parts.push(l.choix.phrase_pdf); continue }
      const unites = l.choix.parmi.map((p) => {
        const base = p.par_pioche > 1 ? `${p.par_pioche} ${nom(idx, p.unite, p.par_pioche)}` : nom(idx, p.unite, 2)
        return p.cout ? `${base} (${p.cout} pts)` : base
      })
      parts.push(`${plageTexte(l.choix.total)} au choix parmi : ${unites.join(', ')}`)
    } else {
      parts.push('+ transports')
    }
  }
  return parts.join(' ').replace(/ \+ transports/, ' + transports') || joindre(parts)
}

/** Lignes « ou » d'une formation : une par variante. */
export function lignesFormation(idx: IndexCodex, f: Formation): Array<{ nom?: string; composition: string; cout: string }> {
  return f.variantes.map((v) => ({
    nom: v.nom,
    composition: f.phrase_pdf && v === f.variantes[0] ? f.phrase_pdf : composeAvecEt(idx, v),
    cout: v.cout ? `${v.cout} pts` : coutVariable(idx, v),
  }))
}

function composeAvecEt(idx: IndexCodex, v: Variante): string {
  const parts: string[] = []
  let transports = false
  for (const l of v.composition) {
    if ('unite' in l) { if (!l.implicite) parts.push(`${l.nombre} ${nom(idx, l.unite, l.nombre)}`) }
    else if ('choix' in l) parts.push(l.choix.phrase_pdf ?? phraseComposition(idx, { ...v, composition: [l] }))
    else transports = true
  }
  return joindre(parts) + (transports ? ' + transports' : '')
}

function coutVariable(idx: IndexCodex, v: Variante): string {
  for (const l of v.composition) {
    if ('choix' in l) {
      const couts = [...new Set(l.choix.parmi.map((p) => p.cout).filter(Boolean))]
      if (couts.length === 1) return `${couts[0]} pts chacun`
      if (couts.length > 1) return couts.map((c) => `${c} pts`).join(' / ')
    }
  }
  return 'Gratuit'
}

export function prefixeFormation(idx: IndexCodex, f: Formation): string {
  const cs: Contrainte[] = [...(idx.sectionDe.get(f.id)?.contraintes ?? []), ...f.contraintes]
  const max = cs.find((c) => c.type === 'max_par_armee')
  if (max && max.type === 'max_par_armee') return `0-${max.valeur} `
  return ''
}

export function phraseSousFormations(f: Formation): string | undefined {
  const s = f.sous_formations ?? f.variantes.find((v) => v.sous_formations)?.sous_formations
  if (!s) return undefined
  return s.phrase_pdf ?? `${plageTexte(s.total)} ${s.label}`
}

// ---------- Options ----------

export function phraseOption(idx: IndexCodex, o: Option): string {
  if (o.phrase_pdf) return o.phrase_pdf
  const e = o.effet
  if (e.type === 'ajouter') {
    if (e.variantes?.length) return e.variantes.map((v) => v.nom).join(' ou ')
    const unites = e.unites.map((u) => (e.cout_par_unite !== undefined ? nom(idx, u.unite, 2) : `${u.nombre} ${nom(idx, u.unite, u.nombre)}`))
    if (e.cout_par_unite !== undefined) {
      const lot = e.unites.reduce((s, u) => s + u.nombre, 0) > 1 || e.lot > 1 ? ' par lot' : ''
      if (e.max === 'besoin_transport') return `Ajouter jusqu'à autant de ${unites.join(' et ')} que nécessaire pour embarquer${e.perimetre_transport === 'options' ? ' les unités des améliorations' : ' la formation'}`
      if (e.max !== undefined) return `Ajouter ${e.min ?? 1} à ${e.max} ${unites.join(' et ')}${lot}`
      return `Ajouter des ${unites.join(' et ')}${lot}`
    }
    return `Ajouter ${joindre(unites)}`
  }
  if (e.type === 'remplacer') {
    const de = (Array.isArray(e.de) ? e.de : [e.de]).map((d) => nom(idx, d, 2)).join(' ou ')
    if (e.tout || e.max === 'tout') return `Remplacer tous les ${de} par ${e.par_nombre ?? ''} ${nom(idx, e.par, e.par_nombre ?? 2)}`.replace(/\s+/g, ' ')
    const n = e.lot
    return `Remplacer ${n} ${de} par ${n} ${nom(idx, e.par, n)}`
  }
  if (e.type === 'mot_cle') return e.texte
  if (e.type === 'choix_multiple') {
    const unites = e.parmi.map((p) => nom(idx, p.unite, 2))
    return `Ajouter ${plageTexte(e.total)} véhicule(s) selon n'importe quelle combinaison : ${unites.join(', ')}`
  }
  // choix
  return e.parmi.map(libelleChoix).join(' ou ')
}

/** Libellé d'un choix d'option : les armes de titan portent leur catégorie et leur emplacement. */
export function libelleChoix(p: { nom: string; categorie?: string; emplacement?: string }): string {
  const tags = [p.categorie, p.emplacement].filter(Boolean)
  return tags.length ? `${p.nom} (${tags.join(', ')})` : p.nom
}

/**
 * Armes au choix derrière une ligne générique : le nom avec son coût d'un côté,
 * le profil de l'autre, pour que l'affichage puisse détacher les deux. Tableau
 * vide si la ligne n'a pas d'armes au choix.
 */
export function armesPossiblesLignes(idx: IndexCodex, arme: Arme): { nom: string; profil: string }[] {
  return armesPossibles(idx, arme).map((a) => ({
    nom: `${a.nom} (${a.cout ? `${a.cout} pts` : 'gratuit'})`,
    profil: [a.portee, a.puissance].filter(Boolean).join(', '),
  }))
}

/** Les mêmes, en une phrase. Le profil contient déjà des virgules, d'où le point médian entre les armes. */
export function texteArmesPossibles(idx: IndexCodex, arme: Arme): string {
  return armesPossiblesLignes(idx, arme)
    .map((a) => `${a.nom}${a.profil ? ` : ${a.profil}` : ''}`)
    .join(' · ')
}

export function coutOption(o: Option): string {
  const e = o.effet
  if (e.type === 'ajouter') {
    if (e.variantes?.length) return e.variantes.map((v) => `${v.cout} pts`).join(' / ')
    if (e.cout_par_unite !== undefined) return e.cout_par_unite === 0 ? 'Gratuit' : `${e.cout_par_unite} pts${e.lot > 1 || e.unites.reduce((s, u) => s + u.nombre, 0) > 1 ? ' le lot' : ' chacun'}`
    return e.cout ? `${e.cout} pts` : 'Gratuit'
  }
  if (e.type === 'remplacer') return e.cout ? `+${e.cout} pts` : 'Gratuit'
  if (e.type === 'mot_cle') return e.cout ? `${e.cout} pts` : 'Gratuit'
  if (e.type === 'choix_multiple') {
    const couts: string[] = []
    for (const p of e.parmi) {
      const textes = p.paliers?.length
        ? p.paliers.map((x) => `${x.cout} pts par ${x.nombre}`)
        : [p.cout ? `${p.cout} pts chacun` : 'Gratuit']
      for (const t of textes) if (!couts.includes(t)) couts.push(t)
    }
    return couts.join(' / ')
  }
  const couts = [...new Set(e.parmi.map((p) => p.cout))]
  return couts.map((c) => (c ? `${c} pts` : 'Gratuit')).join(' / ')
}

/** Astérisque si l'option renvoie à une note de bas de tableau. */
export function marqueNote(o: Option, section: Section): string {
  return o.note_ref && section.notes[o.note_ref] ? '*' : ''
}

// ---------- Sections ----------

export function sousTitreSection(idx: IndexCodex, s: Section): string | undefined {
  if (s.sous_titre !== undefined && s.contraintes.length === 0) return s.sous_titre
  const parts: string[] = []
  for (const c of s.contraintes) {
    if (c.type === 'consomme') {
      const b = idx.codex.budgets.find((x) => x.id === (Array.isArray(c.budget) ? c.budget[0] : c.budget))
      if (b?.phrase_pdf) parts.push(b.phrase_pdf)
    }
    if (c.type === 'max_options') parts.push(`Chaque formation peut prendre jusqu'à ${c.valeur} améliorations`)
    if (c.type === 'min_par_armee') parts.push(`Au moins ${c.valeur} formation(s) obligatoire(s)`)
    if (c.type === 'initiative') parts.push(`Initiative ${c.valeur}`)
  }
  if (!parts.length) return undefined
  return parts.join('. ')
}

/** Titre de regroupement (« SUPPORTS… ») quand plusieurs sections partagent le même sous_titre explicite. */
export function bandeauSupports(s: Section): string | undefined {
  return s.sous_titre
}

export function optionsDeSection(idx: IndexCodex, s: Section): Option[] {
  const ids = new Set<string>(s.options)
  for (const fid of s.formations) {
    const f = idx.formations.get(fid)
    if (!f) continue
    for (const o of f.options ?? []) ids.add(o)
    for (const o of f.options_plus) ids.add(o)
  }
  return [...ids].map((id) => idx.options.get(id)!).filter(Boolean)
}
