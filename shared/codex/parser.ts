import type { LigneComposition, Unite } from './schema'

/**
 * Composition en texte libre <-> lignes structurées.
 *   « 12 Gardes Impériaux, 7 Chimères »
 *   « 3 au choix parmi Baneblade, Shadowsword »
 *   « 2 à 6 au choix parmi Termagant ×6 (75), Hormagaunt ×6 (75) »
 *   « + transports Rhino »
 *   « 1 Commissaire (implicite) »
 */

export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Retrouve une unité par nom approché (accents, casse, pluriel). */
export function trouverUnite(unites: Unite[], texte: string): Unite | undefined {
  const t = normaliser(texte)
  if (!t) return undefined
  const sansS = t.replace(/s\b/g, '')
  const exact = unites.find((u) => normaliser(u.nom) === t || u.id === t.replace(/ /g, '_'))
  if (exact) return exact
  const pluriel = unites.find((u) => normaliser(u.nom).replace(/s\b/g, '') === sansS)
  if (pluriel) return pluriel
  const debut = unites.filter((u) => normaliser(u.nom).startsWith(t) || t.startsWith(normaliser(u.nom)))
  if (debut.length === 1) return debut[0]
  return undefined
}

export interface ResultatParse {
  lignes: LigneComposition[]
  erreurs: string[]
}

export function parserComposition(texte: string, unites: Unite[]): ResultatParse {
  const lignes: LigneComposition[] = []
  const erreurs: string[] = []
  const morceaux = texte
    .split(/\s*(?:;|\n|,(?![^(]*\)))\s*/)
    .map((m) => m.trim())
    .filter(Boolean)

  // regrouper « N au choix parmi A, B » : la virgule sépare aussi la liste, on ré-assemble
  const items: string[] = []
  for (const m of morceaux) {
    const dernier = items[items.length - 1]
    if (dernier && /au choix parmi/i.test(dernier) && !/^\+?\s*\d/.test(m) && !/au choix parmi/i.test(m) && !/^\+\s*transports?/i.test(m)) {
      items[items.length - 1] = `${dernier}, ${m}`
    } else items.push(m)
  }

  for (const item of items) {
    let m: RegExpMatchArray | null

    if ((m = item.match(/^\+\s*transports?\s+(.+)$/i))) {
      const u = trouverUnite(unites, m[1]!)
      if (!u) { erreurs.push(`Transport inconnu : « ${m[1]} »`); continue }
      lignes.push({ transports: { unite: u.id } })
      continue
    }

    if ((m = item.match(/^(\d+)(?:\s*(?:à|a|-)\s*(\d+))?\s+au choix parmi\s*:?\s*(.+)$/i))) {
      const min = parseInt(m[1]!, 10)
      const max = m[2] ? parseInt(m[2]!, 10) : min
      const parmi: Array<{ unite: string; cout: number; par_pioche: number }> = []
      for (const brut of m[3]!.split(/\s*,\s*/)) {
        const p = brut.match(/^(.+?)(?:\s*[×x]\s*(\d+))?(?:\s*\((\d+)\s*(?:pts?)?\))?$/i)
        const u = trouverUnite(unites, p?.[1] ?? brut)
        if (!u) { erreurs.push(`Unité inconnue : « ${brut} »`); continue }
        parmi.push({ unite: u.id, par_pioche: p?.[2] ? parseInt(p[2]!, 10) : 1, cout: p?.[3] ? parseInt(p[3]!, 10) : 0 })
      }
      if (parmi.length) lignes.push({ choix: { total: min === max ? min : { min, max }, parmi } })
      continue
    }

    if ((m = item.match(/^(\d+)\s+(.+?)(?:\s*\((implicite)\))?$/i))) {
      const u = trouverUnite(unites, m[2]!)
      if (!u) { erreurs.push(`Unité inconnue : « ${m[2]} »`); continue }
      lignes.push({ unite: u.id, nombre: parseInt(m[1]!, 10), ...(m[3] ? { implicite: true } : {}) })
      continue
    }

    const u = trouverUnite(unites, item)
    if (u) { lignes.push({ unite: u.id, nombre: 1 }); continue }
    erreurs.push(`Ligne non comprise : « ${item} »`)
  }
  return { lignes, erreurs }
}

export function formaterComposition(lignes: LigneComposition[], unites: Unite[]): string {
  const nom = (id: string) => unites.find((u) => u.id === id)?.nom ?? id
  return lignes
    .map((l) => {
      if ('unite' in l) return `${l.nombre} ${nom(l.unite)}${l.implicite ? ' (implicite)' : ''}`
      if ('transports' in l) return `+ transports ${nom(l.transports.unite)}`
      const t = l.choix.total
      const total = typeof t === 'number' ? `${t}` : `${t.min} à ${t.max}`
      const parmi = l.choix.parmi.map((p) => `${nom(p.unite)}${p.par_pioche > 1 ? ` ×${p.par_pioche}` : ''}${p.cout ? ` (${p.cout})` : ''}`).join(', ')
      return `${total} au choix parmi ${parmi}`
    })
    .join(', ')
}
