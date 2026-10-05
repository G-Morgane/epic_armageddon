import { describe, it, expect } from 'vitest'
import { chargerCodexBrut } from '../shared/codex/charger'
import { problemesCodex } from '../shared/codex/problemes'
import { changementsCodex, diffLignes } from '../shared/codex/changements'

const copie = <T>(x: T): T => JSON.parse(JSON.stringify(x))

describe('problèmes du brouillon en clair', () => {
  it('un codex valide n\'a aucun problème', () => {
    expect(problemesCodex(chargerCodexBrut('legions-titaniques'))).toEqual([])
  })

  it('un type de contrainte inconnu nomme l\'amélioration et signale une app trop ancienne', () => {
    const brut = copie(chargerCodexBrut('legions-titaniques')) as any
    const i = brut.options.findIndex((o: any) => o.id === 'armement_reaver')
    brut.options[i].contraintes[2].type = 'contrainte_du_futur'
    const [p, ...reste] = problemesCodex(brut)
    expect(reste).toEqual([])
    expect(p).toMatchObject({ lieu: 'Amélioration « Armement du Reaver » › contrainte n°3 › champ « type »', onglet: 'options', inconnu: 'contrainte_du_futur' })
    expect(p!.message).toContain('inconnu de cette version')
  })

  it('une valeur manquante et une référence cassée sont nommées', () => {
    const brut = copie(chargerCodexBrut('legions-titaniques')) as any
    delete brut.unites[0].nom
    expect(problemesCodex(brut)[0]).toMatchObject({ lieu: expect.stringMatching(/^Unité « /), message: 'valeur obligatoire manquante', onglet: 'unites' })
    const brut2 = copie(chargerCodexBrut('legions-titaniques')) as any
    brut2.sections[0].formations.push('fantome')
    expect(problemesCodex(brut2)).toContainEqual(expect.objectContaining({ message: 'formation inconnue « fantome »', onglet: 'liste' }))
  })
})

describe('changements brouillon / publié', () => {
  it('rien de changé, rien à relire (même avec un autre ordre de clés ou de version)', () => {
    const a = chargerCodexBrut('legions-titaniques') as any
    const b = copie(a)
    b.codex = { version: '9.9', ...b.codex }; b.codex.version = '9.9'
    b.options[0] = Object.fromEntries(Object.entries(b.options[0]).reverse())
    expect(changementsCodex(a, b)).toEqual([])
  })

  it('ajout, modification et suppression, avec les lignes touchées', () => {
    const a = chargerCodexBrut('legions-titaniques') as any
    const b = copie(a)
    const reaver = b.options.find((o: any) => o.id === 'armement_reaver')
    reaver.contraintes[1].valeur = 5
    const retiree = b.options.pop()
    b.unites.push({ id: 'nouvelle', nom: 'Nouvelle unité', type: 'INF' })
    const ch = changementsCodex(a, b)
    expect(ch.map((c) => [c.statut, c.nom])).toEqual([
      ['ajoute', 'Nouvelle unité'],
      ['modifie', 'Armement du Reaver'],
      ['supprime', retiree.nom],
    ])
    const modif = ch[1]!
    expect(modif.lignes.filter((l) => l.type === '-').map((l) => l.texte.trim())).toEqual(['valeur: 3'])
    expect(modif.lignes.filter((l) => l.type === '+').map((l) => l.texte.trim())).toEqual(['valeur: 5'])
  })

  it('masque les lignes identiques loin des changements', () => {
    const avant = Array.from({ length: 20 }, (_, i) => `l${i}`)
    const apres = [...avant]
    apres[2] = 'x'
    apres[17] = 'y'
    const d = diffLignes(avant, apres)
    expect(d.filter((l) => l.type === '@')).toHaveLength(1)
    expect(d.find((l) => l.texte === 'l10')).toBeUndefined()
  })
})
