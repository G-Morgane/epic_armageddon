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
interface Version { data: CodexInput; version: string; changelog: string; publie: string; pdf_url?: string }
interface Publication { slug: string; version: string; publie: string; changelog: string }

/** Métadonnées d'un codex telles que l'index admin en a besoin : jamais son contenu complet. */
interface Resume {
  publie?: { version: string; codex?: unknown }
  brouillon?: { codex?: unknown; modifie: string }
  /** Nombre de REV distinctes, comme l'historique public les compte : republier la même REV ne compte pas deux fois. */
  versions: number
}

interface Depot {
  nom: string
  slugs(): Promise<string[]>
  brouillon(slug: string): Promise<Brouillon | null>
  ecrireBrouillon(slug: string, data: CodexInput): Promise<void>
  supprimerBrouillon(slug: string): Promise<void>
  publie(slug: string): Promise<Version | null>
  /** Une version précise de l'historique (null si elle n'existe pas). */
  version(slug: string, version: string): Promise<Version | null>
  versions(slug: string): Promise<Omit<Version, 'data'>[]>
  /** Toutes les publications, tous codex confondus : la liste des armées les veut en une fois, pas 43 requêtes. */
  publications(): Promise<Publication[]>
  /** Tout ce que l'index admin affiche, sans rapatrier le contenu des codex : deux requêtes, pas trois par slug. */
  resumes(): Promise<Map<string, Resume>>
  publier(slug: string, v: Version): Promise<void>
  /** Attache l'URL du PDF figé à une version publiée. */
  attacherPdf(slug: string, version: string, url: string): Promise<void>
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
  async version(slug, version) {
    const d = useStorage('data')
    for (const k of (await d.getKeys(`codex:versions:${slug}`)).sort()) {
      const v = await d.getItem<Version>(k)
      if (v?.version === version) return v
    }
    return null
  },
  async versions(slug) {
    const d = useStorage('data')
    const cles = (await d.getKeys(`codex:versions:${slug}`)).sort()
    const out: Omit<Version, 'data'>[] = []
    for (const k of cles) {
      const v = await d.getItem<Version>(k)
      if (v) out.push({ version: v.version, changelog: v.changelog, publie: v.publie, pdf_url: v.pdf_url })
    }
    return out
  },
  async publications() {
    const d = useStorage('data')
    const out: Publication[] = []
    for (const k of (await d.getKeys('codex:versions')).sort()) {
      const v = await d.getItem<Version>(k)
      // `codex:versions:<slug>:<n>`
      if (v) out.push({ slug: k.split(':')[2]!, version: v.version, publie: v.publie, changelog: v.changelog })
    }
    return out
  },
  async resumes() {
    const d = useStorage('data')
    const out = new Map<string, Resume>()
    const de = (slug: string) => {
      const r = out.get(slug) ?? { versions: 0 }
      out.set(slug, r)
      return r
    }
    for (const k of await d.getKeys('codex:brouillon')) {
      const b = await d.getItem<Brouillon>(k)
      if (b) de(k.split(':').pop()!).brouillon = { codex: b.data.codex, modifie: b.modifie }
    }
    for (const k of await d.getKeys('codex:publie')) {
      const v = await d.getItem<Version>(k)
      if (v) de(k.split(':').pop()!).publie = { version: v.version, codex: v.data.codex }
    }
    // `codex:versions:<slug>:<n>` : une REV republiée laisse deux lignes mais reste une seule version
    const revs = new Map<string, Set<string>>()
    for (const k of await d.getKeys('codex:versions')) {
      const v = await d.getItem<Version>(k)
      if (!v) continue
      const slug = k.split(':')[2]!
      const vues = revs.get(slug) ?? new Set<string>()
      vues.add(v.version)
      revs.set(slug, vues)
    }
    for (const [slug, vues] of revs) de(slug).versions = vues.size
    return out
  },
  async publier(slug, v) {
    const d = useStorage('data')
    const n = (await d.getKeys(`codex:versions:${slug}`)).length + 1
    await d.setItem(`codex:versions:${slug}:${String(n).padStart(3, '0')}`, v)
    await d.setItem(`codex:publie:${slug}`, v)
  },
  async attacherPdf(slug, version, pdf_url) {
    const d = useStorage('data')
    for (const k of await d.getKeys(`codex:versions:${slug}`)) {
      const v = await d.getItem<Version>(k)
      if (v?.version === version) await d.setItem(k, { ...v, pdf_url })
    }
    const publie = await d.getItem<Version>(`codex:publie:${slug}`)
    if (publie?.version === version) await d.setItem(`codex:publie:${slug}`, { ...publie, pdf_url })
  },
}

// ---------- dépôt Supabase ----------

function erreurSql(e: { message?: string; code?: string } | null, action: string): never {
  const manque = e?.code === '42P01' || /does not exist|schema cache/i.test(e?.message ?? '')
  throw new Error(manque ? `Tables des codex absentes : exécuter supabase/codex.sql dans le SQL editor Supabase (${action})` : `${action} : ${e?.message ?? 'erreur Supabase'}`)
}

/** Client non typé : les tables codex ne sont pas dans les types générés du projet. */
const sbCodex = () => useSupabaseServer() as unknown as SupabaseClient

interface LigneVersion { data?: unknown; version: string; changelog: string | null; published_at: string; pdf_url?: string | null }

/** `pdf_url` a été ajoutée après coup : une base non migrée répond 42703, on relit sans elle. */
const colonnePdfAbsente = (e: { code?: string; message?: string } | null) => e?.code === '42703' || /pdf_url/.test(e?.message ?? '')

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
  async version(slug, version) {
    const lire = (colonnes: string) => sbCodex().from('codex_versions').select(colonnes).eq('slug', slug).eq('version', version).order('published_at', { ascending: false }).limit(1).maybeSingle()
    let { data, error } = await lire('data, version, changelog, published_at, pdf_url')
    if (error && colonnePdfAbsente(error)) ({ data, error } = await lire('data, version, changelog, published_at'))
    if (error) erreurSql(error, `lecture de la version ${version}`)
    const r = data as unknown as LigneVersion | null
    return r ? { data: r.data as CodexInput, version: r.version, changelog: r.changelog ?? '', publie: r.published_at, pdf_url: r.pdf_url ?? undefined } : null
  },
  async versions(slug) {
    const lire = (colonnes: string) => sbCodex().from('codex_versions').select(colonnes).eq('slug', slug).order('published_at', { ascending: true })
    let { data, error } = await lire('version, changelog, published_at, pdf_url')
    if (error && colonnePdfAbsente(error)) ({ data, error } = await lire('version, changelog, published_at'))
    if (error) erreurSql(error, 'lecture des versions')
    return ((data ?? []) as unknown as LigneVersion[]).map((r) => ({ version: r.version, changelog: r.changelog ?? '', publie: r.published_at, pdf_url: r.pdf_url ?? undefined }))
  },
  async publications() {
    const { data, error } = await sbCodex().from('codex_versions').select('slug, version, changelog, published_at').order('published_at', { ascending: true })
    if (error) erreurSql(error, 'lecture des publications')
    return ((data ?? []) as unknown as { slug: string; version: string; changelog: string | null; published_at: string }[]).map((r) => ({ slug: r.slug, version: r.version, publie: r.published_at, changelog: r.changelog ?? '' }))
  },
  async resumes() {
    // `data->codex` ne descend que l'en-tête du codex ; une base qui ne sait pas
    // traverser le JSON renvoie une erreur, on retombe alors sur `data` entier.
    const lire = (table: string, colonnes: string, extra: string) =>
      sbCodex().from(table).select(`slug, ${extra}, ${colonnes}`)
    const avecRepli = async (table: string, extra: string) => {
      let { data, error } = await lire(table, 'meta:data->codex', extra)
      if (error) ({ data, error } = await lire(table, 'data', extra))
      if (error) erreurSql(error, `résumé des ${table === 'codex_drafts' ? 'brouillons' : 'versions'}`)
      return (data ?? []) as unknown as Array<Record<string, unknown>>
    }
    const entete = (r: Record<string, unknown>) => r.meta ?? (r.data as CodexInput | undefined)?.codex

    const [brouillons, versions] = await Promise.all([
      avecRepli('codex_drafts', 'updated_at'),
      avecRepli('codex_versions', 'version, published_at'),
    ])

    const out = new Map<string, Resume>()
    const de = (slug: string) => {
      const r = out.get(slug) ?? { versions: 0 }
      out.set(slug, r)
      return r
    }
    for (const b of brouillons) de(b.slug as string).brouillon = { codex: entete(b), modifie: b.updated_at as string }
    // la publication courante est la plus récente : on trie ici plutôt que de demander une requête par slug
    const parDate = [...versions].sort((a, b) => +new Date(a.published_at as string) - +new Date(b.published_at as string))
    const revs = new Map<string, Set<string>>()
    for (const v of parDate) {
      const slug = v.slug as string
      const r = de(slug)
      const vues = revs.get(slug) ?? new Set<string>()
      vues.add(v.version as string)
      revs.set(slug, vues)
      r.versions = vues.size
      r.publie = { version: v.version as string, codex: entete(v) }
    }
    return out
  },
  async publier(slug, v) {
    const { error } = await sbCodex().from('codex_versions').insert({ slug, version: v.version, changelog: v.changelog, data: v.data, published_at: v.publie })
    if (error) erreurSql(error, 'publication')
  },
  async attacherPdf(slug, version, pdf_url) {
    const { error } = await sbCodex().from('codex_versions').update({ pdf_url }).eq('slug', slug).eq('version', version)
    if (error) erreurSql(error, 'enregistrement du PDF figé')
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
  /** Fiche `armies` rattachée, quand le codex en désigne une. */
  armee_id?: string
  faction: string
  version: string
  statut: string
  couleur?: string
  /** D'où vient ce qui est affiché : une version publiée, le fichier de départ, ou rien d'autre que le brouillon. */
  source: 'yaml' | 'publie' | 'brouillon'
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

/**
 * Codex publié seul (dernière version publiée, sinon YAML), sans ses alliés.
 * `version` : une REV précise de l'historique.
 */
async function lireCodexSeul(slug: string, version?: string): Promise<Codex> {
  verifierSlug(slug)
  if (version) {
    const v = await depot().version(slug, version)
    if (!v) throw new Error(`version introuvable : ${slug} ${version}`)
    return chargerCodex(v.data)
  }
  const publie = await depot().publie(slug)
  if (publie) return chargerCodex(publie.data)
  const yaml = await lireYaml(slug)
  if (yaml == null) throw new Error(`codex introuvable : ${slug}`)
  return chargerCodex(yaml)
}

/**
 * Lectures d'alliés partagées entre plusieurs codex d'un même traitement.
 * `adeptus-titanicus` est allié de treize codex : sans ce cache, construire la
 * liste publique le relit treize fois, avec autant de parse complets.
 */
export type CacheAllies = Map<string, Promise<Codex>>
export const cacheAllies = (): CacheAllies => new Map()

/** Fusionne les codex alliés (versions publiées) dans un codex. */
export async function avecAllies(codex: Codex, cache?: CacheAllies): Promise<Codex> {
  const refs = alliesReferences(codex)
  if (!refs.length) return codex
  const lire = (a: string) => {
    if (!cache) return lireCodexSeul(a)
    let p = cache.get(a)
    if (!p) { p = lireCodexSeul(a); cache.set(a, p) }
    return p
  }
  // les alliés ne dépendent pas les uns des autres : les lire ensemble, pas en file
  const charges = await Promise.all(refs.map(async (a) => {
    try { return [a, await lire(a)] as const } catch { throw new Error(`Codex allié introuvable : ${a}`) }
  }))
  return fusionnerAllies(codex, Object.fromEntries(charges))
}

/**
 * Codex tel que le public le voit : version publiée + formations des alliés.
 * Attention : une version passée est relue avec les alliés **du jour**, pas ceux de l'époque.
 */
export async function lireCodex(slug: string, version?: string, cache?: CacheAllies): Promise<Codex> {
  return avecAllies(await lireCodexSeul(slug, version), cache)
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

export interface ResumePublications {
  slug: string
  /** Date de la publication la plus récente. */
  publie: string
  /** Numéro de la REV la plus récemment publiée. */
  version: string
  /** Texte qui accompagne cette REV, tel que les joueurs le lisent dans l'historique. */
  changelog: string
  /** Combien de REV distinctes ont été publiées, pas leur numéro : republier la même REV ne compte pas deux fois. */
  revs: number
}

/**
 * Publications de tous les codex, résumées par slug.
 * La liste des armées s'en sert pour son badge « New » : elle a besoin de la date,
 * mais aussi du nombre de REV, parce que la première est une transcription et pas une nouveauté.
 */
export async function resumerPublications(): Promise<ResumePublications[]> {
  const parSlug = new Map<string, Map<string, { publie: string; changelog: string }>>()
  for (const p of await depot().publications()) {
    const versions = parSlug.get(p.slug) ?? new Map<string, { publie: string; changelog: string }>()
    const connue = versions.get(p.version)
    // republier une REV écrase la précédente : c'est la dernière parution qui compte
    if (!connue || +new Date(connue.publie) < +new Date(p.publie)) versions.set(p.version, { publie: p.publie, changelog: p.changelog })
    parSlug.set(p.slug, versions)
  }
  return [...parSlug].map(([slug, versions]) => {
    const parDate = [...versions].sort((a, b) => +new Date(b[1].publie) - +new Date(a[1].publie))
    const [version, derniere] = parDate[0]!
    return { slug, publie: derniere.publie, version, changelog: derniere.changelog, revs: versions.size }
  })
}

/**
 * Compose le PDF d'une version publiée et le dépose sur R2, une fois pour toutes.
 * Best-effort : appelé après une publication, son échec ne remet pas la publication en cause.
 */
export async function figerPdfVersion(origine: string, slug: string, version: string): Promise<string | null> {
  verifierSlug(slug)
  const config = useRuntimeConfig()
  if (!config.r2AccountId || !config.r2BucketName) return null
  const pdf = await genererPdfCodex(origine, slug, { version })
  const cle = `codex/${slug}/${slug}-v${version.replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`
  const url = await uploadToR2(cle, pdf, 'application/pdf')
  await depot().attacherPdf(slug, version, url)
  return url
}

/**
 * Oublie les réponses gardées en cache qui décrivent la version publiée d'un codex.
 * `/api/admin/codex` n'est pas caché : sans ça, l'admin annonce la nouvelle version
 * pendant que la fiche, la liste et l'aperçu PDF servent encore l'ancienne, jusqu'à une minute.
 *
 * Nitro range une réponse de `defineCachedEventHandler` sous `nitro:handlers:<nom>:<clé>.json`
 * dans le stockage `cache`, après avoir passé la clé à la moulinette `escapeKey`, qui efface
 * tout ce qui n'est pas alphanumérique : `adepta-sororitas:courant` devient `adeptasororitascourant`.
 */
const cleCache = (nom: string, cle: string) => `nitro:handlers:${nom}:${cle.replace(/\W/g, '')}.json`

export async function oublierCacheCodex(slug: string): Promise<void> {
  const cache = useStorage('cache')
  const cles = [
    // les clés `<slug>:<version>` ne bougent plus : seule la courante est à oublier
    cleCache('codex-fiche', `${slug}:courant`),
    cleCache('codex-liste', 'v1'),
    cleCache('codex-publications', 'v1'),
  ]
  await Promise.all(cles.map((k) => cache.removeItem(k).catch(() => { /* pas de cache monté */ })))
}

/**
 * Oublie les listes d'armées gardées en cache. Publier un codex réécrit la fiche
 * `armies` liée : sans ça, `/armees` garde l'ancien nom ou l'ancien statut jusqu'à
 * cinq minutes. La clé dépend de la faction, du statut et du tag demandés, donc on
 * balaie tout le préfixe plutôt que d'énumérer les combinaisons.
 */
export async function oublierCacheArmees(): Promise<void> {
  const cache = useStorage('cache')
  try {
    // `getKeys` ne fait que du préfixe suivi de « : » : demander « armies » rate
    // « armies-recentes » (l'accueil) et « armie » (une fiche). On balaie donc
    // les handlers et on filtre nous-mêmes.
    const cles = (await cache.getKeys('nitro:handlers')).filter((k) => k.startsWith('nitro:handlers:armie'))
    await Promise.all(cles.map((k) => cache.removeItem(k).catch(() => {})))
  } catch { /* pas de cache monté */ }
}


export async function etatsCodex(): Promise<EtatCodex[]> {
  const d = depot()
  // Les résumés arrivent en une passe : avant, chaque slug coûtait trois requêtes,
  // et chacune rapatriait le contenu complet du codex pour n'en lire que l'en-tête.
  const [slugs, resumes] = await Promise.all([listerSlugsCodex(), d.resumes()])
  return Promise.all(slugs.map(async (slug) => {
    const r = resumes.get(slug)
    // Sans publication, le YAML est la source affichée : encore faut-il qu'il existe.
    // Un codex créé dans l'admin et jamais publié n'en a pas, et se faisait annoncer « fichier de départ ».
    const yaml = r?.publie ? null : (await lireYaml(slug)) as CodexInput | null
    const src = r?.publie?.codex ?? yaml?.codex ?? r?.brouillon?.codex
    const c = CodexSchema.shape.codex.safeParse(src)
    const meta = c.success ? c.data : { nom: slug, armee_id: undefined, faction: '?', version: '?', statut: 'experimental', couleur: undefined, type: 'armee' as const }
    return {
      slug,
      nom: (r?.brouillon?.codex as { nom?: string } | undefined)?.nom ?? meta.nom,
      armee_id: meta.armee_id,
      faction: meta.faction,
      version: r?.publie?.version ?? meta.version,
      statut: meta.statut,
      couleur: meta.couleur,
      source: r?.publie ? 'publie' : yaml ? 'yaml' : 'brouillon',
      brouillon: !!r?.brouillon,
      brouillon_modifie: r?.brouillon?.modifie,
      versions: r?.versions ?? 0,
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
