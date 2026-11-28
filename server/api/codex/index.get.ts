/**
 * Liste des codex disponibles (métadonnées). Un codex qui n'existe qu'en brouillon (jamais publié) n'apparaît pas.
 * Construire la liste relit les 43 codex et leurs alliés : le résultat est gardé une minute,
 * et servi périmé pendant le recalcul, sinon chaque page qui en a besoin paie ~800 ms.
 */
export default defineCachedEventHandler(async () => {
  const slugs = await listerSlugsCodex()
  // un seul cache d'alliés pour toute la liste : chaque codex allié n'est lu et parsé qu'une fois
  const cache = cacheAllies()
  const resultats = await Promise.allSettled(slugs.map((s) => lireCodex(s, undefined, cache)))
  return resultats.flatMap((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[codex] ${slugs[i]} ignoré dans la liste publique : ${(r.reason as Error).message}`)
      return []
    }
    const c = r.value
    return [{
      slug: c.codex.slug,
      armee_id: c.codex.armee_id,
      nom: c.codex.nom,
      version: c.codex.version,
      faction: c.codex.faction,
      type: c.codex.type,
      statut: c.codex.statut,
      couleur: c.codex.couleur,
      logo: c.codex.logo,
      illustration: c.codex.illustration,
      unites: c.unites.length,
      formations: c.formations.length,
      options: c.options.length,
    }]
  })
}, {
  maxAge: 60,
  swr: true,
  name: 'codex-liste',
  getKey: () => 'v1',
})
