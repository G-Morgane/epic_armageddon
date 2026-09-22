/** Métadonnées d'un codex telles que les sert `/api/codex`. */
export interface CodexMeta {
  slug: string
  armee_id?: string
  nom: string
  version: string
  faction: string
  type: string
  statut?: string
  couleur?: string
  illustration?: string
  unites: number
  formations: number
  options: number
}

/** Résumé des publications d'un codex, tel que le sert `/api/codex/publications`. */
export interface PublicationCodex {
  slug: string
  /** Date de la publication la plus récente. */
  publie: string
  /** Combien de REV distinctes ont été publiées, pas leur numéro. */
  revs: number
}

const cle = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Codex unifié d'une armée, s'il est déjà transcrit : par `armee_id`, à défaut par le nom.
 * La liste et la fiche doivent rattacher pareil, sinon une armée gagne un codex d'un côté et pas de l'autre.
 */
export function codexDeArmee(tous: CodexMeta[] | null | undefined, id: string, nom: string | undefined | null): CodexMeta | undefined {
  if (!nom) return undefined
  const armees = (tous ?? []).filter(c => c.type !== 'soutien')
  return armees.find(c => c.armee_id === id) ?? armees.find(c => !c.armee_id && cle(c.nom) === cle(nom))
}
