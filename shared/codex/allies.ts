import type { Codex, Contrainte, Formation, Option, Section, Unite } from './schema'

/**
 * Alliances : fusionne dans un codex hôte les formations d'autres codex (soutiens partagés).
 * Le résultat est un codex ordinaire : le moteur, le PDF et le builder n'ont rien à savoir.
 *
 * Règles de fusion :
 *  - unités, options et formations de l'allié sont copiées ; en cas de collision d'identifiant avec l'hôte,
 *    l'identifiant importé est préfixé `slug__` et toutes ses références sont réécrites ;
 *  - les budgets de l'allié ne sont pas importés : les règles « fournit / compte dans » de ses formations
 *    sont retirées, ce sont celles de la section hôte qui s'appliquent ;
 *  - les formations importées sont ajoutées à la fin de la section hôte.
 */
export function fusionnerAllies(hote: Codex, allies: Record<string, Codex>): Codex {
  if (!hote.sections.some((s) => s.allies)) return hote
  const out: Codex = JSON.parse(JSON.stringify(hote))
  const idsU = new Set(out.unites.map((u) => u.id))
  const idsO = new Set(out.options.map((o) => o.id))
  const idsF = new Set(out.formations.map((f) => f.id))
  const dejaImportes = new Set<string>()

  for (const section of out.sections) {
    if (!section.allies) continue
    const allie = allies[section.allies.codex]
    if (!allie) continue
    const prefixe = `${section.allies.codex.replace(/-/g, '_')}__`
    const cle = `${section.allies.codex}|${(section.allies.sections ?? []).join(',')}`
    const sectionsSource = allie.sections.filter((s) => !section.allies!.sections || section.allies!.sections.includes(s.id))
    const formationsSource = new Set(sectionsSource.flatMap((s) => s.formations))

    // identifiants à importer et leur nom final
    const mapU = new Map<string, string>()
    const mapO = new Map<string, string>()
    const mapF = new Map<string, string>()
    const nomme = (id: string, pris: Set<string>, deja: boolean) => (pris.has(id) && !deja ? `${prefixe}${id}` : id)

    const formations = allie.formations.filter((f) => formationsSource.has(f.id))
    const unitesUtiles = new Set<string>()
    const optionsUtiles = new Set<string>()
    for (const f of formations) {
      for (const v of f.variantes) for (const l of v.composition) {
        if ('unite' in l) unitesUtiles.add(l.unite)
        else if ('choix' in l) l.choix.parmi.forEach((p) => unitesUtiles.add(p.unite))
        else unitesUtiles.add(l.transports.unite)
      }
      const sectionAllie = sectionsSource.find((s) => s.formations.includes(f.id))
      for (const o of [...(f.options ?? sectionAllie?.options ?? []), ...f.options_plus]) optionsUtiles.add(o)
    }
    for (const oid of optionsUtiles) {
      const o = allie.options.find((x) => x.id === oid)
      if (!o) continue
      collecterUnitesOption(o, unitesUtiles)
    }
    // unités acceptées par les transports importés
    for (const uid of [...unitesUtiles]) allie.unites.find((u) => u.id === uid)?.transport?.accepte.forEach((a) => unitesUtiles.add(a))

    const dejaCodex = dejaImportes.has(section.allies.codex)
    for (const uid of unitesUtiles) mapU.set(uid, nomme(uid, idsU, dejaCodex && idsU.has(`${prefixe}${uid}`) === false && importeParNous(out.unites, uid)))
    for (const oid of optionsUtiles) mapO.set(oid, nomme(oid, idsO, false))
    for (const f of formations) mapF.set(f.id, nomme(f.id, idsF, false))

    const ru = (id: string) => mapU.get(id) ?? id
    const ro = (id: string) => mapO.get(id) ?? id
    const rf = (id: string) => mapF.get(id) ?? id
    const sansBudgets = (cs: Contrainte[]) => cs.filter((c) => c.type !== 'fournit' && c.type !== 'consomme')
    const reecrireContraintes = (cs: Contrainte[]): Contrainte[] =>
      sansBudgets(cs).map((c) => {
        if (c.type === 'requiert_unite') return { ...c, unites: c.unites.map(ru) }
        if (c.type === 'exclut') return { ...c, options: c.options.map(ro) }
        return c
      })

    for (const uid of unitesUtiles) {
      const u = allie.unites.find((x) => x.id === uid)
      if (!u || out.unites.some((x) => x.id === ru(uid))) continue
      const copie: Unite = JSON.parse(JSON.stringify(u))
      copie.id = ru(uid)
      if (copie.transport) copie.transport.accepte = copie.transport.accepte.map(ru)
      out.unites.push(copie)
      idsU.add(copie.id)
    }
    for (const oid of optionsUtiles) {
      const o = allie.options.find((x) => x.id === oid)
      if (!o || out.options.some((x) => x.id === ro(oid))) continue
      const copie: Option = JSON.parse(JSON.stringify(o))
      copie.id = ro(oid)
      copie.contraintes = reecrireContraintes(copie.contraintes)
      reecrireEffet(copie, ru)
      out.options.push(copie)
      idsO.add(copie.id)
    }
    for (const f of formations) {
      if (out.formations.some((x) => x.id === rf(f.id))) { if (!section.formations.includes(rf(f.id))) section.formations.push(rf(f.id)); continue }
      const copie: Formation = JSON.parse(JSON.stringify(f))
      copie.id = rf(f.id)
      copie.contraintes = reecrireContraintes(copie.contraintes)
      const sectionAllie = sectionsSource.find((s) => s.formations.includes(f.id))
      // options : celles de la formation, sinon celles de sa section d'origine (la section hôte a les siennes)
      copie.options = (f.options ?? sectionAllie?.options ?? []).map(ro)
      copie.options_plus = copie.options_plus.map(ro)
      copie.options_moins = copie.options_moins.map(ro)
      for (const v of copie.variantes) {
        v.contraintes = reecrireContraintes(v.contraintes)
        v.composition = v.composition.map((l) => {
          if ('unite' in l) return { ...l, unite: ru(l.unite) }
          if ('choix' in l) return { choix: { ...l.choix, parmi: l.choix.parmi.map((p) => ({ ...p, unite: ru(p.unite) })) } }
          return { transports: { unite: ru(l.transports.unite) } }
        })
        if (v.sous_formations) v.sous_formations.parmi = v.sous_formations.parmi.map(rf)
      }
      if (copie.sous_formations) copie.sous_formations.parmi = copie.sous_formations.parmi.map(rf)
      // initiative de la section d'origine conservée si la formation n'en a pas
      const init = sectionAllie?.contraintes.find((c) => c.type === 'initiative')
      if (init && !copie.contraintes.some((c) => c.type === 'initiative') && !section.contraintes.some((c) => c.type === 'initiative')) copie.contraintes.push(init)
      out.formations.push(copie)
      idsF.add(copie.id)
      section.formations.push(copie.id)
    }
    dejaImportes.add(cle)
  }
  return out
}

function importeParNous(_unites: Unite[], _id: string): boolean { return false }

function collecterUnitesOption(o: Option, set: Set<string>) {
  const e = o.effet
  const simple = (x: Exclude<typeof e, { type: 'choix' }>) => {
    if (x.type === 'ajouter') { x.unites.forEach((u) => set.add(u.unite)); x.variantes?.forEach((v) => v.unites.forEach((u) => set.add(u.unite))) }
    else if (x.type === 'remplacer') { (Array.isArray(x.de) ? x.de : [x.de]).forEach((d) => set.add(d)); set.add(x.par) }
    else if (x.type === 'choix_multiple') x.parmi.forEach((p) => set.add(p.unite))
    else if (x.type === 'mot_cle') x.cible?.forEach((c) => set.add(c))
  }
  if (e.type === 'choix') e.parmi.forEach((p) => { if (p.effet) simple(p.effet) })
  else simple(e)
}

function reecrireEffet(o: Option, ru: (id: string) => string) {
  const e = o.effet
  const simple = (x: Exclude<typeof e, { type: 'choix' }>) => {
    if (x.type === 'ajouter') { x.unites.forEach((u) => (u.unite = ru(u.unite))); x.variantes?.forEach((v) => v.unites.forEach((u) => (u.unite = ru(u.unite)))) }
    else if (x.type === 'remplacer') { x.de = Array.isArray(x.de) ? x.de.map(ru) : ru(x.de); x.par = ru(x.par) }
    else if (x.type === 'choix_multiple') x.parmi.forEach((p) => (p.unite = ru(p.unite)))
    else if (x.type === 'mot_cle' && x.cible) x.cible = x.cible.map(ru)
  }
  if (e.type === 'choix') e.parmi.forEach((p) => { if (p.effet) simple(p.effet) })
  else simple(e)
}

/** Slugs des codex alliés référencés par un codex. */
export function alliesReferences(codex: Pick<Codex, 'sections'>): string[] {
  return [...new Set(codex.sections.map((s) => s.allies?.codex).filter((x): x is string => !!x))]
}
