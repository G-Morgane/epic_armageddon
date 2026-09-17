import { parse } from 'yaml'
import { chargerCodex, type Codex } from '~~/shared/codex/schema'

/** Codex YAML servis comme assets Nitro (voir nuxt.config `nitro.serverAssets`). */
const stockage = () => useStorage('assets:codex')

export async function listerSlugsCodex(): Promise<string[]> {
  const cles = await stockage().getKeys()
  return cles.filter((k) => k.endsWith('.yaml')).map((k) => k.replace(/\.yaml$/, '')).sort()
}

export async function lireCodex(slug: string): Promise<Codex> {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
  const brut = await stockage().getItem<string>(`${slug}.yaml`)
  if (brut == null) throw new Error(`codex introuvable : ${slug}`)
  return chargerCodex(parse(typeof brut === 'string' ? brut : String(brut)))
}
