import { parse } from 'yaml'
import { CodexSchema, chargerCodex, type Codex, type CodexInput } from '~~/shared/codex/schema'

/**
 * Sources d'un codex, par priorité : version publiée (stockage) > YAML embarqué.
 * Les brouillons vivent à côté, jamais servis au public sans `?brouillon=1`.
 * Le stockage `data` est un dossier en dev ; en prod il sera remplacé par Supabase (même interface).
 */
const assets = () => useStorage('assets:codex')
const data = () => useStorage('data')

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
}

async function lireYaml(slug: string): Promise<unknown | null> {
  const brut = await assets().getItem<string>(`${slug}.yaml`)
  return brut == null ? null : parse(typeof brut === 'string' ? brut : String(brut))
}

export async function listerSlugsCodex(): Promise<string[]> {
  const yaml = (await assets().getKeys()).filter((k) => k.endsWith('.yaml')).map((k) => k.replace(/\.yaml$/, ''))
  const publies = (await data().getKeys('codex:publie')).map((k) => k.split(':').pop()!)
  const brouillons = (await data().getKeys('codex:brouillon')).map((k) => k.split(':').pop()!)
  return [...new Set([...yaml, ...publies, ...brouillons])].sort()
}

/** Codex tel que le public le voit (publié, sinon YAML). */
export async function lireCodex(slug: string): Promise<Codex> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
  const publie = await data().getItem<CodexInput>(`codex:publie:${slug}`)
  if (publie) return chargerCodex(publie)
  const yaml = await lireYaml(slug)
  if (yaml == null) throw new Error(`codex introuvable : ${slug}`)
  return chargerCodex(yaml)
}

/** Brouillon brut (non validé) ; s'il n'existe pas, part du codex public. */
export async function lireBrouillon(slug: string): Promise<{ data: CodexInput; modifie?: string; existe: boolean }> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
  const b = await data().getItem<{ data: CodexInput; modifie: string }>(`codex:brouillon:${slug}`)
  if (b) return { ...b, existe: true }
  const base = (await data().getItem<CodexInput>(`codex:publie:${slug}`)) ?? (await lireYaml(slug))
  if (base == null) throw new Error(`codex introuvable : ${slug}`)
  return { data: base as CodexInput, existe: false }
}

export async function ecrireBrouillon(slug: string, brut: CodexInput): Promise<void> {
  await data().setItem(`codex:brouillon:${slug}`, { data: brut, modifie: new Date().toISOString() })
}

export async function supprimerBrouillon(slug: string): Promise<void> {
  await data().removeItem(`codex:brouillon:${slug}`)
}

/** Publie le brouillon : validation stricte, snapshot versionné, devient la version publique. */
export async function publierBrouillon(slug: string, version: string, changelog: string): Promise<Codex> {
  const b = await lireBrouillon(slug)
  const brut = { ...b.data, codex: { ...b.data.codex, version } }
  const codex = chargerCodex(brut)
  const n = (await data().getKeys(`codex:versions:${slug}`)).length + 1
  await data().setItem(`codex:versions:${slug}:${String(n).padStart(3, '0')}`, { data: brut, version, changelog, publie: new Date().toISOString() })
  await data().setItem(`codex:publie:${slug}`, brut)
  await supprimerBrouillon(slug)
  return codex
}

export async function listerVersions(slug: string) {
  const cles = (await data().getKeys(`codex:versions:${slug}`)).sort()
  return Promise.all(cles.map(async (k) => {
    const v = await data().getItem<{ version: string; changelog: string; publie: string }>(k)
    return { version: v?.version, changelog: v?.changelog, publie: v?.publie }
  }))
}

export async function etatsCodex(): Promise<EtatCodex[]> {
  const slugs = await listerSlugsCodex()
  return Promise.all(slugs.map(async (slug) => {
    const publie = await data().getItem<CodexInput>(`codex:publie:${slug}`)
    const b = await data().getItem<{ data: CodexInput; modifie: string }>(`codex:brouillon:${slug}`)
    const src = publie ?? (await lireYaml(slug)) ?? b?.data
    const c = CodexSchema.shape.codex.safeParse((src as CodexInput | undefined)?.codex)
    const meta = c.success ? c.data : { nom: slug, faction: '?', version: '?', statut: 'experimental', couleur: undefined }
    return {
      slug,
      nom: (b?.data.codex.nom as string) ?? meta.nom,
      faction: meta.faction,
      version: meta.version,
      statut: meta.statut,
      couleur: meta.couleur,
      source: publie ? 'publie' : 'yaml',
      brouillon: !!b,
      brouillon_modifie: b?.modifie,
      versions: (await data().getKeys(`codex:versions:${slug}`)).length,
    }
  }))
}

/** Squelette d'une nouvelle armée. */
export function codexVide(slug: string, nom: string, faction: 'imperium' | 'chaos' | 'xenos'): CodexInput {
  return {
    codex: { slug, nom, version: '0.1', faction, statut: 'experimental', valeur_strategique: 2, initiative: { defaut: '2+', exceptions: [] }, regles_md: [] },
    budgets: [{ id: 'rare', libelle: 'Supports', capacite: { source: 'ratio_points', ratio: 0.3334, base: 'limite_liste' }, phrase_pdf: "Jusqu'à 1/3 des points disponibles peuvent être dépensés pour ces formations" }],
    unites: [],
    options: [],
    formations: [],
    sections: [
      { id: 'principales', titre: `FORMATIONS PRINCIPALES`, formations: [], contraintes: [], options: [], notes: {} },
      { id: 'supports', titre: `SUPPORTS`, formations: [], contraintes: [{ type: 'consomme', budget: 'rare', quoi: 'points' }], options: [], notes: {} },
    ],
    listes_test: [],
  }
}
