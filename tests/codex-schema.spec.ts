import { describe, it, expect } from 'vitest'
import { listerSlugs, chargerCodexParSlug } from '../shared/codex/charger'

describe('codex YAML : schéma et références', () => {
  for (const slug of listerSlugs()) {
    it(`${slug} est valide`, () => {
      const codex = chargerCodexParSlug(slug)
      expect(codex.codex.slug).toBe(slug)
      expect(codex.unites.length).toBeGreaterThan(0)
      expect(codex.formations.length).toBeGreaterThan(0)
    })
  }
})
