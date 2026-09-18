/** Liste des codex disponibles (métadonnées). Un codex qui n'existe qu'en brouillon (jamais publié) n'apparaît pas. */
export default defineEventHandler(async () => {
  const slugs = await listerSlugsCodex()
  const resultats = await Promise.allSettled(slugs.map(lireCodex))
  return resultats.flatMap((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[codex] ${slugs[i]} ignoré dans la liste publique : ${(r.reason as Error).message}`)
      return []
    }
    const c = r.value
    return [{
      slug: c.codex.slug,
      nom: c.codex.nom,
      version: c.codex.version,
      faction: c.codex.faction,
      type: c.codex.type,
      statut: c.codex.statut,
      couleur: c.codex.couleur,
      unites: c.unites.length,
      formations: c.formations.length,
      options: c.options.length,
    }]
  })
})
