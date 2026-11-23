import { describe, it, expect } from 'vitest'
import { listerSlugs, chargerCodexParSlug, chargerCodexBrut } from '../shared/codex/charger'
import { chargerCodex } from '../shared/codex/schema'
import { indexerCodex, calculerListe, calculerListeTest, varianteParDefaut, resoudreFormation, plafondRepartition, cleRepartition, plafondFormation, emplacementsSatures, formationAutorisee } from '../shared/codex/engine'
import { parserComposition, formaterComposition } from '../shared/codex/parser'
import { normaliserFormation } from '../shared/codex/liste'
import { enrichir } from '../shared/codex/markdown'
import { texteArmesPossibles, coutOption, lignesOption } from '../shared/codex/phrases'
import { trierParType, lignesComplementaires, requeteOptionsPdf, lireOptionsPdf, OPTIONS_PDF_DEFAUT } from '../shared/codex/pdf'

describe('moteur : listes de test des codex', () => {
  for (const slug of listerSlugs()) {
    const codex = chargerCodexParSlug(slug)
    if (!codex.listes_test.length) continue
    const idx = indexerCodex(codex)
    describe(slug, () => {
      for (const test of codex.listes_test) {
        it(`${test.nom} (${test.attendu})`, () => {
          const res = calculerListeTest(idx, test, slug)
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

describe('moteur : emplacements des armes de titan', () => {
  const idx = indexerCodex(chargerCodexParSlug('legions-titaniques'))
  const reaver = (choix: string[]) => resoudreFormation(idx, { id: 'f', formation: 'titan_reaver', variante: 'base', choix: {}, sous_formations: [], options: choix.map((c, i) => ({ id: `o${i}`, option: 'armement_reaver', choix: c })) } as any)

  it('deux armes de bras et une de carapace passent', () => {
    expect(reaver(['poing_combat', 'canon_volcano', 'missile_barrage']).erreurs).toEqual([])
  })

  it('une arme sans emplacement complète les bras ou la carapace', () => {
    expect(reaver(['poing_combat', 'canon_gatling', 'destructeur_turbo_laser']).erreurs).toEqual([])
  })

  it('trois armes de bras sont refusées', () => {
    const r = reaver(['poing_combat', 'poing_combat', 'canon_volcano'])
    expect(r.erreurs.map((e) => e.message)).toContain('Armement du Reaver : au plus 2 arme(s) de bras')
  })

  it('deux armes de carapace sont refusées', () => {
    const r = reaver(['missile_barrage', 'lance_roquettes_apocalypse', 'poing_combat'])
    expect(r.erreurs.map((e) => e.message)).toContain('Armement du Reaver : au plus 1 arme(s) de carapace')
  })

  it('l\'UI masque les armes d\'un emplacement plein, sauf celle déjà choisie', () => {
    const fi = { id: 'f', formation: 'titan_reaver', variante: 'base', choix: {}, sous_formations: [], options: [
      { id: 'a', option: 'armement_reaver', choix: 'poing_combat' },
      { id: 'b', option: 'armement_reaver', choix: 'canon_volcano' },
      { id: 'c', option: 'armement_reaver', choix: 'canon_gatling' },
    ] } as any
    expect(emplacementsSatures(idx, fi, fi.options[2])).toEqual(['bras'])
    expect(emplacementsSatures(idx, fi, fi.options[0])).toEqual([])
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

  it('le profil de l\'arme suit son nom et son coût', () => {
    const texte = texteArmesPossibles(idx, arme('titan_reaver', '2x Armes de Bras'))
    expect(texte).toContain('Canon à Plasma (25 pts) : 60cm, 3xMA2+, Rchg')
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
    expect(lireOptionsPdf({ couverture: '0', profils: '1' })).toEqual({ couverture: false, profils: true, references: true, abreviations: false, orientation: 'portrait' })
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

describe('coût des options à choix', () => {
  it("affiche le coût porté par l'effet de chaque choix", () => {
    const idx = indexerCodex(chargerCodexParSlug('eldars-d-iyanden'))
    expect(coutOption(idx.options.get('fantomes')!)).toBe('+25 pts / 50 pts chacun / 75 pts')
    expect(coutOption(idx.options.get('seigneurs_fantomes')!)).toBe('+25 pts / 175 pts')
  })

  it('un retour à la ligne dans la phrase du PDF donne une ligne par choix', () => {
    const idx = indexerCodex(chargerCodexParSlug('adepta-sororitas'))
    const o = idx.options.get('repressor')!
    expect(lignesOption(idx, o)).toEqual([{ texte: o.phrase_pdf, cout: '50 pts / 75 pts' }])
    const deux = { ...o, phrase_pdf: 'Ajouter 3 Repressors\nAjouter 4 Repressors' }
    expect(lignesOption(idx, deux)).toEqual([{ texte: 'Ajouter 3 Repressors', cout: '50 pts' }, { texte: 'ajouter 4 Repressors', cout: '75 pts' }])
    const trois = { ...o, phrase_pdf: 'a\nb\nc' }
    expect(lignesOption(idx, trois).map((l) => l.cout)).toEqual(['50 pts / 75 pts', '', ''])
  })

  it('une phrase saisie se coupe sur chaque « ou » qui sépare deux choix', () => {
    const idx = indexerCodex(chargerCodexParSlug('adepta-sororitas'))
    expect(lignesOption(idx, idx.options.get('superieure')!)).toEqual([
      { texte: 'Ajouter un personnage de Palatine à la formation', cout: '50 pts' },
      { texte: 'ajouter un personnage de Chanoinesse à la formation (1 maximum par armée)', cout: '75 pts' },
    ])
    const o = idx.options.get('superieure')!
    // une quantité, « inférieur ou égal » et ce qu'on remplace ne coupent pas
    for (const phrase of ['Ajouter 1 ou 2 Palatines', 'Ajouter des Palatines au mouvement inférieur ou égal à 15cm', 'Remplacer la Palatine ou la Chanoinesse par une Sainte']) {
      expect(lignesOption(idx, { ...o, phrase_pdf: phrase }).map((l) => l.texte)).toEqual([phrase])
    }
  })

  it('sans phrase saisie, une option à choix exclusifs donne une ligne par choix', () => {
    const idx = indexerCodex(chargerCodexParSlug('adepta-sororitas'))
    const o = { ...idx.options.get('repressor')!, phrase_pdf: undefined }
    expect(lignesOption(idx, o)).toEqual([{ texte: 'Ajouter 3 Repressors', cout: '50 pts' }, { texte: 'ajouter 4 Repressors', cout: '75 pts' }])
  })

  it("ne compte le coût d'un choix qu'une fois (Iyanden rework)", () => {
    const idx = indexerCodex(chargerCodexParSlug('eldars-d-iyanden-rework'))
    const f = normaliserFormation({ id: 'o', formation: 'ost_fantomes', choix: { '0': { garde_fantome: 1, guerrier_fantome: 1 } }, options: [{ option: 'fantomes', choix: 'gardes', quantite: 2 }, { option: 'firestorm_opt', choix: 'ajout' }] } as never, (x) => varianteParDefaut(idx, x))
    const res = calculerListe(idx, { id: 'l', nom: 'x', codex: 'eldars-d-iyanden-rework', limite: 3000, formations: [f] })
    const avant = calculerListe(idx, { id: 'l', nom: 'x', codex: 'eldars-d-iyanden-rework', limite: 3000, formations: [{ ...f, options: [] }] })
    expect(res.total - avant.total).toBe(2 * 50 + 75)
  })
})

describe('allégeance et choix d\'une seule sorte (Égarés et Damnés)', () => {
  const brut = chargerCodexBrut('egares-et-damnes') as any
  brut.codex.allegeances = [{ id: 'khorne', nom: 'Khorne' }, { id: 'nurgle', nom: 'Nurgle' }, { id: 'slaanesh', nom: 'Slaanesh' }]
  const dieux: Record<string, string> = { buveur_sang: 'khorne', sanguinaires: 'khorne', seigneur_bataille: 'khorne', grand_immonde: 'nurgle', portepestes: 'nurgle', demonettes: 'slaanesh', titan_subjugator: 'slaanesh', titan_questor: 'slaanesh' }
  for (const u of brut.unites) if (dieux[u.id]) u.allegeance = dieux[u.id]
  const titan = brut.formations.find((f: any) => f.id === 'titan_leger_demoniaque')
  titan.variantes[0].composition[0].choix.une_seule_sorte = true
  const idx = indexerCodex(brut)
  const f = (formation: string, choix?: Record<string, Record<string, number>>) => normaliserFormation({ formation, choix } as never, (x) => varianteParDefaut(idx, x))
  const liste = (allegeance: string | undefined, ...formations: ReturnType<typeof f>[]) => calculerListe(idx, { id: 'l', nom: 'x', codex: 'egares-et-damnes', limite: 3000, allegeance, formations })

  it('refuse des démons de plusieurs dieux dans une même armée', () => {
    const res = liste('khorne', f('demons_mineurs', { '0': { sanguinaires: 4, portepestes: 4 } }))
    expect(res.erreurs.map((e) => e.message).join()).toContain('Portepestes')
    expect(res.erreurs.filter((e) => e.type === 'allegeance').map((e) => e.message).join()).toContain('ne mélange pas')
  })

  it('accepte une armée qui reste dans son allégeance', () => {
    const res = liste('khorne', f('demons_mineurs', { '0': { sanguinaires: 8 } }), f('seigneurs_batailles'))
    expect(res.erreurs.filter((e) => e.type === 'allegeance')).toEqual([])
  })

  it("demande l'allégeance dès qu'une unité marquée est prise", () => {
    expect(liste(undefined, f('demons_mineurs', { '0': { sanguinaires: 8 } })).erreurs.map((e) => e.type)).toContain('allegeance')
  })

  it("retire du catalogue les formations d'un autre dieu", () => {
    expect(formationAutorisee(idx, 'nurgle', 'seigneurs_batailles')).toBe(false)
    expect(formationAutorisee(idx, 'khorne', 'seigneurs_batailles')).toBe(true)
    expect(formationAutorisee(idx, 'nurgle', 'demons_mineurs')).toBe(true)
  })

  it('refuse Questor et Subjugator dans la même formation', () => {
    const mixte = resoudreFormation(idx, f('titan_leger_demoniaque', { '0': { titan_questor: 1, titan_subjugator: 1 } }))
    expect(mixte.erreurs.map((e) => e.message).join()).toContain("une seule sorte")
    const deux = resoudreFormation(idx, f('titan_leger_demoniaque', { '0': { titan_questor: 2 } }))
    expect(deux.erreurs).toEqual([])
  })

  describe('plusieurs allégeances (Word Bearers, Black Legion)', () => {
    const multi = indexerCodex({ ...idx.codex, codex: { ...idx.codex.codex, allegeances_max: 2, allegeances_incompatibles: [['khorne', 'slaanesh']] } })
    const listeM = (allegeances: string[], ...formations: ReturnType<typeof f>[]) => calculerListe(multi, { id: 'l', nom: 'x', codex: 'egares-et-damnes', limite: 3000, allegeances, formations })
    const erreursA = (r: ReturnType<typeof listeM>) => r.erreurs.filter((e) => e.type === 'allegeance').map((e) => e.message)

    it('accepte deux allégeances, chaque formation restant pure', () => {
      expect(erreursA(listeM(['khorne', 'nurgle'], f('demons_mineurs', { '0': { sanguinaires: 8 } }), f('demons_mineurs', { '0': { portepestes: 8 } })))).toEqual([])
    })
    it('refuse deux dieux dans une même formation', () => {
      expect(erreursA(listeM(['khorne', 'nurgle'], f('demons_mineurs', { '0': { sanguinaires: 4, portepestes: 4 } }))).join()).toContain('ne mélange pas')
    })
    it('refuse une paire interdite et un nombre trop grand', () => {
      expect(erreursA(listeM(['khorne', 'slaanesh'])).join()).toContain('ne peuvent pas servir')
      expect(erreursA(listeM(['khorne', 'nurgle', 'slaanesh'])).join()).toContain('Au plus 2')
    })
    it('catalogue : une formation passe si une des allégeances la permet', () => {
      expect(formationAutorisee(multi, ['nurgle', 'khorne'], 'seigneurs_batailles')).toBe(true)
      expect(formationAutorisee(multi, ['nurgle'], 'seigneurs_batailles')).toBe(false)
    })
    it('une liste de test sans allégeance prend celles de ses unités', () => {
      const t = { nom: 't', limite: 3000, attendu: 'valide' as const, formations: [{ formation: 'demons_mineurs', choix: { '0': { sanguinaires: 8 } } }] }
      expect(erreursA(calculerListeTest(multi, t))).toEqual([])
    })
  })

  it('« + transports parmi » : aucune unité, profils gardés', () => {
    const r = parserComposition('6 Gardes Impériaux, + transports parmi Rhino, Chimère', [
      { id: 'garde', nom: 'Gardes Impériaux' }, { id: 'rhino', nom: 'Rhino' }, { id: 'chimere', nom: 'Chimère' },
    ] as never)
    expect(r.erreurs).toEqual([])
    expect(r.lignes[1]).toEqual({ transports_possibles: { unites: ['rhino', 'chimere'] } })
    expect(formaterComposition(r.lignes, [{ id: 'rhino', nom: 'Rhino' }, { id: 'chimere', nom: 'Chimère' }] as never)).toContain('+ transports parmi Rhino, Chimère')
  })

  it('le texte de composition lit et réécrit « d\'une seule sorte parmi »', () => {
    const r = parserComposition("1 à 2 d'une seule sorte parmi Titan Subjugator (250), Titan Questor (275)", idx.codex.unites)
    expect(r.erreurs).toEqual([])
    expect(r.lignes[0]).toMatchObject({ choix: { une_seule_sorte: true, total: { min: 1, max: 2 } } })
    expect(formaterComposition(r.lignes, idx.codex.unites)).toContain("d'une seule sorte parmi")
  })
})

describe('règles : tableaux Markdown', () => {
  it('rend un tableau et laisse les autres paragraphes en texte', async () => {
    const { paragraphesEnrichis, estTableau } = await import('../shared/codex/markdown')
    const p = paragraphesEnrichis('Intro **gras**\n\n| Factions | Démons |\n|---|---|\n| Khorne | Sanguinaires |\n| <b> | - |')
    expect(estTableau(p[0]!)).toBe(false)
    expect(p[1]).toBe('<table><thead><tr><th>Factions</th><th>Démons</th></tr></thead><tbody><tr><td>Khorne</td><td>Sanguinaires</td></tr><tr><td>&lt;b&gt;</td><td>-</td></tr></tbody></table>')
  })
})

describe('« Remplacer » à lignes « ou »', () => {
  const brut = chargerCodexBrut('adeptus-astartes') as any
  brut.options.push({
    id: 'speeder_lourd', nom: 'Land Speeders lourds', contraintes: [],
    effet: { type: 'choix', parmi: [
      { id: 'r1', nom: 'Land Speeder Tornado', cout: 0, effet: { type: 'remplacer', de: 'land_speeder', par: 'land_speeder_tornado', lot: 1, max: 5, cout: 5 } },
      { id: 'r2', nom: 'Land Speeder Typhoon', cout: 0, effet: { type: 'remplacer', de: 'land_speeder', par: 'land_speeder_typhoon', lot: 1, max: 5, cout: 15 } },
    ] },
  })
  brut.formations.find((f: any) => f.id === 'land_speeders').options.push('speeder_lourd')
  const idx = indexerCodex(chargerCodex(brut))

  it('le PDF imprime une ligne par remplacement, avec son coût', () => {
    expect(lignesOption(idx, idx.options.get('speeder_lourd')!)).toEqual([
      { texte: 'Remplacer 1 Land Speeder par 1 Land Speeder Tornado', cout: '+5 pts' },
      { texte: 'remplacer 1 Land Speeder par 1 Land Speeder Typhoon', cout: '+15 pts' },
    ])
  })

  it('le moteur remplace selon la ligne choisie', () => {
    const f = normaliserFormation({ formation: 'land_speeders', choix: { '0': { land_speeder: 5 } }, options: [{ option: 'speeder_lourd', choix: 'r2', quantite: 2 }] } as never, (x) => varianteParDefaut(idx, x))
    const r = resoudreFormation(idx, f)
    expect(r.erreurs).toEqual([])
    expect(r.unites.find((u) => u.unite === 'land_speeder_typhoon')?.nombre).toBe(2)
    expect(r.cout_options).toBe(30)
  })
})

describe('PDF : mot en début de ligne d\'amélioration', () => {
  it('coût « Variable » : PDF seulement, phrase gardée telle quelle', async () => {
    const { lignesOption, coutOption, coutOptionPdf } = await import('../shared/codex/phrases')
    const idx = indexerCodex(chargerCodexParSlug('adeptus-astartes'))
    const o = { ...[...idx.options.values()][0]!, cout_variable_pdf: true, phrase_pdf: 'Remplacer par Tornado (5 pts)\nou par Typhoon (15 pts)' }
    expect(lignesOption(idx, o)).toEqual([{ texte: 'Remplacer par Tornado (5 pts)', cout: 'Variable' }, { texte: 'ou par Typhoon (15 pts)', cout: '' }])
    expect(coutOptionPdf(o)).toBe('Variable')
    expect(coutOption(o)).not.toBe('Variable')
  })

  it('« ou » par défaut, « et/ou » ou rien au choix, et respecte ce qui est tapé', async () => {
    const { liaisonLigne } = await import('../shared/codex/phrases')
    expect(liaisonLigne({}, 'Ajouter 2 Rhinos', 0)).toBe('')
    expect(liaisonLigne({}, 'ajouter 2 Rhinos', 1)).toBe('ou')
    expect(liaisonLigne({ liaison_pdf: 'et_ou' }, 'ajouter 2 Rhinos', 1)).toBe('et/ou')
    expect(liaisonLigne({ liaison_pdf: 'aucune' }, 'Ajouter 2 Rhinos', 1)).toBe('')
    expect(liaisonLigne({}, 'et/ou ajouter 2 Rhinos', 1)).toBe('')
    expect(liaisonLigne({}, 'Ou un Capitaine', 1)).toBe('')
  })

  it('sans liaison, la ligne suivante garde sa majuscule', () => {
    const idx = indexerCodex(chargerCodexParSlug('adepta-sororitas'))
    const o = { ...idx.options.get('repressor')!, phrase_pdf: undefined }
    expect(lignesOption(idx, { ...o, liaison_pdf: 'aucune' }).map((l) => l.texte)).toEqual(['Ajouter 3 Repressors', 'Ajouter 4 Repressors'])
  })
})

describe('répartition : paire d\'unités à son propre prix', () => {
  const brut = chargerCodexBrut('eldars-d-iyanden') as any
  brut.options.find((o: any) => o.id === 'machine_vaul').effet.parmi.push({ unite: 'scorpion', cout: 300, nombre: 2 })
  const idx = indexerCodex(chargerCodex(brut))
  const cle = cleRepartition({ unite: 'scorpion', nombre: 2 })
  const liste = (repartition: Record<string, number>) => {
    const f = normaliserFormation({ formation: 'escadron_machine_vaul', options: [{ option: 'machine_vaul', repartition }] } as never, (x) => varianteParDefaut(idx, x))
    return { f, res: calculerListe(idx, { id: 'l', nom: 'x', codex: 'eldars-d-iyanden', limite: 5000, formations: [f] }) }
  }

  it('compte la paire au prix de la paire, pour 2 unités', () => {
    const vide = liste({}).res
    const { res } = liste({ [cle]: 1 })
    expect(res.erreurs.filter((e) => e.type === 'option_quantite')).toEqual([])
    expect(res.total - vide.total).toBe(300)
  })

  it('la paire compte pour 2 dans le maximum', () => {
    const { res, f } = liste({ [cle]: 1, cobra: 1 })
    expect(res.erreurs.map((e) => e.type)).toContain('option_quantite')
    const r = resoudreFormation(idx, f)
    expect(plafondRepartition(idx, r, f.options[0]!, 'cobra')).toBe(0)
  })

  it('le PDF annonce le prix de la paire', () => {
    expect(coutOption(idx.options.get('machine_vaul')!)).toBe('200 pts chacun / 300 pts la paire')
  })

  it('les listes existantes (clé = id d\'unité) restent lues', () => {
    expect(liste({ scorpion: 1 }).res.erreurs.filter((e) => e.type === 'option_interdite')).toEqual([])
  })
})

describe('répartition : max « autant que nécessaire pour embarquer » ou illimité', () => {
  const brut = chargerCodexBrut('adeptus-astartes') as any
  brut.options.push({
    id: 'vehicules_test', nom: 'Véhicules',
    effet: { type: 'choix_multiple', total: { min: 0, max: 'besoin_transport' }, parmi: [{ unite: 'rhino', cout: 25 }, { unite: 'razorback_bolters_lourds', cout: 25 }] },
    contraintes: [],
  })
  brut.options.push({
    id: 'vehicules_libres', nom: 'Véhicules libres',
    effet: { type: 'choix_multiple', total: { min: 0 }, parmi: [{ unite: 'rhino', cout: 25 }] },
    contraintes: [],
  })
  // 6 Tactiques sans transport fourni : 6 places à couvrir (Rhino 2 places, Razorback 1)
  brut.formations.push({ id: 'test_rep', nom: 'Test', variantes: [{ id: 'base', cout: 100, composition: [{ unite: 'tactiques', nombre: 6 }] }], options: ['vehicules_test', 'vehicules_libres'] })
  brut.sections[0].formations.push('test_rep')
  const idx = indexerCodex(chargerCodex(brut))
  const formation = (option: string, repartition: Record<string, number>) =>
    normaliserFormation({ formation: 'test_rep', options: [{ option, repartition }] } as never, (x) => varianteParDefaut(idx, x))
  const plafond = (repartition: Record<string, number>, cle: string) => {
    const f = formation('vehicules_test', repartition)
    return plafondRepartition(idx, resoudreFormation(idx, f), f.options[0]!, cle)
  }
  const erreurs = (option: string, repartition: Record<string, number>) =>
    calculerListe(idx, { id: 'l', nom: 'x', codex: 'adeptus-astartes', limite: 5000, formations: [formation(option, repartition)] }).erreurs.filter((e) => e.type === 'option_quantite')

  it('plafonne chaque ligne aux places encore manquantes', () => {
    expect(plafond({}, 'rhino')).toBe(3)
    expect(plafond({}, 'razorback_bolters_lourds')).toBe(6)
    // 2 Rhinos = 4 places : il en manque 2, soit 1 Rhino ou 2 Razorbacks
    expect(plafond({ rhino: 2 }, 'razorback_bolters_lourds')).toBe(2)
    expect(plafond({ razorback_bolters_lourds: 5 }, 'rhino')).toBe(1)
  })

  it('accepte juste assez de véhicules et refuse un véhicule de trop', () => {
    expect(erreurs('vehicules_test', { rhino: 3 })).toEqual([])
    expect(erreurs('vehicules_test', { rhino: 2, razorback_bolters_lourds: 2 })).toEqual([])
    expect(erreurs('vehicules_test', { rhino: 4 }).length).toBe(1)
  })

  it('max absent : aucun plafond', () => {
    const f = formation('vehicules_libres', { rhino: 12 })
    expect(plafondRepartition(idx, resoudreFormation(idx, f), f.options[0]!, 'rhino')).toBeNull()
    expect(erreurs('vehicules_libres', { rhino: 12 })).toEqual([])
  })

  it('le PDF dit ce que le max signifie', async () => {
    const { phraseOption } = await import('../shared/codex/phrases')
    expect(phraseOption(idx, idx.options.get('vehicules_test')!)).toBe("Ajouter autant de véhicules que nécessaire pour embarquer la formation, selon n'importe quelle combinaison : Rhinos, Razorback Bolters Lourds")
    expect(phraseOption(idx, idx.options.get('vehicules_libres')!)).toBe("Ajouter autant de véhicules que souhaité, selon n'importe quelle combinaison : Rhinos")
  })
})

describe('« 0-N » devant les améliorations limitées dans l\'armée', () => {
  it('préfixe comme pour les formations, sans doubler un préfixe déjà saisi', async () => {
    const { nomOption } = await import('../shared/codex/phrases')
    const limite = [{ type: 'max_par_armee', valeur: 1 }] as never
    expect(nomOption({ nom: 'Big Boss', contraintes: limite })).toBe('0-1 Big Boss')
    expect(nomOption({ nom: 'Big Boss', contraintes: [{ type: 'max_par_armee', valeur: 2 }] as never })).toBe('0-2 Big Boss')
    expect(nomOption({ nom: '0-1 Missile Warp', contraintes: limite })).toBe('0-1 Missile Warp')
    expect(nomOption({ nom: 'Kaptain', contraintes: [{ type: 'max_par_formation', valeur: 1 }] as never })).toBe('Kaptain')
  })
})

describe('répartition « autant que nécessaire » avec transports automatiques', () => {
  it('les Rhinos automatiques ne bloquent pas les Razorbacks (Adeptus Astartes, Tactique)', () => {
    const idx = indexerCodex(chargerCodexParSlug('adeptus-astartes'))
    const plafond = (repartition: Record<string, number>) => {
      const f = normaliserFormation({ formation: 'tactique', options: [{ option: 'razorback', repartition }] } as never, (x) => varianteParDefaut(idx, x))
      return plafondRepartition(idx, resoudreFormation(idx, f), f.options[0]!, 'razorback_bolters_lourds')
    }
    // 6 Tactiques, 1 place par Razorback
    expect(plafond({})).toBe(6)
    expect(plafond({ razorback_canons_laser: 4 })).toBe(2)
  })
})
