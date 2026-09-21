import type { InjectionKey, Ref } from 'vue'
import type { CodexInput } from '~~/shared/codex/schema'

/** Brouillon d'un codex partagé entre la page admin et ses onglets (édité en place). */
export const CLE_BROUILLON: InjectionKey<Ref<CodexInput>> = Symbol('brouillon-codex')

export function useBrouillonCodex(): Ref<CodexInput> {
  const b = inject(CLE_BROUILLON)
  if (!b) throw new Error('Brouillon de codex non fourni')
  return b
}

/** Identifiant snake_case depuis un nom. */
export function slugifier(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '') || 'x'
}

/** Identifiant unique dans une liste. */
export function idUnique(base: string, existants: Array<{ id: string }>): string {
  let id = base
  let n = 2
  while (existants.some((e) => e.id === id)) id = `${base}_${n++}`
  return id
}
