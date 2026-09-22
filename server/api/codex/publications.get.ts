/**
 * Dates de publication des codex, une entrée par slug, en une seule requête.
 * Sert la liste des armées ; la fiche d'une armée passe par `/api/codex/[slug]/versions`, qui détaille les REV.
 * Gardé une minute comme la liste des codex : le badge « New » n'a pas besoin d'être à la seconde.
 */
export default defineCachedEventHandler(async () => resumerPublications(), {
  maxAge: 60,
  swr: true,
  name: 'codex-publications',
  getKey: () => 'v1',
})
