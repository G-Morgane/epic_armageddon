/** Liste des codex disponibles (métadonnées). */
export default defineEventHandler(async () => {
  const slugs = await listerSlugsCodex()
  const codex = await Promise.all(slugs.map(lireCodex))
  return codex.map((c) => ({
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
  }))
})
