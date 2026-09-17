import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { chargerCodex, type Codex } from './schema'
import { fusionnerAllies, alliesReferences } from './allies'

/** Dossier des codex YAML (source de vérité). Accès fichier : tests et scripts. Le serveur passe par server/utils/codex.ts. */
export const DOSSIER_CODEX = fileURLToPath(new URL('../../content/codex/', import.meta.url))

export function listerSlugs(): string[] {
  return readdirSync(DOSSIER_CODEX)
    .filter((f) => f.endsWith('.yaml'))
    .map((f) => f.replace(/\.yaml$/, ''))
    .sort()
}

/** Codex seul, sans ses alliés (tel qu'écrit dans le YAML). */
export function chargerCodexBrut(slug: string): Codex {
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error(`slug invalide : ${slug}`)
  const brut = parse(readFileSync(join(DOSSIER_CODEX, `${slug}.yaml`), 'utf8'))
  return chargerCodex(brut)
}

/** Codex complet : les formations des codex alliés sont fusionnées dans ses sections. */
export function chargerCodexParSlug(slug: string): Codex {
  const codex = chargerCodexBrut(slug)
  const allies: Record<string, Codex> = {}
  for (const a of alliesReferences(codex)) allies[a] = chargerCodexBrut(a)
  return fusionnerAllies(codex, allies)
}

export function chargerTous(): Codex[] {
  return listerSlugs().map(chargerCodexParSlug)
}
