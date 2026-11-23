import type { Arme, Codex, Contrainte, Effet, Formation, ListeTest, Option, Section, Unite, Variante } from './schema'
import type { FormationInstance, Liste, OptionInstance } from './liste'
import { allegeancesDe, normaliserFormation } from './liste'

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
  /** transports choisis en partie (« + transports parmi ») : profils à montrer, aucune unité dans la liste */
  profils_possibles: string[]
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

/**
 * Armes possibles derrière une ligne générique d'arme (« 2x Armes de Bras ») :
 * les choix de l'option d'armement du codex, filtrés par emplacement.
 */
export function armesPossibles(idx: IndexCodex, arme: Arme): { nom: string; cout: number; categorie?: string; portee?: string; puissance?: string }[] {
  const ref = arme.armement
  if (!ref) return []
  const effet = idx.options.get(ref.option)?.effet
  if (effet?.type !== 'choix') return []
  return effet.parmi
    .filter((p) => !ref.emplacement || !p.emplacement || p.emplacement === ref.emplacement)
    .map((p) => ({ nom: p.nom, cout: p.cout, categorie: p.categorie, portee: p.portee, puissance: p.puissance }))
}

export function optionsDisponibles(idx: IndexCodex, formation: Formation): string[] {
  const section = idx.sectionDe.get(formation.id)
  const base = formation.options ?? section?.options ?? []
  const moins = new Set(formation.options_moins)
  return [...new Set([...base, ...formation.options_plus])].filter((o) => !moins.has(o))
}

/** Options à ajouter d'office quand on crée une formation (règle « obligatoire »). */
export function optionsObligatoires(idx: IndexCodex, formationId: string): string[] {
  const def = idx.formations.get(formationId)
  if (!def) return []
  return optionsDisponibles(idx, def).filter((id) => { const o = idx.options.get(id); return !o?.masque_builder && o?.contraintes.some((c) => c.type === 'obligatoire') })
}

/** Nombre d'instances d'une option d'armement dont l'arme choisie porte cet emplacement. */
function compteEmplacement(idx: IndexCodex, fi: FormationInstance, optionId: string, emplacement: 'bras' | 'carapace', sauf?: string): number {
  const def = idx.options.get(optionId)
  if (!def || def.effet.type !== 'choix') return 0
  const parmi = def.effet.parmi
  return fi.options.filter((x) => x.option === optionId && x.id !== sauf && (parmi.find((p) => p.id === x.choix) ?? parmi[0])?.emplacement === emplacement).length
}

/**
 * Emplacements d'armes déjà pleins pour une instance d'option d'armement (les autres instances comptent, pas elle).
 * Sert à l'UI pour masquer les armes qui ne rentrent plus.
 */
export function emplacementsSatures(idx: IndexCodex, fi: FormationInstance, oi: OptionInstance): Array<'bras' | 'carapace'> {
  const def = idx.options.get(oi.option)
  if (!def) return []
  return tous(def.contraintes, 'max_par_emplacement')
    .filter((me) => compteEmplacement(idx, fi, oi.option, me.emplacement, oi.id) >= me.valeur)
    .map((me) => me.emplacement)
}

/** Nombre maximal de fois qu'une formation peut figurer dans l'armée, `null` si non limité. */
export function plafondFormation(idx: IndexCodex, formationId: string): number | null {
  const def = idx.formations.get(formationId)
  if (!def) return null
  return trouve(contraintes(idx.sectionDe.get(def.id), def), 'max_par_armee')?.valeur ?? null
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

function plage(total: number | { min: number; max?: number | 'besoin_transport' }): { min: number; max?: number | 'besoin_transport' } {
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
    for (const [cle, prises] of Object.entries(rep)) {
      const opt = effet.parmi.find((p) => cleRepartition(p) === cle)
      if (!opt) { erreur(ctx, 'option_interdite', `${def.nom} : ${nomUnite(idx, cle)} n'est pas proposé`); continue }
      const uid = opt.unite
      if (opt.max !== undefined && prises > opt.max * mult) erreur(ctx, 'option_quantite', `${def.nom} : maximum ${opt.max * mult} ${nomUnite(idx, uid)}`)
      // une paire compte pour deux unités, au prix d'une prise
      const q = prises * (opt.nombre ?? 1)
      total += q
      if (opt.paliers?.length) {
        const palier = opt.paliers.find((x) => x.nombre === q)
        if (q > 0 && !palier) {
          erreur(ctx, 'option_quantite', `${def.nom} : ${nomUnite(idx, uid)} se prend par ${opt.paliers.map((x) => x.nombre).join(' ou ')}`)
        }
        cout += palier?.cout ?? 0
      } else {
        cout += prises * opt.cout
      }
      if (q > 0) ajouterUnite(unites, { unite: uid, nom: nomUnite(idx, uid), nombre: q, origine: 'option', option: oi.id })
    }
    if (total < min) erreur(ctx, 'option_quantite', `${def.nom} : au moins ${min}`)
    if (typeof max === 'number' && total > max * mult) erreur(ctx, 'option_quantite', `${def.nom} : au plus ${max * mult}`)
    if (max === 'besoin_transport') {
      const sans = unites.filter((u) => u.option !== oi.id)
      const choisis = Object.entries(rep).flatMap(([cle, q]) => {
        const p = effet.parmi.find((x) => cleRepartition(x) === cle)
        return p && q > 0 ? [[p.unite, q * (p.nombre ?? 1)] as [string, number]] : []
      })
      if (effet.parmi.length && choisis.length) {
        // Les véhicules proposés n'ont pas tous la même capacité ni la même liste d'unités
        // transportables : on raisonne en places, et on retient le besoin du transport le
        // plus exigeant plutôt que d'en désigner un arbitrairement.
        const places = Math.max(...effet.parmi.map((p) => besoinTransport(idx, sans, p.unite, effet.perimetre_transport)))
        const capacite = (uid: string) => idx.unites.get(uid)?.transport?.capacite ?? 1
        const offertes = choisis.reduce((s, [uid, q]) => s + capacite(uid) * q, 0)
        // un véhicule est de trop quand son retrait laisserait encore toute la formation embarquée
        const plusPetit = Math.min(...choisis.map(([uid]) => capacite(uid)))
        if (offertes - plusPetit >= places) {
          erreur(ctx, 'option_quantite', `${def.nom} : ${places} place(s) suffisent pour embarquer la formation`)
        }
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
      unites: [], options: [], sous_formations: [], profils_possibles: [], mots_cles: [], cout_base: 0, cout_options: 0, cout_sous_formations: 0, cout: 0, initiative: '', activation: true,
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
      if (ligne.choix.une_seule_sorte && Object.values(rep).filter((q) => q > 0).length > 1) {
        erreur(ctx, 'composition', `${def.nom} : une seule sorte d'unité parmi ${ligne.choix.parmi.map((p) => nomUnite(idx, p.unite)).join(', ')}`)
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
    for (const me of tous(csO, 'max_par_emplacement')) {
      if (compteEmplacement(idx, fi, o.def.id, me.emplacement) > me.valeur) erreur(ctx, 'option_quantite', `${o.def.nom} : au plus ${me.valeur} arme(s) de ${me.emplacement}`)
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
    if (!o.masque_builder && trouve(o.contraintes, 'obligatoire') && dispo.has(o.id) && !fi.options.some((x) => x.option === o.id)) {
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
  const vues = new Set<string>()
  const uniques = erreurs.filter((e) => { const k = `${e.formation}|${e.type}|${e.message}`; if (vues.has(k)) return false; vues.add(k); return true })
  erreurs.length = 0
  erreurs.push(...uniques)

  return {
    instance: fi, def, variante, section, unites, options, sous_formations: sous, mots_cles: mots,
    profils_possibles: [...new Set(variante.composition.flatMap((l) => ('transports_possibles' in l ? l.transports_possibles.unites : [])))],
    cout_base, cout_options, cout_sous_formations: cout_sous, cout: cout_base + cout_options + cout_sous,
    initiative, activation: !trouve(cs, 'pas_une_activation'), erreurs,
  }
}

/**
 * Options encore ajoutables à une formation résolue (pour le sélecteur du builder).
 * Tient compte de : max par formation, quota d'améliorations, exclusions, unités requises, max par armée.
 */
export function optionsAjoutables(idx: IndexCodex, f: FormationResolue, compteArmee: (optionId: string) => number = () => 0): Option[] {
  const section = f.section
  const maxOptions = trouve(contraintes(f.def, f.variante), 'max_options') ?? trouve(section.contraintes, 'max_options')
  const comptees = f.options.filter((o) => o.compte_quota).length
  const presentes = f.options.map((o) => o.def)
  return optionsDisponibles(idx, f.def)
    .map((id) => idx.options.get(id))
    .filter((o): o is Option => !!o && !o.masque_builder)
    .filter((o) => {
      const cs = o.contraintes
      const horsQuota = !!trouve(cs, 'hors_quota_options')
      if (maxOptions && !horsQuota && comptees >= maxOptions.valeur) return false
      const maxF = trouve(cs, 'max_par_formation')
      if (maxF && f.instance.options.filter((x) => x.option === o.id).length >= maxF.valeur * (maxF.par_taille ? f.variante.taille : 1)) return false
      const maxA = trouve(cs, 'max_par_armee')
      if (maxA && compteArmee(o.id) >= maxA.valeur) return false
      const excl = trouve(cs, 'exclusif')
      if (excl && presentes.some((p) => trouve(p.contraintes, 'exclusif')?.groupe === excl.groupe)) return false
      if (tous(cs, 'exclut').some((k) => presentes.some((p) => k.options.includes(p.id)))) return false
      if (presentes.some((p) => tous(p.contraintes, 'exclut').some((k) => k.options.includes(o.id)))) return false
      const req = trouve(cs, 'requiert_unite')
      if (req && !f.unites.some((u) => req.unites.includes(u.unite))) return false
      return true
    })
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

/**
 * Clé d'une ligne de `choix_multiple` dans `repartition` : l'id de l'unité pour une
 * ligne simple (listes déjà enregistrées), suffixée du nombre pour une paire ou un lot.
 */
export function cleRepartition(p: { unite: string; nombre?: number }): string {
  return p.nombre && p.nombre > 1 ? `${p.unite}__x${p.nombre}` : p.unite
}

/** Plafond, en prises, d'une ligne d'un `choix_multiple` (ou null). */
export function plafondRepartition(idx: IndexCodex, f: FormationResolue, oi: OptionInstance, cle: string): number | null {
  const def = idx.options.get(oi.option)
  const effet = def?.effet.type === 'choix' ? (def.effet.parmi.find((p) => p.id === oi.choix) ?? def.effet.parmi[0])?.effet : def?.effet
  if (!effet || effet.type !== 'choix_multiple') return null
  const mult = effet.par_taille ? f.variante.taille : 1
  const p = effet.parmi.find((x) => cleRepartition(x) === cle)
  const nombre = p?.nombre ?? 1
  const total = plage(effet.total)
  const autres = Object.entries(oi.repartition ?? {}).filter(([c]) => c !== cle)
    .reduce((s, [c, q]) => s + q * (effet.parmi.find((x) => cleRepartition(x) === c)?.nombre ?? 1), 0)
  let restant = typeof total.max === 'number' ? Math.max(0, Math.floor((total.max * mult - autres) / nombre)) : null
  if (total.max === 'besoin_transport' && p) {
    // autant de prises qu'il faut pour couvrir les places encore manquantes, une fois
    // comptées celles des véhicules déjà choisis sur les autres lignes. Les transports
    // automatiques (ligne « + transports Rhino ») sont écartés : ils se dimensionnent
    // sur ce qui reste à embarquer, comme quand le moteur vérifie l'amélioration.
    const sans = f.unites.filter((u) => u.option !== oi.id && u.origine !== 'transport')
    const places = Math.max(0, ...effet.parmi.map((x) => besoinTransport(idx, sans, x.unite, effet.perimetre_transport)))
    const capacite = (uid: string) => idx.unites.get(uid)?.transport?.capacite ?? 1
    const offertes = Object.entries(oi.repartition ?? {}).filter(([c]) => c !== cle).reduce((s, [c, q]) => {
      const x = effet.parmi.find((y) => cleRepartition(y) === c)
      return s + (x ? capacite(x.unite) * q * (x.nombre ?? 1) : 0)
    }, 0)
    restant = Math.max(0, Math.ceil((places - offertes) / (capacite(p.unite) * nombre)))
  }
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

const enListe = (a: string | string[] | undefined): string[] => (Array.isArray(a) ? a : a ? [a] : [])

/** Unité jouable dans une armée de ces allégeances (toujours vrai sans allégeance choisie ou pour une unité non marquée). */
export function uniteAutorisee(idx: IndexCodex, allegeances: string | string[] | undefined, uniteId: string): boolean {
  const a = idx.unites.get(uniteId)?.allegeance
  const choisies = enListe(allegeances)
  return !a || !choisies.length || choisies.includes(a)
}

/**
 * Formation jouable : pour au moins une des allégeances choisies, une variante dont toutes
 * les unités fixes sont autorisées et chaque choix garde une possibilité. Une formation ne
 * mélange pas deux allégeances, d'où le test allégeance par allégeance.
 */
export function formationAutorisee(idx: IndexCodex, allegeances: string | string[] | undefined, formationId: string): boolean {
  const f = idx.formations.get(formationId)
  const choisies = enListe(allegeances)
  if (!f || !choisies.length) return true
  return choisies.some((a) => f.variantes.some((v) => v.composition.every((l) =>
    'unite' in l ? uniteAutorisee(idx, a, l.unite)
      : 'choix' in l ? l.choix.parmi.some((p) => uniteAutorisee(idx, a, p.unite))
        : true)))
}

/** Paire d'allégeances interdite dans la sélection, ou undefined. */
export function allegeancesIncompatibles(idx: IndexCodex, choisies: string[]): [string, string] | undefined {
  return idx.codex.codex.allegeances_incompatibles.find(([a, b]) => choisies.includes(a) && choisies.includes(b))
}

/**
 * Allégeances déduites des unités marquées d'une liste qui n'en déclare pas
 * (listes de test écrites avant les allégeances) : celles qu'elle aligne.
 */
export function allegeancesDeduites(idx: IndexCodex, formations: FormationResolue[]): string[] {
  const vues = new Set<string>()
  const parcourir = (f: FormationResolue) => {
    for (const u of f.unites) { const a = idx.unites.get(u.unite)?.allegeance; if (a) vues.add(a) }
    f.sous_formations.forEach(parcourir)
  }
  formations.forEach(parcourir)
  return [...vues]
}

export function calculerListe(idx: IndexCodex, liste: Liste): ResultatListe {
  const formations = liste.formations.map((fi) => resoudreFormation(idx, fi))
  const erreurs: Erreur[] = formations.flatMap((f) => f.erreurs)
  const total = formations.reduce((s, f) => s + f.cout, 0)
  const toutes: FormationResolue[] = []
  const collecter = (f: FormationResolue) => { toutes.push(f); f.sous_formations.forEach(collecter) }
  formations.forEach(collecter)

  // allégeances : jusqu'à `allegeances_max` par armée, sans paire interdite ; une seule par formation
  const allegeances = idx.codex.codex.allegeances
  if (allegeances.length) {
    const choisies = allegeancesDe(liste)
    const max = idx.codex.codex.allegeances_max
    const nomA = (id?: string) => allegeances.find((a) => a.id === id)?.nom ?? id
    const allegeanceDe = (uid: string) => idx.unites.get(uid)?.allegeance
    const marquees = toutes.flatMap((f) => f.unites.filter((u) => allegeanceDe(u.unite)).map((u) => ({ f, u })))
    if (!choisies.length) {
      if (marquees.length) erreurs.push({ type: 'allegeance', message: `Choisir ${max > 1 ? `jusqu'à ${max} allégeances` : 'l\'allégeance'} de l'armée (${allegeances.map((a) => a.nom).join(', ')})`, niveau: 'erreur' })
    } else {
      if (choisies.length > max) erreurs.push({ type: 'allegeance', message: `Au plus ${max} allégeance${max > 1 ? 's' : ''} par armée (${choisies.length})`, niveau: 'erreur' })
      const interdite = allegeancesIncompatibles(idx, choisies)
      if (interdite) erreurs.push({ type: 'allegeance', message: `${nomA(interdite[0])} et ${nomA(interdite[1])} ne peuvent pas servir dans la même armée`, niveau: 'erreur' })
      const texteChoisies = choisies.map(nomA).join(' et ')
      for (const { f, u } of marquees) {
        if (!uniteAutorisee(idx, choisies, u.unite)) erreurs.push({ type: 'allegeance', message: `${f.def.nom} : ${u.nom} (${nomA(allegeanceDe(u.unite))}) n'est pas jouable dans une armée ${texteChoisies}`, formation: f.instance.id, niveau: 'erreur' })
      }
    }
    for (const f of toutes) {
      const dansFormation = [...new Set(f.unites.map((u) => allegeanceDe(u.unite)).filter((a): a is string => !!a))]
      if (dansFormation.length > 1) erreurs.push({ type: 'allegeance', message: `${f.def.nom} : une formation ne mélange pas ${dansFormation.map(nomA).join(' et ')}`, formation: f.instance.id, niveau: 'erreur' })
    }
  }

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
      for (const f of toutes) {
        for (const k of tous(contraintes(f.section, f.def, f.variante), 'fournit')) if (k.budget === b.id) cap += k.quantite
        // une option peut aussi ouvrir des places (Porte-icône du Chaos : une formation démoniaque par icône)
        for (const o of f.options) {
          const csO = o.def.effet.type === 'choix'
            ? [...o.def.contraintes, ...(o.def.effet.parmi.find((p) => p.id === o.instance.choix) ?? o.def.effet.parmi[0]!).contraintes]
            : o.def.contraintes
          for (const k of tous(csO, 'fournit')) if (k.budget === b.id) cap += k.quantite * (o.instance.quantite ?? 1)
        }
      }
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

/**
 * Rejoue une liste de test du codex. Une liste écrite avant les allégeances n'en
 * déclare pas : on lui prête celles des unités qu'elle aligne, pour qu'elle reste
 * valide tant qu'elle respecte les règles (nombre, paires interdites, formations pures).
 */
export function calculerListeTest(idx: IndexCodex, t: ListeTest, codex = idx.codex.codex.slug): ResultatListe {
  const liste: Liste = {
    id: 't', nom: t.nom, codex, limite: t.limite, allegeance: t.allegeance, allegeances: t.allegeances,
    formations: t.formations.map((f) => normaliserFormation(f as never, (id) => varianteParDefaut(idx, id))),
  }
  const r = calculerListe(idx, liste)
  if (allegeancesDe(liste).length || !idx.codex.codex.allegeances.length) return r
  const deduites = allegeancesDeduites(idx, r.formations)
  return deduites.length ? calculerListe(idx, { ...liste, allegeances: deduites }) : r
}
