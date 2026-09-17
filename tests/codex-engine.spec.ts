import { describe, it, expect } from 'vitest'
import { listerSlugs, chargerCodexParSlug } from '../shared/codex/charger'
import { indexerCodex, calculerListe, varianteParDefaut } from '../shared/codex/engine'
import { normaliserFormation } from '../shared/codex/liste'

describe('moteur : listes de test des codex', () => {
  for (const slug of listerSlugs()) {
    const codex = chargerCodexParSlug(slug)
    const idx = indexerCodex(codex)
    describe(slug, () => {
      for (const test of codex.listes_test) {
        it(`${test.nom} (${test.attendu})`, () => {
          const liste = {
            id: 't', nom: test.nom, codex: slug, limite: test.limite,
            formations: test.formations.map((f) => normaliserFormation(f as any, (id) => varianteParDefaut(idx, id))),
          }
          const res = calculerListe(idx, liste)
          const detail = res.erreurs.map((e) => `[${e.type}] ${e.message}`).join('\n')
          if (test.attendu === 'valide') {
            expect(res.valide, `attendu valide, erreurs :\n${detail}`).toBe(true)
          } else {
            expect(res.valide, 'attendu refusée, aucune erreur').toBe(false)
            if (test.erreur) expect(res.erreurs.map((e) => e.type), `erreurs :\n${detail}`).toContain(test.erreur)
          }
        })
      }
    })
  }
})
