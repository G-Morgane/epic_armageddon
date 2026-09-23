/** Signalements de bugs : tableau de l'admin (sans les listes, trop lourdes). */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const q = getQuery(event)
  // La pastille de la navigation n'a besoin que des compteurs : lui descendre
  // les trois cents dernières lignes à chaque page de l'admin n'a pas de sens.
  if (q.compteurs) return { lignes: [], compteurs: await compterSignalements() }
  const [lignes, compteurs] = await Promise.all([
    listerSignalements({
      statut: typeof q.statut === 'string' ? q.statut : undefined,
      codex: typeof q.codex === 'string' ? q.codex : undefined,
      recherche: typeof q.q === 'string' ? q.q.trim() : undefined,
    }),
    compterSignalements(),
  ])
  return { lignes, compteurs }
})
