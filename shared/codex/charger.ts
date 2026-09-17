import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { chargerCodex, type Codex } from './schema'

/** Dossier des codex YAML (source de vérité). Accès fichier : tests et scripts. Le serveur passe par server/utils/codex.ts. */
export const DOSSIER_CODEX = fileURLToPath(new URL('../../content/codex/', import.meta.url))

export function listerSlugs(): string[] {
  return readdirSync(DOSSIER_CODEX)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort()
}

export function chargerCodexParSlug(slug: string): Codex {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
  const brut = parse(readFileSync(join(DOSSIER_CODEX, `${slug}.yaml`), 'utf8'))
  return chargerCodex(brut)
}

export function chargerTous(): Codex[] {
  return listerSlugs().map(chargerCodexParSlug)
}
