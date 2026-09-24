import { describe, it, expect } from 'vitest'
import { listerSlugs, chargerCodexParSlug, chargerCodexBrut } from '../shared/codex/charger'
import { chargerCodex } from '../shared/codex/schema'
import { indexerCodex, calculerListe, varianteParDefaut, resoudreFormation, plafondFormation } from '../shared/codex/engine'
import { normaliserFormation } from '../shared/codex/liste'
import { enrichir } from '../shared/codex/markdown'
import { texteArmesPossibles } from '../shared/codex/phrases'
import { trierParType, lignesComplementaires, requeteOptionsPdf, lireOptionsPdf, OPTIONS_PDF_DEFAUT } from '../shared/codex/pdf'

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

describe('armes possibles derrière une ligne générique', () => {
  const idx = indexerCodex(chargerCodexParSlug('legions-titaniques'))
  const arme = (uniteId: string, nom: string) => idx.unites.get(uniteId)!.armes.find((a) => a.nom === nom)!

  it('la carapace du Reaver ne propose pas les armes réservées aux bras', () => {
    const texte = texteArmesPossibles(idx, arme('titan_reaver', 'Armes de Carapace'))
    expect(texte).toContain('Lance-roquettes Apocalypse (25 pts)')
    expect(texte).toContain('Destructeur Turbo Laser (25 pts)')
    expect(texte).not.toContain('Poing de Combat')
  })

  it('les bras du Reaver proposent les armes d\'assaut, pas les missiles de carapace', () => {
    const texte = texteArmesPossibles(idx, arme('titan_reaver', '2x Armes de Bras'))
    expect(texte).toContain('Poing de Combat (gratuit)')
    expect(texte).toContain('Canon Volcano (50 pts)')
    expect(texte).not.toContain('Missile de barrage')
  })

  it('une arme ordinaire ne propose rien', () => {
    expect(texteArmesPossibles(idx, arme('titan_imperator', 'Canon Fournaise'))).toBe('')
  })
})

describe('mise en forme et composition du PDF', () => {
  it('gras et italique deviennent du HTML sûr', () => {
    expect(enrichir('Une **règle** en *italique*')).toBe('Une <strong>règle</strong> en <em>italique</em>')
    expect(enrichir('Le _Warhound_ et __le Reaver__')).toBe('Le <em>Warhound</em> et <strong>le Reaver</strong>')
    expect(enrichir('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
    expect(enrichir('nom_de_fichier.yaml')).toBe('nom_de_fichier.yaml')
  })

  it('les unités sont triées par type', () => {
    const u = (id: string, type: string) => ({ id, nom: id, type, armes: [], notes: [], roles: [] })
    const tri = trierParType([u('a', 'VS'), u('b', 'Inf'), u('c', 'Perso'), u('d', 'EG'), u('e', 'Truc'), u('f', 'VB')])
    expect(tri.map((x) => x.id)).toEqual(['c', 'b', 'f', 'd', 'a', 'e'])
  })

  it('les lignes de bas de fiche omettent ce qui est vide', () => {
    const base = { id: 'x', nom: 'X', type: 'Inf', armes: [], notes: [], roles: [] }
    expect(lignesComplementaires(base as never)).toEqual([])
    const complet = { ...base, notes: ['Sans peur'], degats: { cd: 3, bi: 2, critique: 'Explose' } }
    expect(lignesComplementaires(complet as never).map((l) => l.label)).toEqual(['Capacité de dommage', 'Critique', 'Notes'])
    expect(lignesComplementaires(complet as never, true)[0]).toEqual({ texte: 'CD 3 / BI 2' })
  })

  it('la query string ne porte que ce qui diffère du défaut', () => {
    expect(requeteOptionsPdf(OPTIONS_PDF_DEFAUT)).toBe('')
    expect(requeteOptionsPdf({ ...OPTIONS_PDF_DEFAUT, profils: true, orientation: 'paysage' })).toBe('?profils=1&orientation=paysage')
    expect(lireOptionsPdf({ couverture: '0', profils: '1' })).toEqual({ couverture: false, profils: true, references: true, orientation: 'portrait' })
  })
})

describe('limite de formations par armée', () => {
  const idx = indexerCodex(chargerCodexParSlug('tyranides'))

  it('une formation « 0-1 » est plafonnée à 1', () => {
    expect(plafondFormation(idx, 'groupe_nexus')).toBe(1)
  })

  it('une formation sans limite renvoie null', () => {
    expect(plafondFormation(idx, 'centre_synaptique')).toBeNull()
  })

  it('dépasser la limite reste une erreur du moteur', () => {
    const f = (id: string) => normaliserFormation({ id, formation: 'groupe_nexus' } as never, (x) => varianteParDefaut(idx, x))
    const res = calculerListe(idx, { id: 'l', nom: 'x', codex: 'tyranides', limite: 3000, formations: [f('a'), f('b')] })
    expect(res.erreurs.map((e) => e.type)).toContain('max_par_armee')
  })
})
