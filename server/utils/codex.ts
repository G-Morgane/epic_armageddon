import { parse } from 'yaml'
import type { SupabaseClient } from '@supabase/supabase-js'
import { CodexSchema, chargerCodex, type Codex, type CodexInput } from '~~/shared/codex/schema'
import { fusionnerAllies, alliesReferences } from '~~/shared/codex/allies'

/**
 * Sources d'un codex, par priorité : dernière version publiée > YAML embarqué.
 * Les brouillons vivent à côté, jamais servis au public sans `?brouillon=1`.
 *
 * Dépôt des brouillons et versions :
 *  - Supabase (tables `codex_drafts`, `codex_versions`, voir supabase/codex.sql) dès que la clé service est configurée ;
 *  - sinon le stockage fichiers de Nitro (`.data/`), pour travailler hors ligne.
 */

interface Brouillon { data: CodexInput; modifie: string }
interface Version { data: CodexInput; version: string; changelog: string; publie: string }

interface Depot {
  nom: string
  slugs(): Promise<string[]>
  brouillon(slug: string): Promise<Brouillon | null>
  ecrireBrouillon(slug: string, data: CodexInput): Promise<void>
  supprimerBrouillon(slug: string): Promise<void>
  publie(slug: string): Promise<Version | null>
  versions(slug: string): Promise<Omit<Version, 'data'>[]>
  publier(slug: string, v: Version): Promise<void>
}

// ---------- dépôt fichiers (Nitro) ----------

const depotFichiers: Depot = {
  nom: 'fichiers',
  async slugs() {
    const d = useStorage('data')
    const cles = [...(await d.getKeys('codex:brouillon')), ...(await d.getKeys('codex:publie'))]
    return cles.map((k) => k.split(':').pop()!)
  },
  brouillon: (slug) => useStorage('data').getItem<Brouillon>(`codex:brouillon:${slug}`),
  ecrireBrouillon: (slug, data) => useStorage('data').setItem(`codex:brouillon:${slug}`, { data, modifie: new Date().toISOString() }),
  supprimerBrouillon: (slug) => useStorage('data').removeItem(`codex:brouillon:${slug}`),
  publie: (slug) => useStorage('data').getItem<Version>(`codex:publie:${slug}`),
  async versions(slug) {
    const d = useStorage('data')
    const cles = (await d.getKeys(`codex:versions:${slug}`)).sort()
    const out: Omit<Version, 'data'>[] = []
    for (const k of cles) {
      const v = await d.getItem<Version>(k)
      if (v) out.push({ version: v.version, changelog: v.changelog, publie: v.publie })
    }
    return out
  },
  async publier(slug, v) {
    const d = useStorage('data')
    const n = (await d.getKeys(`codex:versions:${slug}`)).length + 1
    await d.setItem(`codex:versions:${slug}:${String(n).padStart(3, '0')}`, v)
    await d.setItem(`codex:publie:${slug}`, v)
  },
}

// ---------- dépôt Supabase ----------

function erreurSql(e: { message?: string; code?: string } | null, action: string): never {
  const manque = e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message ?? '')
  throw new Error(manque ? `Tables des codex absentes : exécuter supabase/codex.sql dans le SQL editor Supabase (${action})` : `${action} : ${e?.message ?? 'erreur Supabase'}`)
}

/** Client non typé : les tables codex ne sont pas dans les types générés du projet. */
const sbCodex = () => useSupabaseServer() as unknown as SupabaseClient

const depotSupabase: Depot = {
  nom: 'supabase',
  async slugs() {
    const sb = sbCodex()
    const [b, v] = await Promise.all([sb.from('codex_drafts').select('slug'), sb.from('codex_versions').select('slug')])
    if (b.error) erreurSql(b.error, 'lecture des brouillons')
    if (v.error) erreurSql(v.error, 'lecture des versions')
    return [...(b.data ?? []), ...(v.data ?? [])].map((r) => r.slug as string)
  },
  async brouillon(slug) {
    const { data, error } = await sbCodex().from('codex_drafts').select('data, updated_at').eq('slug', slug).maybeSingle()
    if (error) erreurSql(error, 'lecture du brouillon')
    return data ? { data: data.data as CodexInput, modifie: data.updated_at as string } : null
  },
  async ecrireBrouillon(slug, data) {
    const { error } = await sbCodex().from('codex_drafts').upsert({ slug, data, updated_at: new Date().toISOString() })
    if (error) erreurSql(error, 'enregistrement du brouillon')
  },
  async supprimerBrouillon(slug) {
    const { error } = await sbCodex().from('codex_drafts').delete().eq('slug', slug)
    if (error) erreurSql(error, 'suppression du brouillon')
  },
  async publie(slug) {
    const { data, error } = await sbCodex().from('codex_versions').select('data, version, changelog, published_at').eq('slug', slug).order('published_at', { ascending: false }).limit(1).maybeSingle()
    if (error) erreurSql(error, 'lecture de la version publiée')
    return data ? { data: data.data as CodexInput, version: data.version as string, changelog: (data.changelog as string) ?? '', publie: data.published_at as string } : null
  },
  async versions(slug) {
    const { data, error } = await sbCodex().from('codex_versions').select('version, changelog, published_at').eq('slug', slug).order('published_at', { ascending: true })
    if (error) erreurSql(error, 'lecture des versions')
    return (data ?? []).map((r) => ({ version: r.version as string, changelog: (r.changelog as string) ?? '', publie: r.published_at as string }))
  },
  async publier(slug, v) {
    const { error } = await sbCodex().from('codex_versions').insert({ slug, version: v.version, changelog: v.changelog, data: v.data, published_at: v.publie })
    if (error) erreurSql(error, 'publication')
  },
}

function depot(): Depot {
  const config = useRuntimeConfig()
  const force = process.env.CODEX_STOCKAGE
  if (force === 'fichiers') return depotFichiers
  if (force === 'supabase' || (config.supabaseUrl && config.supabaseServiceRoleKey)) return depotSupabase
  return depotFichiers
}

// ---------- API commune ----------

const assets = () => useStorage('assets:codex')

export interface EtatCodex {
  slug: string
  nom: string
  faction: string
  version: string
  statut: string
  couleur?: string
  source: 'yaml' | 'publie'
  brouillon: boolean
  brouillon_modifie?: string
  versions: number
  stockage: string
  type: 'armee' | 'soutien'
}

async function lireYaml(slug: string): Promise<unknown | null> {
  const brut = await assets().getItem<string>(`${slug}.yaml`)
  return brut == null ? null : parse(typeof brut === 'string' ? brut : String(brut))
}

function verifierSlug(slug: string) {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
}

export async function listerSlugsCodex(): Promise<string[]> {
  const yaml = (await assets().getKeys()).filter((k) => k.endsWith('.yaml')).map((k) => k.replace(/\.yaml$/, ''))
  return [...new Set([...yaml, ...(await depot().slugs())])].sort()
}

/** Codex publié seul (dernière version publiée, sinon YAML), sans ses alliés. */
async function lireCodexSeul(slug: string): Promise<Codex> {
  verifierSlug(slug)
  const publie = await depot().publie(slug)
  if (publie) return chargerCodex(publie.data)
  const yaml = await lireYaml(slug)
  if (yaml == null) throw new Error(`codex introuvable : ${slug}`)
  return chargerCodex(yaml)
}

/** Fusionne les codex alliés (versions publiées) dans un codex. */
export async function avecAllies(codex: Codex): Promise<Codex> {
  const allies: Record<string, Codex> = {}
  for (const a of alliesReferences(codex)) {
    try { allies[a] = await lireCodexSeul(a) } catch { throw new Error(`Codex allié introuvable : ${a}`) }
  }
  return fusionnerAllies(codex, allies)
}

/** Codex tel que le public le voit : version publiée + formations des alliés. */
export async function lireCodex(slug: string): Promise<Codex> {
  return avecAllies(await lireCodexSeul(slug))
}

/** Brouillon brut (non validé) ; s'il n'existe pas, part du codex public. */
export async function lireBrouillon(slug: string): Promise<{ data: CodexInput; modifie?: string; existe: boolean }> {
  verifierSlug(slug)
  const b = await depot().brouillon(slug)
  if (b) return { ...b, existe: true }
  const base = (await depot().publie(slug))?.data ?? (await lireYaml(slug))
  if (base == null) throw new Error(`codex introuvable : ${slug}`)
  return { data: base as CodexInput, existe: false }
}

export async function ecrireBrouillon(slug: string, brut: CodexInput): Promise<void> {
  verifierSlug(slug)
  await depot().ecrireBrouillon(slug, brut)
}

export async function supprimerBrouillon(slug: string): Promise<void> {
  verifierSlug(slug)
  await depot().supprimerBrouillon(slug)
}

/** Publie le brouillon : validation stricte, snapshot versionné, devient la version publique. */
export async function publierBrouillon(slug: string, version: string, changelog: string): Promise<Codex> {
  const b = await lireBrouillon(slug)
  const brut = { ...b.data, codex: { ...b.data.codex, version } }
  const codex = chargerCodex(brut)
  await depot().publier(slug, { data: brut, version, changelog, publie: new Date().toISOString() })
  await depot().supprimerBrouillon(slug)
  return codex
}

export async function listerVersions(slug: string) {
  verifierSlug(slug)
  return depot().versions(slug)
}

export async function etatsCodex(): Promise<EtatCodex[]> {
  const d = depot()
  const slugs = await listerSlugsCodex()
  return Promise.all(slugs.map(async (slug) => {
    const [publie, b, versions] = await Promise.all([d.publie(slug), d.brouillon(slug), d.versions(slug)])
    const src = publie?.data ?? (await lireYaml(slug)) ?? b?.data
    const c = CodexSchema.shape.codex.safeParse((src as CodexInput | undefined)?.codex)
    const meta = c.success ? c.data : { nom: slug, faction: '?', version: '?', statut: 'experimental', couleur: undefined, type: 'armee' as const }
    return {
      slug,
      nom: (b?.data.codex.nom as string) ?? meta.nom,
      faction: meta.faction,
      version: publie?.version ?? meta.version,
      statut: meta.statut,
      couleur: meta.couleur,
      source: publie ? 'publie' : 'yaml',
      brouillon: !!b,
      brouillon_modifie: b?.modifie,
      versions: versions.length,
      stockage: d.nom,
      type: meta.type,
    }
  }))
}

/** Squelette d'une nouvelle armée. */
export function codexVide(slug: string, nom: string, faction: 'imperium' | 'chaos' | 'xenos', type: 'armee' | 'soutien' = 'armee'): CodexInput {
  if (type === 'soutien') {
    return {
      codex: { slug, nom, type, version: '0.1', faction, statut: 'experimental', valeur_strategique: '-', initiative: { defaut: '2+', exceptions: [] }, regles_md: [], intro_md: 'Liste de soutien partagée : ses formations sont proposées en alliance par les codex qui y ont droit.' },
      budgets: [],
      unites: [],
      options: [],
      formations: [],
      sections: [{ id: 'soutiens', titre: nom.toUpperCase(), formations: [], contraintes: [], options: [], notes: {} }],
      listes_test: [],
    }
  }
  return {
    codex: { slug, nom, type, version: '0.1', faction, statut: 'experimental', valeur_strategique: 2, initiative: { defaut: '2+', exceptions: [] }, regles_md: [] },
    budgets: [{ id: 'rare', libelle: 'Supports', capacite: { source: 'ratio_points', ratio: 0.3334, base: 'limite_liste' }, phrase_pdf: "Jusqu'à 1/3 des points disponibles peuvent être dépensés pour ces formations" }],
    unites: [],
    options: [],
    formations: [],
    sections: [
      { id: 'principales', titre: 'FORMATIONS PRINCIPALES', formations: [], contraintes: [], options: [], notes: {} },
      { id: 'supports', titre: 'SUPPORTS', formations: [], contraintes: [{ type: 'consomme', budget: 'rare', quoi: 'points' }], options: [], notes: {} },
    ],
    listes_test: [],
  }
}
