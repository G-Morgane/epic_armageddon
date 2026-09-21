import { describe, it, expect } from 'vitest'
import { listerSlugs, chargerCodexParSlug, chargerCodexBrut } from '../shared/codex/charger'
import { chargerCodex } from '../shared/codex/schema'
import { indexerCodex, calculerListe, varianteParDefaut, resoudreFormation } from '../shared/codex/engine'
import { normaliserFormation } from '../shared/codex/liste'

describe('moteur : listes de test des codex', () => {
  for (const slug of listerSlugs()) {
    const codex = chargerCodexParSlug(slug)
    if (!codex.listes_test.length) continue
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

describe('moteur : armes en amélioration (sans unité)', () => {
  const brut = chargerCodexBrut('adeptus-titanicus') as any
  brut.options = [
    {
      id: 'bras_reaver', nom: 'Armement de Bras',
      effet: { type: 'choix', parmi: [{ id: 'poing', nom: 'Poing de Combat', cout: 0 }, { id: 'gatling', nom: 'Canon Gatling', cout: 25 }, { id: 'volcano', nom: 'Canon Volcano', cout: 50 }] },
      contraintes: [{ type: 'max_par_formation', valeur: 2 }],
    },
    { id: 'multilaser', nom: 'Multi-Laser de Carapace', effet: { type: 'mot_cle', texte: 'Multi-Laser de Carapace', cout: 25 }, contraintes: [{ type: 'max_par_formation', valeur: 1 }] },
  ]
  brut.formations.find((f: any) => f.id === 'titan_reaver').options = ['bras_reaver', 'multilaser']
  const idx = indexerCodex(chargerCodex(brut))
  const reaver = (options: object[]) => ({ id: 'f', formation: 'titan_reaver', variante: 'base', sous_formations: [], options: options.map((o, i) => ({ id: `o${i}`, ...o })) })

  it('deux bras et une carapace : coûts additionnés, mot-clé affiché', () => {
    const r = resoudreFormation(idx, reaver([{ option: 'bras_reaver', choix: 'gatling' }, { option: 'bras_reaver', choix: 'volcano' }, { option: 'multilaser' }]) as any)
    expect(r.erreurs).toEqual([])
    expect(r.cout).toBe(650 + 25 + 50 + 25)
    expect(r.mots_cles).toContain('Multi-Laser de Carapace')
    expect(r.options.map((o) => o.libelle)).toContain('Armement de Bras : Canon Volcano')
  })

  it('un troisième bras est refusé', () => {
    const r = resoudreFormation(idx, reaver([{ option: 'bras_reaver', choix: 'poing' }, { option: 'bras_reaver', choix: 'poing' }, { option: 'bras_reaver', choix: 'gatling' }]) as any)
    expect(r.erreurs.map((e) => e.message)).toContain('Armement de Bras : au plus 2 fois par formation')
  })
})
