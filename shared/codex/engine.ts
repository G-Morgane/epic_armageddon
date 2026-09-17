import type { Codex, Contrainte, Effet, Formation, Option, Section, Unite, Variante } from './schema'
import type { FormationInstance, Liste, OptionInstance } from './liste'

/**
 * Moteur de règles : résout une liste (unités réelles, coûts) et la valide
 * contre le codex (contraintes, budgets). Utilisé par le builder, les tests
 * et, pour les phrases, par le PDF.
 */

export interface Erreur {
  type: string
  message: string
  /** id d'instance de formation concernée */
  formation?: string
  niveau: 'erreur' | 'avertissement'
}

export interface UniteResolue {
  unite: string
  nom: string
  nombre: number
  origine: 'base' | 'choix' | 'option' | 'transport' | 'remplacement'
  option?: string
  implicite?: boolean
}

export interface OptionResolue {
  instance: OptionInstance
  def: Option
  libelle: string
  cout: number
  compte_quota: boolean
}

export interface FormationResolue {
  instance: FormationInstance
  def: Formation
  variante: Variante
  section: Section
  unites: UniteResolue[]
  options: OptionResolue[]
  sous_formations: FormationResolue[]
  mots_cles: string[]
  cout_base: number
  cout_options: number
  cout_sous_formations: number
  cout: number
  initiative: string
  activation: boolean
  erreurs: Erreur[]
}

export interface EtatBudget {
  id: string
  libelle: string
  unite: 'places' | 'points'
  capacite: number
  utilise: number
}

export interface ResultatListe {
  formations: FormationResolue[]
  total: number
  budgets: EtatBudget[]
  erreurs: Erreur[]
  avertissements: Erreur[]
  valide: boolean
}

// ---------- Index ----------

export interface IndexCodex {
  codex: Codex
  unites: Map<string, Unite>
  options: Map<string, Option>
  formations: Map<string, Formation>
  sections: Map<string, Section>
  sectionDe: Map<string, Section>
}

export function indexerCodex(codex: Codex): IndexCodex {
  const idx: IndexCodex = {
    codex,
    unites: new Map(codex.unites.map((u) => [u.id, u])),
    options: new Map(codex.options.map((o) => [o.id, o])),
    formations: new Map(codex.formations.map((f) => [f.id, f])),
    sections: new Map(codex.sections.map((s) => [s.id, s])),
    sectionDe: new Map(),
  }
  for (const s of codex.sections) for (const f of s.formations) idx.sectionDe.set(f, s)
  return idx
}

export function optionsDisponibles(idx: IndexCodex, formation: Formation): string[] {
  const section = idx.sectionDe.get(formation.id)
  const base = formation.options ?? section?.options ?? []
  const moins = new Set(formation.options_moins)
  return [...new Set([...base, ...formation.options_plus])].filter((o) => !moins.has(o))
}

export function varianteParDefaut(idx: IndexCodex, formationId: string): string {
  return idx.formations.get(formationId)?.variantes[0]?.id ?? 'base'
}

function contraintes(...sources: Array<{ contraintes?: Contrainte[] } | undefined>): Contrainte[] {
  return sources.flatMap((s) => s?.contraintes ?? [])
}

function trouve<T extends Contrainte['type']>(cs: Contrainte[], type: T): Extract<Contrainte, { type: T }> | undefined {
  return cs.find((c) => c.type === type) as Extract<Contrainte, { type: T }> | undefined
}

function tous<T extends Contrainte['type']>(cs: Contrainte[], type: T): Extract<Contrainte, { type: T }>[] {
  return cs.filter((c) => c.type === type) as Extract<Contrainte, { type: T }>[]
}

function plage(total: number | { min: number; max: number | 'besoin_transport' }): { min: number; max: number | 'besoin_transport' } {
  return typeof total === 'number' ? { min: total, max: total } : total
}

function nomUnite(idx: IndexCodex, id: string): string {
  return idx.unites.get(id)?.nom ?? id
}

function ajouterUnite(unites: UniteResolue[], u: UniteResolue) {
  const existante = unites.find((x) => x.unite === u.unite && x.origine === u.origine && x.option === u.option && !!x.implicite === !!u.implicite)
  if (existante) existante.nombre += u.nombre
  else unites.push({ ...u })
}

/** Places nécessaires pour embarquer la formation dans un transport donné, déduction faite des autres transports présents. */
function besoinTransport(idx: IndexCodex, unites: UniteResolue[], transportId: string, perimetre: 'formation' | 'options' = 'formation'): number {
  const transport = idx.unites.get(transportId)
  if (!transport?.transport) return 0
  const accepte = new Set(transport.transport.accepte)
  let places = 0
  let dispo = 0
  for (const u of unites) {
    if (perimetre === 'options' && u.origine !== 'option') continue
    const def = idx.unites.get(u.unite)
    if (!def) continue
    if (u.unite === transportId) continue
    if (def.transport && def.transport.accepte.some((a) => accepte.has(a))) {
      dispo += def.transport.capacite * u.nombre
      continue
    }
    if (accepte.has(u.unite)) places += (def.taille_transport ?? 1) * u.nombre
  }
  return Math.max(0, places - dispo)
}

// ---------- Résolution d'une formation ----------

interface Ctx {
  idx: IndexCodex
  erreurs: Erreur[]
  fi: FormationInstance
}

function erreur(ctx: Ctx, type: string, message: string, niveau: Erreur['niveau'] = 'erreur') {
  ctx.erreurs.push({ type, message, formation: ctx.fi.id, niveau })
}

function appliquerEffetSimple(
  ctx: Ctx,
  effet: Exclude<Effet, { type: 'choix' }>,
  oi: OptionInstance,
  def: Option,
  unites: UniteResolue[],
  mots: string[],
  taille: number,
  phase: 'ajout' | 'remplacement',
): { cout: number; libelle: string } {
  const { idx } = ctx
  const mult = 'par_taille' in effet && effet.par_taille ? taille : 1

  if (effet.type === 'ajouter') {
    if (phase !== 'ajout') return { cout: 0, libelle: def.nom }
    if (effet.variantes?.length) {
      const v = effet.variantes.find((x) => (x.id ?? x.nom) === oi.variante) ?? effet.variantes[0]!
      for (const u of v.unites) ajouterUnite(unites, { unite: u.unite, nom: nomUnite(idx, u.unite), nombre: u.nombre, origine: 'option', option: oi.id })
      return { cout: v.cout, libelle: `${def.nom} : ${v.nom}` }
    }
    if (effet.cout_par_unite !== undefined) {
      const q = oi.quantite ?? effet.min ?? 1
      const min = effet.min ?? 1
      if (q < min) erreur(ctx, 'option_quantite', `${def.nom} : minimum ${min}`)
      if (typeof effet.max === 'number' && q > effet.max * mult) erreur(ctx, 'option_quantite', `${def.nom} : maximum ${effet.max * mult}`)
      for (const u of effet.unites) ajouterUnite(unites, { unite: u.unite, nom: nomUnite(idx, u.unite), nombre: u.nombre * q, origine: 'option', option: oi.id })
      if (effet.max === 'besoin_transport') {
        // vérifié après ajout : on ne doit pas dépasser ce qu'il faut pour embarquer le reste
        const transportId = effet.unites[0]?.unite
        if (transportId) {
          const sans = unites.filter((u) => !(u.option === oi.id))
          const besoin = besoinTransport(idx, sans, transportId, effet.perimetre_transport)
          const cap = idx.unites.get(transportId)?.transport?.capacite ?? 1
          const maxi = Math.ceil(besoin / cap)
          if (q > maxi) erreur(ctx, 'option_quantite', `${def.nom} : ${maxi} suffisent pour embarquer la formation`)
        }
      }
      return { cout: effet.cout_par_unite * q, libelle: `${def.nom} ×${q}` }
    }
    for (const u of effet.unites) ajouterUnite(unites, { unite: u.unite, nom: nomUnite(idx, u.unite), nombre: u.nombre, origine: 'option', option: oi.id })
    return { cout: effet.cout ?? 0, libelle: def.nom }
  }

  if (effet.type === 'mot_cle') {
    if (phase !== 'ajout') return { cout: 0, libelle: def.nom }
    mots.push(effet.texte)
    return { cout: effet.cout, libelle: def.nom }
  }

  if (effet.type === 'choix_multiple') {
    if (phase !== 'ajout') return { cout: 0, libelle: def.nom }
    const rep = oi.repartition ?? {}
    const { min, max } = plage(effet.total)
    let total = 0
    let cout = 0
    for (const [uid, q] of Object.entries(rep)) {
      const opt = effet.parmi.find((p) => p.unite === uid)
      if (!opt) { erreur(ctx, 'option_interdite', `${def.nom} : ${nomUnite(idx, uid)} n'est pas proposé`); continue }
      if (opt.max !== undefined && q > opt.max * mult) erreur(ctx, 'option_quantite', `${def.nom} : maximum ${opt.max * mult} ${nomUnite(idx, uid)}`)
      total += q
      cout += q * opt.cout
      if (q > 0) ajouterUnite(unites, { unite: uid, nom: nomUnite(idx, uid), nombre: q, origine: 'option', option: oi.id })
    }
    if (total < min) erreur(ctx, 'option_quantite', `${def.nom} : au moins ${min}`)
    if (typeof max === 'number' && total > max * mult) erreur(ctx, 'option_quantite', `${def.nom} : au plus ${max * mult}`)
    if (max === 'besoin_transport') {
      const sans = unites.filter((u) => u.option !== oi.id)
      const premiere = effet.parmi[0]?.unite
      if (premiere) {
        const cap = idx.unites.get(premiere)?.transport?.capacite ?? 1
        const maxi = Math.ceil(besoinTransport(idx, sans, premiere, effet.perimetre_transport) / cap)
        if (total > maxi) erreur(ctx, 'option_quantite', `${def.nom} : ${maxi} suffisent pour embarquer la formation`)
      }
    }
    return { cout, libelle: `${def.nom} ×${total}` }
  }

  // remplacer
  if (phase !== 'remplacement') return { cout: 0, libelle: def.nom }
  const de = new Set(Array.isArray(effet.de) ? effet.de : [effet.de])
  const candidats = unites.filter((u) => de.has(u.unite) && !u.implicite)
  const disponible = candidats.reduce((s, u) => s + u.nombre, 0)
  let aRemplacer: number
  let lots: number
  if (effet.tout || effet.max === 'tout') {
    aRemplacer = disponible
    lots = 1
  } else {
    lots = oi.quantite ?? 1
    if (lots > effet.max * mult) erreur(ctx, 'option_quantite', `${def.nom} : au plus ${effet.max * mult} lot(s)`)
    aRemplacer = lots * effet.lot
  }
  if (aRemplacer > disponible) {
    erreur(ctx, 'option_quantite', `${def.nom} : seulement ${disponible} unité(s) remplaçable(s)`)
    aRemplacer = disponible
  }
  if (aRemplacer === 0 && disponible === 0) erreur(ctx, 'option_interdite', `${def.nom} : aucune unité à remplacer`)
  let reste = aRemplacer
  for (const u of candidats) {
    if (reste <= 0) break
    const n = Math.min(u.nombre, reste)
    u.nombre -= n
    reste -= n
  }
  for (let i = unites.length - 1; i >= 0; i--) if (unites[i]!.nombre <= 0) unites.splice(i, 1)
  const obtenu = effet.tout || effet.max === 'tout' ? (effet.par_nombre ?? aRemplacer) : aRemplacer
  if (obtenu > 0) ajouterUnite(unites, { unite: effet.par, nom: nomUnite(idx, effet.par), nombre: obtenu, origine: 'remplacement', option: oi.id })
  return { cout: effet.cout * lots, libelle: lots > 1 ? `${def.nom} ×${lots}` : def.nom }
}

function estRemplacement(def: Option, oi: OptionInstance): boolean {
  if (def.effet.type === 'remplacer') return true
  if (def.effet.type === 'choix') {
    const c = def.effet.parmi.find((p) => p.id === oi.choix) ?? def.effet.parmi[0]
    return c?.effet?.type === 'remplacer'
  }
  return false
}

export function resoudreFormation(idx: IndexCodex, fi: FormationInstance, profondeur = 0): FormationResolue {
  const erreurs: Erreur[] = []
  const ctx: Ctx = { idx, erreurs, fi }
  const def = idx.formations.get(fi.formation)
  const section = def ? idx.sectionDe.get(def.id) : undefined
  if (!def || !section) {
    return {
      instance: fi, def: def ?? ({ id: fi.formation, nom: fi.formation, variantes: [], options_plus: [], options_moins: [], contraintes: [] } as unknown as Formation),
      variante: { id: fi.variante, cout: 0, composition: [], taille: 1, contraintes: [] }, section: section ?? ({ id: '?', titre: '?', formations: [], contraintes: [], options: [], notes: {} } as Section),
      unites: [], options: [], sous_formations: [], mots_cles: [], cout_base: 0, cout_options: 0, cout_sous_formations: 0, cout: 0, initiative: '', activation: true,
      erreurs: [{ type: 'formation_inconnue', message: `Formation inconnue : ${fi.formation}`, formation: fi.id, niveau: 'erreur' }],
    }
  }
  const variante = def.variantes.find((v) => v.id === fi.variante) ?? def.variantes[0]!
  const cs = contraintes(section, def, variante)
  const unites: UniteResolue[] = []
  const mots: string[] = []
  let cout_base = variante.cout

  // 1. composition
  variante.composition.forEach((ligne, i) => {
    if ('unite' in ligne) {
      ajouterUnite(unites, { unite: ligne.unite, nom: nomUnite(idx, ligne.unite), nombre: ligne.nombre, origine: 'base', implicite: ligne.implicite })
    } else if ('choix' in ligne) {
      const rep = fi.choix[String(i)] ?? {}
      const { min, max } = plage(ligne.choix.total)
      let total = 0
      for (const [uid, q] of Object.entries(rep)) {
        const opt = ligne.choix.parmi.find((p) => p.unite === uid)
        if (!opt) { erreur(ctx, 'composition', `${def.nom} : ${nomUnite(idx, uid)} n'est pas proposé dans la composition`); continue }
        total += q
        cout_base += q * opt.cout
        if (q > 0) ajouterUnite(unites, { unite: uid, nom: nomUnite(idx, uid), nombre: q * opt.par_pioche, origine: 'choix' })
      }
      if (total < min || (typeof max === 'number' && total > max)) {
        const attendu = min === max ? `${min}` : `entre ${min} et ${max}`
        erreur(ctx, 'composition', `${def.nom} : choisir ${attendu} unité(s) (${total} choisie(s))`)
      }
    }
  })

  // 2. options (ajouts), 3. transports, 4. remplacements
  const dispo = new Set(optionsDisponibles(idx, def))
  const options: OptionResolue[] = []
  let cout_options = 0
  const traiter = (phase: 'ajout' | 'remplacement') => {
    for (const oi of fi.options) {
      const odef = idx.options.get(oi.option)
      if (!odef) { if (phase === 'ajout') erreur(ctx, 'option_inconnue', `Option inconnue : ${oi.option}`); continue }
      if (estRemplacement(odef, oi) !== (phase === 'remplacement')) continue
      if (!dispo.has(oi.option)) { erreur(ctx, 'option_interdite', `${odef.nom} n'est pas autorisée pour ${def.nom}`); continue }
      let cout = 0
      let libelle = odef.nom
      let csOption = odef.contraintes
      if (odef.effet.type === 'choix') {
        const c = odef.effet.parmi.find((p) => p.id === oi.choix) ?? odef.effet.parmi[0]!
        libelle = `${odef.nom} : ${c.nom}`
        cout += c.cout
        csOption = [...csOption, ...c.contraintes]
        if (c.effet) {
          const r = appliquerEffetSimple(ctx, c.effet, oi, odef, unites, mots, variante.taille, phase)
          cout += r.cout
        }
      } else {
        const r = appliquerEffetSimple(ctx, odef.effet, oi, odef, unites, mots, variante.taille, phase)
        cout = r.cout
        libelle = r.libelle
      }
      const compte_quota = !trouve(csOption, 'hors_quota_options')
      options.push({ instance: oi, def: odef, libelle, cout, compte_quota })
      cout_options += cout
    }
  }
  traiter('ajout')
  for (const ligne of variante.composition) {
    if ('transports' in ligne) {
      const t = ligne.transports.unite
      const cap = idx.unites.get(t)?.transport?.capacite ?? 1
      const n = Math.ceil(besoinTransport(idx, unites, t) / cap)
      if (n > 0) ajouterUnite(unites, { unite: t, nom: nomUnite(idx, t), nombre: n, origine: 'transport' })
    }
  }
  traiter('remplacement')

  // 5. contraintes d'options
  const compteOption = (id: string) => fi.options.filter((o) => o.option === id).length
  for (const o of options) {
    const csO = o.def.effet.type === 'choix'
      ? [...o.def.contraintes, ...(o.def.effet.parmi.find((p) => p.id === o.instance.choix) ?? o.def.effet.parmi[0]!).contraintes]
      : o.def.contraintes
    const maxF = trouve(csO, 'max_par_formation')
    if (maxF) {
      const limite = maxF.valeur * (maxF.par_taille ? variante.taille : 1)
      if (compteOption(o.def.id) > limite) erreur(ctx, 'option_quantite', `${o.def.nom} : au plus ${limite} fois par formation`)
    }
    const excl = trouve(csO, 'exclusif')
    if (excl) {
      const autres = options.filter((x) => x !== o && trouve(x.def.contraintes, 'exclusif')?.groupe === excl.groupe)
      if (autres.length) erreur(ctx, 'option_interdite', `${o.def.nom} et ${autres[0]!.def.nom} sont incompatibles`)
    }
    for (const ex of tous(csO, 'exclut')) {
      const conflit = options.find((x) => ex.options.includes(x.def.id))
      if (conflit) erreur(ctx, 'option_interdite', `${o.def.nom} est incompatible avec ${conflit.def.nom}`)
    }
    const req = trouve(csO, 'requiert_unite')
    if (req && !unites.some((u) => req.unites.includes(u.unite) && u.option !== o.instance.id)) {
      erreur(ctx, 'option_interdite', `${o.def.nom} nécessite ${req.unites.map((u) => nomUnite(idx, u)).join(' ou ')} dans la formation`)
    }
    const taille = trouve(csO, 'taille_max_formation')
    if (taille) {
      const n = unites.filter((u) => !u.implicite && u.origine !== 'transport').reduce((s, u) => s + u.nombre, 0)
      if (n > taille.valeur) erreur(ctx, 'option_interdite', `${o.def.nom} : formation de ${taille.valeur} unités maximum (${n})`)
    }
  }
  const maxOptions = trouve(contraintes(def, variante), 'max_options') ?? trouve(section.contraintes, 'max_options')
  if (maxOptions) {
    const n = options.filter((o) => o.compte_quota).length
    if (n > maxOptions.valeur) erreur(ctx, 'max_options', `${def.nom} : au plus ${maxOptions.valeur} améliorations (${n})`)
  }
  for (const o of idx.codex.options) {
    if (trouve(o.contraintes, 'obligatoire') && dispo.has(o.id) && !fi.options.some((x) => x.option === o.id)) {
      erreur(ctx, 'option_obligatoire', `${o.nom} est obligatoire dans ${def.nom}`)
    }
  }

  // 6. sous-formations
  const sous: FormationResolue[] = []
  let cout_sous = 0
  const specSous = variante.sous_formations ?? def.sous_formations
  if (specSous) {
    const { min, max } = plage(specSous.total)
    const n = fi.sous_formations.length
    if (n < min || (typeof max === 'number' && n > max)) {
      erreur(ctx, 'sous_formations', `${def.nom} : ${min === max ? min : `${min} à ${max}`} ${specSous.label} attendu(s) (${n})`)
    }
    for (const sfi of fi.sous_formations) {
      if (!specSous.parmi.includes(sfi.formation)) erreur(ctx, 'sous_formations', `${def.nom} : ${idx.formations.get(sfi.formation)?.nom ?? sfi.formation} n'est pas un ${specSous.label} autorisé`)
      const r = resoudreFormation(idx, sfi, profondeur + 1)
      sous.push(r)
      cout_sous += r.cout
      erreurs.push(...r.erreurs)
    }
  } else if (fi.sous_formations.length) {
    erreur(ctx, 'sous_formations', `${def.nom} n'accepte pas de sous-formations`)
  }
  if (profondeur === 0 && trouve(cs, 'non_autonome')) erreur(ctx, 'non_autonome', `${def.nom} ne peut être pris qu'au sein d'une autre formation`)

  const initiative = trouve(contraintes(def, variante), 'initiative')?.valeur ?? trouve(section.contraintes, 'initiative')?.valeur ?? idx.codex.codex.initiative.defaut

  return {
    instance: fi, def, variante, section, unites, options, sous_formations: sous, mots_cles: mots,
    cout_base, cout_options, cout_sous_formations: cout_sous, cout: cout_base + cout_options + cout_sous,
    initiative, activation: !trouve(cs, 'pas_une_activation'), erreurs,
  }
}

/**
 * Bornes de quantité d'une option dans une formation résolue (pour l'UI : min/max des champs).
 * `max` vaut null quand il n'y a pas de limite.
 */
export function bornesOption(idx: IndexCodex, f: FormationResolue, oi: OptionInstance): { min: number; max: number | null } {
  const def = idx.options.get(oi.option)
  if (!def) return { min: 1, max: null }
  const effet = def.effet.type === 'choix' ? (def.effet.parmi.find((p) => p.id === oi.choix) ?? def.effet.parmi[0])?.effet : def.effet
  if (!effet) return { min: 1, max: null }
  const mult = 'par_taille' in effet && effet.par_taille ? f.variante.taille : 1
  if (effet.type === 'ajouter' && effet.cout_par_unite !== undefined) {
    const min = effet.min ?? 1
    if (effet.max === 'besoin_transport') {
      const t = effet.unites[0]?.unite
      if (!t) return { min, max: null }
      const sans = f.unites.filter((u) => u.option !== oi.id)
      const cap = idx.unites.get(t)?.transport?.capacite ?? 1
      return { min, max: Math.max(min, Math.ceil(besoinTransport(idx, sans, t, effet.perimetre_transport) / cap)) }
    }
    return { min, max: typeof effet.max === 'number' ? effet.max * mult : null }
  }
  if (effet.type === 'remplacer' && !effet.tout && effet.max !== 'tout') {
    const de = new Set(Array.isArray(effet.de) ? effet.de : [effet.de])
    // unités remplaçables : celles présentes hors ce remplacement, plus celles qu'il a déjà remplacées
    const encore = f.unites.filter((u) => de.has(u.unite) && !u.implicite).reduce((s, u) => s + u.nombre, 0)
    const deja = f.unites.filter((u) => u.option === oi.id && u.origine === 'remplacement').reduce((s, u) => s + u.nombre, 0)
    const lotsDispo = Math.floor((encore + deja) / effet.lot)
    return { min: 1, max: Math.max(1, Math.min(effet.max * mult, lotsDispo)) }
  }
  return { min: 1, max: null }
}

/** Plafond par unité d'un `choix_multiple` (ou null). */
export function plafondRepartition(idx: IndexCodex, f: FormationResolue, oi: OptionInstance, unite: string): number | null {
  const def = idx.options.get(oi.option)
  const effet = def?.effet.type === 'choix' ? (def.effet.parmi.find((p) => p.id === oi.choix) ?? def.effet.parmi[0])?.effet : def?.effet
  if (!effet || effet.type !== 'choix_multiple') return null
  const mult = effet.par_taille ? f.variante.taille : 1
  const p = effet.parmi.find((x) => x.unite === unite)
  const total = plage(effet.total)
  const autres = Object.entries(oi.repartition ?? {}).filter(([u]) => u !== unite).reduce((s, [, q]) => s + q, 0)
  const restant = typeof total.max === 'number' ? Math.max(0, total.max * mult - autres) : null
  const propre = p?.max !== undefined ? p.max * mult : null
  if (restant === null && propre === null) return null
  return Math.min(restant ?? Infinity, propre ?? Infinity)
}

// ---------- Budgets ----------

interface Consommateur { id: string; budgets: string[]; label: string }

function assigner(consommateurs: Consommateur[], capacite: Map<string, number>): Map<string, string> | null {
  const tries = [...consommateurs].sort((a, b) => a.budgets.length - b.budgets.length)
  const util = new Map<string, number>()
  const res = new Map<string, string>()
  const bt = (i: number): boolean => {
    if (i === tries.length) return true
    const c = tries[i]!
    for (const b of c.budgets) {
      if ((util.get(b) ?? 0) < (capacite.get(b) ?? 0)) {
        util.set(b, (util.get(b) ?? 0) + 1)
        res.set(c.id, b)
        if (bt(i + 1)) return true
        util.set(b, util.get(b)! - 1)
        res.delete(c.id)
      }
    }
    return false
  }
  return bt(0) ? res : null
}

// ---------- Liste ----------

export function calculerListe(idx: IndexCodex, liste: Liste): ResultatListe {
  const formations = liste.formations.map((fi) => resoudreFormation(idx, fi))
  const erreurs: Erreur[] = formations.flatMap((f) => f.erreurs)
  const total = formations.reduce((s, f) => s + f.cout, 0)
  const toutes: FormationResolue[] = []
  const collecter = (f: FormationResolue) => { toutes.push(f); f.sous_formations.forEach(collecter) }
  formations.forEach(collecter)

  // max / min par armée (formations)
  const parFormation = new Map<string, number>()
  for (const f of toutes) parFormation.set(f.def.id, (parFormation.get(f.def.id) ?? 0) + 1)
  for (const def of idx.codex.formations) {
    const cs = contraintes(idx.sectionDe.get(def.id), def)
    const n = parFormation.get(def.id) ?? 0
    const maxA = trouve(cs, 'max_par_armee')
    if (maxA && n > maxA.valeur) erreurs.push({ type: 'max_par_armee', message: `${def.nom} : au plus ${maxA.valeur} par armée (${n})`, niveau: 'erreur' })
    const minA = trouve(cs, 'min_par_armee')
    if (minA && n < minA.valeur) erreurs.push({ type: 'min_par_armee', message: `${def.nom} : au moins ${minA.valeur} par armée`, niveau: 'erreur' })
  }
  for (const s of idx.codex.sections) {
    const minS = trouve(s.contraintes, 'min_par_armee')
    if (minS) {
      const n = toutes.filter((f) => f.section.id === s.id).length
      if (n < minS.valeur) erreurs.push({ type: 'min_par_armee', message: `Au moins ${minS.valeur} formation(s) de « ${s.titre} »`, niveau: 'erreur' })
    }
  }

  // max / min par armée (options et choix)
  const compteOptions = new Map<string, number>()
  for (const f of toutes) for (const o of f.options) {
    compteOptions.set(o.def.id, (compteOptions.get(o.def.id) ?? 0) + 1)
    if (o.def.effet.type === 'choix') {
      const c = o.def.effet.parmi.find((p) => p.id === o.instance.choix) ?? o.def.effet.parmi[0]!
      compteOptions.set(`${o.def.id}/${c.id}`, (compteOptions.get(`${o.def.id}/${c.id}`) ?? 0) + 1)
    }
  }
  for (const o of idx.codex.options) {
    const n = compteOptions.get(o.id) ?? 0
    const maxA = trouve(o.contraintes, 'max_par_armee')
    if (maxA && n > maxA.valeur) erreurs.push({ type: 'max_par_armee', message: `${o.nom} : au plus ${maxA.valeur} par armée (${n})`, niveau: 'erreur' })
    const minA = trouve(o.contraintes, 'min_par_armee')
    if (minA && n < minA.valeur && formations.length > 0) erreurs.push({ type: 'min_par_armee', message: `${o.nom} : obligatoire dans l'armée`, niveau: 'erreur' })
    if (o.effet.type === 'choix') for (const c of o.effet.parmi) {
      const nc = compteOptions.get(`${o.id}/${c.id}`) ?? 0
      const maxC = trouve(c.contraintes, 'max_par_armee')
      if (maxC && nc > maxC.valeur) erreurs.push({ type: 'max_par_armee', message: `${c.nom} : au plus ${maxC.valeur} par armée (${nc})`, niveau: 'erreur' })
    }
  }

  // budgets
  const budgets: EtatBudget[] = []
  const capacite = new Map<string, number>()
  const pointsSection = new Map<string, number>()
  for (const f of toutes) pointsSection.set(f.section.id, (pointsSection.get(f.section.id) ?? 0) + f.cout)
  for (const b of idx.codex.budgets) {
    let cap = 0
    const c = b.capacite
    if (c.source === 'fixe') cap = c.valeur
    else if (c.source === 'ratio_points') cap = Math.floor((c.base === 'points_liste' ? total : liste.limite) * c.ratio)
    else if (c.source === 'par_tranche') {
      const base = c.perimetre?.startsWith('section:') ? (pointsSection.get(c.perimetre.slice(8)) ?? 0) : total
      cap = Math.ceil(base / c.points)
    } else {
      for (const f of toutes) for (const k of tous(contraintes(f.section, f.def, f.variante), 'fournit')) if (k.budget === b.id) cap += k.quantite
    }
    capacite.set(b.id, cap)
  }
  const points = new Map<string, number>()
  const consommateurs: Consommateur[] = []
  for (const f of toutes) {
    const cs = contraintes(f.section, f.def, f.variante)
    const coutRare = trouve(cs, 'cout_rare')?.valeur
    for (const k of tous(cs, 'consomme')) {
      const bs = Array.isArray(k.budget) ? k.budget : [k.budget]
      if (k.quoi === 'points') for (const b of bs) points.set(b, (points.get(b) ?? 0) + (coutRare ?? f.cout))
      else consommateurs.push({ id: f.instance.id, budgets: bs, label: f.def.nom })
    }
    for (const o of f.options) {
      const csO = o.def.effet.type === 'choix'
        ? [...o.def.contraintes, ...(o.def.effet.parmi.find((p) => p.id === o.instance.choix) ?? o.def.effet.parmi[0]!).contraintes]
        : o.def.contraintes
      for (const k of tous(csO, 'consomme')) {
        const bs = Array.isArray(k.budget) ? k.budget : [k.budget]
        if (k.quoi === 'points') for (const b of bs) points.set(b, (points.get(b) ?? 0) + o.cout)
        else consommateurs.push({ id: o.instance.id, budgets: bs, label: `${o.def.nom} (${f.def.nom})` })
      }
    }
  }
  const assignation = assigner(consommateurs, capacite)
  const utilisePlaces = new Map<string, number>()
  if (assignation) for (const b of assignation.values()) utilisePlaces.set(b, (utilisePlaces.get(b) ?? 0) + 1)
  else {
    // pas d'assignation possible : compter au plus juste pour l'affichage et signaler
    for (const c of consommateurs) utilisePlaces.set(c.budgets[0]!, (utilisePlaces.get(c.budgets[0]!) ?? 0) + 1)
  }
  for (const b of idx.codex.budgets) {
    const enPoints = points.has(b.id) && !consommateurs.some((c) => c.budgets.includes(b.id))
    const utilise = enPoints ? points.get(b.id)! : (utilisePlaces.get(b.id) ?? 0)
    const cap = capacite.get(b.id) ?? 0
    budgets.push({ id: b.id, libelle: b.libelle, unite: enPoints ? 'points' : 'places', capacite: cap, utilise })
    if (enPoints && utilise > cap) erreurs.push({ type: 'budget_depasse', message: `${b.libelle} : ${utilise} pts sur ${cap} autorisés`, niveau: 'erreur' })
  }
  if (!assignation) {
    // nommer les budgets saturés : demande des consommateurs à budget unique contre capacité
    const concernes = [...new Set(consommateurs.flatMap((c) => c.budgets))]
    const satures = concernes.filter((b) => consommateurs.filter((c) => c.budgets.length === 1 && c.budgets[0] === b).length > (capacite.get(b) ?? 0))
    const cibles = satures.length ? satures : concernes
    for (const b of cibles) {
      const def = idx.codex.budgets.find((x) => x.id === b)
      const demande = consommateurs.filter((c) => c.budgets.includes(b)).length
      erreurs.push({ type: 'budget_depasse', message: `${def?.libelle ?? b} : ${demande} pour ${capacite.get(b) ?? 0} place(s)`, niveau: 'erreur' })
    }
  }

  if (total > liste.limite) erreurs.push({ type: 'limite_points', message: `${total} pts pour une limite de ${liste.limite}`, niveau: 'erreur' })

  return {
    formations,
    total,
    budgets,
    erreurs: erreurs.filter((e) => e.niveau === 'erreur'),
    avertissements: erreurs.filter((e) => e.niveau === 'avertissement'),
    valide: !erreurs.some((e) => e.niveau === 'erreur'),
  }
}
