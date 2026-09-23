/**
 * Options de cache des routes adossées à Supabase.
 *
 * Ces données (armées, tags, événements, outils, documents) changent quelques
 * fois par mois, mais chaque visiteur repayait la requête : la fonction tourne
 * loin de la base, et un aller-retour coûte ~300 ms de transport avant même que
 * Postgres ne réponde.
 *
 * `swr` : passé `maxAge`, la réponse périmée part tout de suite et le recalcul
 * se fait derrière. Personne n'attend la base, sauf le tout premier appel.
 *
 * Contrepartie assumée : une modification faite dans l'admin met jusqu'à cinq
 * minutes à se voir sur le site public. Les écrans d'admin qui doivent voir
 * leur propre écriture passent `?fresh=1`, qui court-circuite le cache.
 */
export const cacheDonnees = (name: string, getKey: (event: any) => string) => ({
  maxAge: 300,
  swr: true,
  name,
  getKey,
  shouldBypassCache: (event: any) => Boolean(getQuery(event).fresh),
})
