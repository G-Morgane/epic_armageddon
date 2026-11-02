import type { Arme, Contrainte, Formation, Option, Section, Variante } from './schema'
import type { IndexCodex, OptionResolue } from './engine'
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

/**
 * Caractéristiques d'une amélioration prise, pour la liste imprimée : le profil de
 * l'arme choisie (« 60cm, 3xMA2+, Rchg »), ou ce qu'un mot-clé apporte. Le nom est
 * déjà dans le libellé : d'un mot-clé « Auspex Amélioré (Tir Indirect…) » on ne garde
 * que la parenthèse. Vide quand il n'y a rien à ajouter au libellé.
 */
export function caracOption(o: Pick<OptionResolue, 'def' | 'instance'>): string | undefined {
  const detail = (texte: string, nom: string) => {
    const m = texte.match(/^[^(]*\((.*)\)\s*$/)
    if (m) return m[1]
    return nom.toLowerCase().includes(texte.toLowerCase()) ? undefined : texte
  }
  const e = o.def.effet
  if (e.type === 'choix') {
    const c = e.parmi.find((p) => p.id === o.instance.choix) ?? e.parmi[0]
    if (!c) return
    const profil = [c.portee, c.puissance].filter(Boolean).join(', ')
    if (profil) return profil
    if (c.effet?.type === 'mot_cle') return detail(c.effet.texte, c.nom)
    return
  }
  if (e.type === 'mot_cle') return detail(e.texte, o.def.nom)
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
  return [...new Set(e.parmi.map((p) => coutChoix(o, p)))].join(' / ')
}

type ChoixOption = Extract<Option['effet'], { type: 'choix' }>['parmi'][number]

// un choix sans coût propre porte son coût dans son effet (« 50 pts chacun », « 175 pts »)
function coutChoix(o: Option, p: ChoixOption): string {
  return p.effet && !p.cout ? coutOption({ ...o, effet: p.effet }) : p.cout ? `${p.cout} pts` : 'Gratuit'
}

/** Au-delà, une ligne par choix allonge trop le tableau (armes de titan) : on garde la phrase. */
const MAX_LIGNES_AUTO = 4

/** Une ligne par choix exclusif, générée comme les variantes de formation ; null si l'option n'en a pas 2 à 4. */
function lignesChoix(idx: IndexCodex, o: Option): { texte: string; cout: string }[] | null {
  const e = o.effet
  if (e.type === 'choix' && e.parmi.length >= 2 && e.parmi.length <= MAX_LIGNES_AUTO) {
    // « ou ajouter… » : le verbe généré suit le « ou » en minuscule, un nom propre de choix garde sa majuscule
    const verbe = (t: string, i: number) => (i > 0 ? t.replace(/^(Ajouter|Remplacer) /, (m) => m.toLowerCase()) : t)
    return e.parmi.map((p, i) => ({
      texte: p.effet ? verbe(phraseOption(idx, { ...o, effet: p.effet, phrase_pdf: undefined }), i) : libelleChoix(p),
      cout: coutChoix(o, p),
    }))
  }
  if (e.type === 'ajouter' && e.variantes && e.variantes.length >= 2 && e.variantes.length <= MAX_LIGNES_AUTO) {
    return e.variantes.map((v) => ({ texte: v.nom, cout: `${v.cout} pts` }))
  }
  return null
}

/**
 * Coût de chaque choix d'une option à plusieurs choix, dans l'ordre ; null sinon.
 * Les choix voisins au même coût n'en font qu'un : les deux Immolators d'un
 * transport tiennent sur la ligne « ajouter des Immolators ».
 */
function coutsParChoix(o: Option): string[] | null {
  const e = o.effet
  let couts: string[] | null = null
  if (e.type === 'choix') couts = e.parmi.map((p) => coutChoix(o, p))
  if (e.type === 'ajouter' && e.variantes && e.variantes.length >= 2) couts = e.variantes.map((v) => `${v.cout} pts`)
  if (e.type === 'choix_multiple') {
    couts = e.parmi.map((p) => (p.paliers?.length ? p.paliers.map((x) => `${x.cout} pts par ${x.nombre}`).join(' / ') : p.cout ? `${p.cout} pts chacun` : 'Gratuit'))
  }
  return couts && couts.length >= 2 ? couts : null
}

/** Coûts alignés sur `n` lignes : un par choix, ou un par groupe de choix voisins au même coût. */
function coutsSurLignes(parChoix: string[] | null, cout: string, n: number): string[] | null {
  if (parChoix?.length === n) return parChoix
  const groupes = parChoix?.filter((c, i) => i === 0 || c !== parChoix[i - 1])
  if (groupes?.length === n) return groupes
  // tous les choix au même prix (Capitaine, Archiviste, Chapelain…) : le prix vaut pour chaque ligne
  if (parChoix && new Set(parChoix).size === 1) return Array(n).fill(parChoix[0])
  const montants = cout.split(' / ')
  return montants.length === n ? montants : null
}

/**
 * Coupe une phrase saisie sur chaque « ou » hors parenthèses, sauf là où le
 * « ou » ne sépare pas deux choix et recolle le morceau au suivant :
 * - une quantité (« Ajouter 1 ou 2 Dreadnoughts ») ;
 * - « inférieur ou égal » ;
 * - ce qu'on remplace (« Remplacer le Seigneur ou le Champion par un Prince Démon »).
 */
function decouperOu(phrase: string): string[] {
  const morceaux = couperOu(phrase)
  const lignes: string[] = []
  for (const m of morceaux) {
    const prec = lignes.at(-1)
    const recoller = prec !== undefined && (/\d$/.test(prec) || /(inférieur|supérieur)$/.test(prec) || (/rempla/i.test(prec) && !/ par /.test(prec)))
    if (recoller) lignes[lignes.length - 1] = `${prec} ou ${m}`
    else lignes.push(m)
  }
  return lignes
}

function couperOu(phrase: string): string[] {
  const morceaux: string[] = []
  let prof = 0
  let debut = 0
  for (let i = 0; i < phrase.length; i++) {
    const c = phrase[i]
    if (c === '(') prof++
    else if (c === ')') prof = Math.max(0, prof - 1)
    else if (prof === 0 && phrase.startsWith(' ou ', i)) {
      morceaux.push(phrase.slice(debut, i))
      debut = i + 4
      i += 3
    }
  }
  morceaux.push(phrase.slice(debut))
  const propres = morceaux.map((m) => m.trim().replace(/,$/, '').trim())
  return propres.some((m) => !m) ? [phrase] : propres
}

// « (50 pts) », « (25 pts chacune) », « (50 pts par 3 / 75 pts par 4) » : le coût passe dans sa colonne
const COUT_SEUL = /\s*\(\+?\d+ pts(?: (?:chacun|chacune|chaque|le lot|les deux|par \d+))?(?: \/ \+?\d+ pts(?: (?:chacun|chacune|chaque|le lot|les deux|par \d+))?)*\)/g
// « (75 pts, 1 maximum par armée) » : seule la précision reste entre parenthèses
const COUT_EN_TETE = /\(\+?\d+ pts(?: (?:chacun|chacune|chaque))?, /g

const sansCout = (t: string) => t.replace(COUT_SEUL, '').replace(COUT_EN_TETE, '(').trim()

/**
 * Lignes d'une option dans le tableau du PDF, précédées de « ou » comme les
 * variantes de formation. Sans phrase saisie, une option à choix exclusifs
 * donne une ligne par choix. Une phrase saisie s'ouvre à chaque retour à la
 * ligne et, quand l'option a plusieurs choix, à chaque « ou ». Le coût suit
 * ligne à ligne quand il compte autant de montants que de lignes (et quitte
 * alors le texte), sinon il reste entier sur la première.
 */
export function lignesOption(idx: IndexCodex, o: Option): { texte: string; cout: string }[] {
  if (!o.phrase_pdf) {
    const auto = lignesChoix(idx, o)
    if (auto) return auto
  }
  const parChoix = coutsParChoix(o)
  let textes = phraseOption(idx, o).split('\n').map((t) => t.trim()).filter(Boolean)
  if (o.phrase_pdf && parChoix && textes.length === 1) textes = decouperOu(textes[0]!)
  const cout = coutOption(o)
  const couts = coutsSurLignes(parChoix, cout, textes.length)
  if (textes.length > 1 && couts) {
    return textes.map((t, i) => ({ texte: i > 0 ? t.replace(/^(Ajout|Rempla)/, (m) => m.toLowerCase()) : t, cout: couts[i]! }))
      .map((l) => ({ ...l, texte: sansCout(l.texte) }))
  }
  return textes.map((texte, i) => ({ texte, cout: i === 0 ? cout : '' }))
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
