/**
 * Les trois dernières parutions mises en avant sur l'accueil.
 *
 * Ordre de préférence : officielles publiées depuis moins de trois mois, puis
 * les autres statuts sur la même fenêtre, puis les plus récentes quelle que
 * soit leur date pour ne jamais rendre moins de trois cartes.
 *
 * Une seule requête : `is_current` ne garde qu'une version par armée (65 lignes),
 * et le classement se fait ici. Les trois requêtes en file d'avant coûtaient
 * trois allers-retours jusqu'à la base pour trois lignes.
 */
export default defineCachedEventHandler(async () => {
  const supabase = useSupabaseServer()

  const troisMoisAvant = new Date()
  troisMoisAvant.setMonth(troisMoisAvant.getMonth() - 3)
  const seuil = troisMoisAvant.getTime()

  const { data, error } = await supabase
    .from('army_versions')
    .select('*, armies!inner(*)')
    .eq('is_current', true)
    .order('published_at', { ascending: false })
    // Départage stable : plusieurs codex partagent la même date de publication,
    // et sans second critère Postgres rend ces ex aequo dans l'ordre qui
    // l'arrange. L'accueil changeait de carte d'un déploiement à l'autre.
    .order('id', { ascending: true })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  const versions = data ?? []
  // `published_at` peut être nul : une version sans date n'entre jamais dans la fenêtre.
  const recente = (v: any) => v.published_at != null && new Date(v.published_at).getTime() >= seuil
  const recentes = versions.filter(recente)

  const classees = [
    ...recentes.filter((v: any) => v.armies?.status === 'official'),
    ...recentes.filter((v: any) => v.armies?.status !== 'official'),
    ...versions,
  ]

  const vues = new Set<string>()
  const sortie: any[] = []
  for (const v of classees) {
    if (sortie.length === 3) break
    if (vues.has(v.id)) continue
    vues.add(v.id)
    sortie.push(v)
  }

  return sortie
}, cacheDonnees('armies-recentes', () => 'v1'))
