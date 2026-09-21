import { z } from 'zod'

/**
 * Format natif d'un codex (source de vérité unique).
 * Un fichier YAML par armée dans content/codex/. Le PDF et le builder en découlent.
 * Voir docs/modele-codex-unifie.md pour la description en français.
 */

const id = z.string().regex(/^[a-z0-9_]+$/, 'identifiant en snake_case')

// ---------- Unités ----------

export const ArmeSchema = z.object({
  nom: z.string(),
  portee: z.string().optional(),
  puissance: z.string().optional(),
})

export const UniteSchema = z.object({
  id,
  nom: z.string(),
  /** Inf, VL, VB, EG, A (aéronef), VS (vaisseau), Perso, Bat (bâtiment) */
  type: z.string(),
  vitesse: z.string().optional(),
  blindage: z.string().optional(),
  cc: z.string().optional(),
  ff: z.string().optional(),
  armes: z.array(ArmeSchema).default([]),
  notes: z.array(z.string()).default([]),
  /** personnage, commandant_supreme, synapse… (informatif, sert au builder) */
  roles: z.array(z.string()).default([]),
  /** Capacité de transport : nombre de places et unités acceptées */
  transport: z
    .object({
      capacite: z.number().int().positive(),
      accepte: z.array(id).default([]),
    })
    .optional(),
  /** Places occupées quand l'unité est transportée (défaut 1 pour l'infanterie) */
  taille_transport: z.number().int().positive().optional(),
  degats: z
    .object({
      cd: z.number().int().positive(),
      bi: z.union([z.number(), z.string()]).optional(),
      critique: z.string().optional(),
    })
    .optional(),
})

// ---------- Contraintes (vocabulaire fermé) ----------

export const ContrainteSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('max_par_armee'), valeur: z.number().int().positive() }),
  z.object({ type: z.literal('min_par_armee'), valeur: z.number().int().positive() }),
  /** Limite d'une option par formation. `par_taille` : multipliée par la taille de la variante (Orks). */
  z.object({ type: z.literal('max_par_formation'), valeur: z.number().int().positive(), par_taille: z.boolean().optional() }),
  z.object({ type: z.literal('max_options'), valeur: z.number().int().positive() }),
  z.object({ type: z.literal('hors_quota_options') }),
  z.object({ type: z.literal('exclusif'), groupe: z.string() }),
  z.object({ type: z.literal('exclut'), options: z.array(id) }),
  z.object({ type: z.literal('requiert_unite'), unites: z.array(id) }),
  z.object({ type: z.literal('taille_max_formation'), valeur: z.number().int().positive() }),
  z.object({ type: z.literal('obligatoire') }),
  z.object({ type: z.literal('fournit'), budget: id, quantite: z.number().int().positive() }),
  z.object({
    type: z.literal('consomme'),
    budget: z.union([id, z.array(id)]),
    /** `un` : une place (défaut). `points` : le coût de la formation. */
    quoi: z.enum(['un', 'points']).default('un'),
  }),
  /** Points comptés dans un budget si différents du coût réel */
  z.object({ type: z.literal('cout_rare'), valeur: z.number().int().nonnegative() }),
  z.object({ type: z.literal('initiative'), valeur: z.string() }),
  z.object({ type: z.literal('pas_une_activation') }),
  /** Ne peut être prise qu'en sous-formation (essaims instinctifs) */
  z.object({ type: z.literal('non_autonome') }),
])

// ---------- Options (améliorations) ----------

const UniteQuantite = z.object({ unite: id, nombre: z.number().int().positive().default(1) })

const EffetAjouter = z.object({
  type: z.literal('ajouter'),
  unites: z.array(UniteQuantite),
  /** coût forfaitaire de l'option */
  cout: z.number().int().nonnegative().optional(),
  /** coût par lot ajouté (l'option devient quantifiable) */
  cout_par_unite: z.number().int().nonnegative().optional(),
  /** taille d'un lot quand cout_par_unite (ex. « +50 pts la paire » : lot 2) */
  lot: z.number().int().positive().default(1),
  min: z.number().int().nonnegative().optional(),
  /** nombre max de lots, ou `besoin_transport` : autant que nécessaire pour embarquer la formation */
  max: z.union([z.number().int().positive(), z.literal('besoin_transport')]).optional(),
  /** `max` multiplié par la taille de la variante (Orks : bande mastok = limites doublées) */
  par_taille: z.boolean().optional(),
  /** avec `max: besoin_transport` : embarquer toute la formation, ou seulement les unités venues d'options */
  perimetre_transport: z.enum(['formation', 'options']).default('formation'),
  /** lignes « ou » : plusieurs jeux d'unités au choix, chacun avec son coût */
  variantes: z
    .array(z.object({ id: id.optional(), nom: z.string(), cout: z.number().int().nonnegative(), unites: z.array(UniteQuantite) }))
    .optional(),
})

const EffetRemplacer = z.object({
  type: z.literal('remplacer'),
  de: z.union([id, z.array(id)]),
  par: id,
  /** unités remplacées par lot */
  lot: z.number().int().positive().default(1),
  /** nombre max de lots, ou `tout` : toutes les unités concernées */
  max: z.union([z.number().int().positive(), z.literal('tout')]).default(1),
  /** coût par lot */
  cout: z.number().int().nonnegative().default(0),
  /** l'option remplace d'office toutes les unités concernées (Dreadnought à la place des Rhinos) */
  tout: z.boolean().optional(),
  /** avec `tout` : nombre d'unités `par` obtenues (défaut : autant que d'unités remplacées) */
  par_nombre: z.number().int().positive().optional(),
})

const EffetMotCle = z.object({
  type: z.literal('mot_cle'),
  texte: z.string(),
  cout: z.number().int().nonnegative().default(0),
  /** unités concernées (défaut : toute la formation) */
  cible: z.array(id).optional(),
})

const EffetChoixMultiple = z.object({
  type: z.literal('choix_multiple'),
  total: z.union([
    z.number().int().positive(),
    z.object({ min: z.number().int().nonnegative(), max: z.union([z.number().int().positive(), z.literal('besoin_transport')]) }),
  ]),
  parmi: z.array(z.object({ unite: id, cout: z.number().int().nonnegative().default(0), max: z.number().int().positive().optional() })),
  par_taille: z.boolean().optional(),
  perimetre_transport: z.enum(['formation', 'options']).default('formation'),
})

const EffetSimple = z.discriminatedUnion('type', [EffetAjouter, EffetRemplacer, EffetMotCle, EffetChoixMultiple])

const EffetChoix = z.object({
  type: z.literal('choix'),
  parmi: z.array(
    z.object({
      id,
      nom: z.string(),
      cout: z.number().int().nonnegative().default(0),
      effet: EffetSimple.optional(),
      contraintes: z.array(ContrainteSchema).default([]),
    }),
  ),
})

export const EffetSchema = z.union([EffetSimple, EffetChoix])

export const OptionSchema = z.object({
  id,
  nom: z.string(),
  effet: EffetSchema,
  contraintes: z.array(ContrainteSchema).default([]),
  /** texte libre affiché en note (PDF) et en info-bulle (builder) */
  note_md: z.string().optional(),
  /** renvoi vers une note de bas de tableau partagée (astérisque) */
  note_ref: id.optional(),
  /** surcharge de la phrase générée dans la colonne Unités du PDF */
  phrase_pdf: z.string().optional(),
})

// ---------- Formations ----------

const ChoixComposition = z.object({
  total: z.union([z.number().int().positive(), z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() })]),
  parmi: z.array(
    z.object({
      unite: id,
      cout: z.number().int().nonnegative().default(0),
      /** une pioche = n figurines (Gaunts : 6 par pioche) */
      par_pioche: z.number().int().positive().default(1),
    }),
  ),
  phrase_pdf: z.string().optional(),
})

export const LigneCompositionSchema = z.union([
  z.object({
    unite: id,
    nombre: z.number().int().positive().default(1),
    /** présent mais non listé dans la colonne Unités (Commissaire des compagnies) */
    implicite: z.boolean().optional(),
  }),
  z.object({ choix: ChoixComposition }),
  /** transports automatiques et gratuits : autant que nécessaire pour embarquer la formation */
  z.object({ transports: z.object({ unite: id }) }),
])

const SousFormations = z.object({
  label: z.string(),
  total: z.union([z.number().int().positive(), z.object({ min: z.number().int().nonnegative(), max: z.number().int().positive() })]),
  parmi: z.array(id),
  phrase_pdf: z.string().optional(),
})

export const VarianteSchema = z.object({
  id,
  nom: z.string().optional(),
  cout: z.number().int().nonnegative(),
  composition: z.array(LigneCompositionSchema),
  /** multiplicateur des limites `par_taille` (Orks : normale 1, mastok 2, tré mastok 3) */
  taille: z.number().int().positive().default(1),
  contraintes: z.array(ContrainteSchema).default([]),
  sous_formations: SousFormations.optional(),
})

export const FormationSchema = z.object({
  id,
  nom: z.string(),
  description: z.string().optional(),
  variantes: z.array(VarianteSchema).min(1),
  /** options de la formation ; sinon celles de sa section */
  options: z.array(id).optional(),
  options_plus: z.array(id).default([]),
  options_moins: z.array(id).default([]),
  contraintes: z.array(ContrainteSchema).default([]),
  /** formations à choisir dans la liste et rattachées (Tyranides : essaims instinctifs) */
  sous_formations: SousFormations.optional(),
  phrase_pdf: z.string().optional(),
})

// ---------- Sections et budgets ----------

export const SectionSchema = z.object({
  id,
  titre: z.string(),
  sous_titre: z.string().optional(),
  formations: z.array(id),
  /**
   * Alliance : la section propose les formations d'un autre codex (Adeptus Titanicus, Aeronautica…).
   * Les unités, options et formations de l'allié sont fusionnées à la lecture ; les règles de CETTE section
   * (par exemple « compte dans le budget Supports ») s'appliquent aux formations importées.
   */
  allies: z
    .object({
      codex: z.string().regex(/^[a-z0-9-]+$/),
      /** sections de l'allié à importer (toutes par défaut) */
      sections: z.array(id).optional(),
    })
    .optional(),
  contraintes: z.array(ContrainteSchema).default([]),
  /** options disponibles pour toutes les formations de la section */
  options: z.array(id).default([]),
  /** bloc « Améliorations » séparé dans le PDF */
  tableau_options: z.object({ titre: z.string(), sous_titre: z.string().optional() }).optional(),
  /** colonne Améliorations dans le tableau des formations (Space Marines) */
  colonne_options: z.boolean().optional(),
  /** notes de bas de tableau, par id (astérisques) */
  notes: z.record(id, z.string()).default({}),
})

export const BudgetSchema = z.object({
  id,
  libelle: z.string(),
  capacite: z.discriminatedUnion('source', [
    z.object({ source: z.literal('fixe'), valeur: z.number().int().nonnegative() }),
    /** somme des `fournit` des formations présentes */
    z.object({ source: z.literal('fournitures') }),
    z.object({ source: z.literal('ratio_points'), ratio: z.number().positive(), base: z.enum(['limite_liste', 'points_liste']).default('limite_liste') }),
    /** 1 par tranche entamée de n points ; `perimetre` restreint aux points d'une section */
    z.object({ source: z.literal('par_tranche'), points: z.number().int().positive(), perimetre: z.string().optional() }),
  ]),
  phrase_pdf: z.string().optional(),
})

// ---------- Listes de test ----------

export const OptionInstanceSchema = z.object({
  option: id,
  quantite: z.number().int().positive().optional(),
  choix: id.optional(),
  variante: id.optional(),
  /** choix_multiple : quantité par unité */
  repartition: z.record(id, z.number().int().nonnegative()).optional(),
})

export type FormationInstanceInput = {
  formation: string
  variante?: string
  /** choix de composition : index de ligne -> quantité par unité */
  choix?: Record<string, Record<string, number>>
  options?: z.input<typeof OptionInstanceSchema>[]
  sous_formations?: FormationInstanceInput[]
}

export const FormationInstanceSchema: z.ZodType<FormationInstanceInput> = z.lazy(() =>
  z.object({
    formation: id,
    variante: id.optional(),
    choix: z.record(z.string(), z.record(id, z.number().int().nonnegative())).optional(),
    options: z.array(OptionInstanceSchema).optional(),
    sous_formations: z.array(FormationInstanceSchema).optional(),
  }),
)

export const ListeTestSchema = z.object({
  nom: z.string(),
  limite: z.number().int().positive(),
  attendu: z.enum(['valide', 'refusee']),
  /** type d'erreur attendu quand `refusee` */
  erreur: z.string().optional(),
  formations: z.array(FormationInstanceSchema),
})

// ---------- Codex ----------

export const CodexSchema = z.object({
  codex: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    nom: z.string(),
    version: z.string(),
    faction: z.enum(['imperium', 'chaos', 'xenos']),
    /** `soutien` : liste partagée (Titans, aviation) utilisée en alliance par d'autres codex, pas une armée jouable seule */
    type: z.enum(['armee', 'soutien']).default('armee'),
    categorie: z.string().optional(),
    statut: z.enum(['official', 'beta', 'experimental', '30k']).default('official'),
    couleur: z.string().optional(),
    logo: z.string().optional(),
    citation: z.object({ texte: z.string(), auteur: z.string().optional() }).optional(),
    /** illustration pleine page de la couverture du PDF (URL) */
    illustration: z.string().optional(),
    /** incruster le bandeau et le titre sur l'illustration (inutile si l'image est déjà une couverture finie) */
    illustration_titre: z.boolean().default(false),
    intro_md: z.string().optional(),
    regles_md: z.array(z.object({ titre: z.string(), texte: z.string() })).default([]),
    credits: z.string().optional(),
    valeur_strategique: z.union([z.number(), z.string()]),
    initiative: z.object({
      defaut: z.string(),
      exceptions: z.array(z.object({ portee: z.string(), valeur: z.string() })).default([]),
    }),
  }),
  budgets: z.array(BudgetSchema).default([]),
  unites: z.array(UniteSchema),
  options: z.array(OptionSchema).default([]),
  formations: z.array(FormationSchema),
  sections: z.array(SectionSchema),
  listes_test: z.array(ListeTestSchema).default([]),
})

export type Codex = z.infer<typeof CodexSchema>
export type CodexInput = z.input<typeof CodexSchema>
export type Unite = z.infer<typeof UniteSchema>
export type Option = z.infer<typeof OptionSchema>
export type Effet = z.infer<typeof EffetSchema>
export type Contrainte = z.infer<typeof ContrainteSchema>
export type Formation = z.infer<typeof FormationSchema>
export type Variante = z.infer<typeof VarianteSchema>
export type LigneComposition = z.infer<typeof LigneCompositionSchema>
export type Section = z.infer<typeof SectionSchema>
export type Budget = z.infer<typeof BudgetSchema>
export type OptionInstance = z.infer<typeof OptionInstanceSchema>
export type ListeTest = z.infer<typeof ListeTestSchema>

/**
 * Vérifie les références entre objets (unités, options, formations, budgets, sections).
 * Retourne la liste des problèmes ; vide si tout est cohérent.
 */
export function verifierReferences(codex: Codex): string[] {
  const pb: string[] = []
  const unites = new Set(codex.unites.map((u) => u.id))
  const options = new Set(codex.options.map((o) => o.id))
  const formations = new Set(codex.formations.map((f) => f.id))
  const budgets = new Set(codex.budgets.map((b) => b.id))

  const u = (ctx: string, uid: string) => { if (!unites.has(uid)) pb.push(`${ctx} : unité inconnue « ${uid} »`) }
  const o = (ctx: string, oid: string) => { if (!options.has(oid)) pb.push(`${ctx} : option inconnue « ${oid} »`) }
  const f = (ctx: string, fid: string) => { if (!formations.has(fid)) pb.push(`${ctx} : formation inconnue « ${fid} »`) }
  const c = (ctx: string, cs: Contrainte[]) => {
    for (const k of cs) {
      if (k.type === 'fournit' && !budgets.has(k.budget)) pb.push(`${ctx} : budget inconnu « ${k.budget} »`)
      if (k.type === 'consomme') for (const b of Array.isArray(k.budget) ? k.budget : [k.budget]) if (!budgets.has(b)) pb.push(`${ctx} : budget inconnu « ${b} »`)
      if (k.type === 'requiert_unite') k.unites.forEach((x) => u(ctx, x))
      if (k.type === 'exclut') k.options.forEach((x) => o(ctx, x))
    }
  }
  const effet = (ctx: string, e: Effet) => {
    if (e.type === 'ajouter') {
      e.unites.forEach((x) => u(ctx, x.unite))
      e.variantes?.forEach((v) => v.unites.forEach((x) => u(ctx, x.unite)))
    } else if (e.type === 'remplacer') {
      ;(Array.isArray(e.de) ? e.de : [e.de]).forEach((x) => u(ctx, x))
      u(ctx, e.par)
    } else if (e.type === 'mot_cle') {
      e.cible?.forEach((x) => u(ctx, x))
    } else if (e.type === 'choix_multiple') {
      e.parmi.forEach((x) => u(ctx, x.unite))
    } else if (e.type === 'choix') {
      e.parmi.forEach((p) => { if (p.effet) effet(`${ctx} > ${p.id}`, p.effet); c(`${ctx} > ${p.id}`, p.contraintes) })
    }
  }

  for (const un of codex.unites) un.transport?.accepte.forEach((x) => u(`unité ${un.id}`, x))
  for (const op of codex.options) { effet(`option ${op.id}`, op.effet); c(`option ${op.id}`, op.contraintes) }
  for (const fo of codex.formations) {
    const ctx = `formation ${fo.id}`
    c(ctx, fo.contraintes)
    fo.options?.forEach((x) => o(ctx, x)); fo.options_plus.forEach((x) => o(ctx, x)); fo.options_moins.forEach((x) => o(ctx, x))
    fo.sous_formations?.parmi.forEach((x) => f(ctx, x))
    for (const v of fo.variantes) {
      c(`${ctx} / ${v.id}`, v.contraintes)
      v.sous_formations?.parmi.forEach((x) => f(ctx, x))
      for (const l of v.composition) {
        if ('unite' in l) u(ctx, l.unite)
        else if ('choix' in l) l.choix.parmi.forEach((x) => u(ctx, x.unite))
        else u(ctx, l.transports.unite)
      }
    }
  }
  const dansSection = new Set<string>()
  for (const s of codex.sections) {
    const ctx = `section ${s.id}`
    s.formations.forEach((x) => { f(ctx, x); dansSection.add(x) })
    s.options.forEach((x) => o(ctx, x))
    c(ctx, s.contraintes)
  }
  for (const fo of codex.formations) if (!dansSection.has(fo.id)) pb.push(`formation ${fo.id} n'appartient à aucune section`)
  return pb
}

/** Parse + valide un codex ; lève une erreur lisible sinon. */
export function chargerCodex(brut: unknown): Codex {
  const res = CodexSchema.safeParse(brut)
  if (!res.success) {
    const lignes = res.error.issues.map((i) => `${i.path.join('.')} : ${i.message}`)
    throw new Error(`Codex invalide :\n${lignes.join('\n')}`)
  }
  const refs = verifierReferences(res.data)
  if (refs.length) throw new Error(`Références cassées :\n${refs.join('\n')}`)
  return res.data
}
