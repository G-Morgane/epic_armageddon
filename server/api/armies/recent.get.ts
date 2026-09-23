/**
 * Les trois dernières parutions mises en avant sur l'accueil.
 *
 * Deux sources, parce que les codex vivent des deux côtés : les versions PDF
 * déposées à la main dans `army_versions`, et les REV publiées depuis l'admin
 * des codex dynamiques, qui ne touchent jamais cette table. Sans la seconde,
 * publier une REV ne se voyait nulle part sur l'accueil.
 *
 * Ordre de préférence : officielles publiées depuis moins de trois mois, puis
 * les autres statuts sur la même fenêtre, puis les plus récentes quelle que
 * soit leur date pour ne jamais rendre moins de trois cartes.
 */

interface Fiche { id: string; name: string; faction: string; status?: string; cover_image?: string | null }
interface Parution { id: string; version: string; published_at: string; changelog: string | null; armies: Fiche }

export default defineCachedEventHandler(async () => {
  const supabase = useSupabaseServer()

  const troisMoisAvant = new Date()
  troisMoisAvant.setMonth(troisMoisAvant.getMonth() - 3)
  const seuil = troisMoisAvant.getTime()

  // `is_current` ne garde qu'une version par armée (65 lignes), le classement se fait ici.
  const { data, error } = await supabase
    .from('army_versions')
    .select('*, armies!inner(*)')
    .eq('is_current', true)
    .order('published_at', { ascending: false })

  if (error) {
    throw createError({ statusCode: 500, message: error.message })
  }

  const parutions = ((data ?? []) as unknown as Parution[]).filter((v) => v.armies)
  parutions.push(...(await parutionsDesCodex(supabase)))

  // Une armée ne sort qu'une fois : sa parution la plus récente, PDF ou REV.
  const parArmee = new Map<string, Parution>()
  for (const v of parutions) {
    const connue = parArmee.get(v.armies.id)
    if (!connue || dateDe(v) > dateDe(connue)) parArmee.set(v.armies.id, v)
  }
  // Départage stable : plusieurs codex partagent la même date de publication,
  // et sans second critère l'accueil changeait de carte d'un déploiement à l'autre.
  const versions = [...parArmee.values()].sort((a, b) => dateDe(b) - dateDe(a) || a.id.localeCompare(b.id))

  const recente = (v: Parution) => v.published_at != null && dateDe(v) >= seuil
  const recentes = versions.filter(recente)

  return [
    ...recentes.filter((v) => v.armies.status === 'official'),
    ...recentes.filter((v) => v.armies.status !== 'official'),
    ...versions,
  ].filter((v, i, tout) => tout.indexOf(v) === i).slice(0, 3)
}, cacheDonnees('armies-recentes', () => 'v1'))

/** `published_at` peut être nul : une version sans date n'entre jamais dans la fenêtre. */
const dateDe = (v: Parution) => (v.published_at ? new Date(v.published_at).getTime() : 0)

/**
 * Les REV des codex dynamiques, ramenées à la forme d'une ligne `army_versions`.
 *
 * La première REV d'un codex est mise de côté : elle ne fait que passer en
 * dynamique un contenu déjà publié en PDF, elle n'apprend rien au joueur. C'est
 * la même règle que le badge « New » de la liste des armées.
 */
async function parutionsDesCodex(supabase: ReturnType<typeof useSupabaseServer>): Promise<Parution[]> {
  try {
    const publications = (await resumerPublications()).filter((p) => p.revs > 1)
    if (!publications.length) return []

    const parSlug = new Map((await etatsCodex()).map((e) => [e.slug, e]))
    const ids = [...new Set(publications.map((p) => parSlug.get(p.slug)?.armee_id).filter(Boolean) as string[])]
    if (!ids.length) return []

    const { data } = await supabase.from('armies').select('id, name, faction, status, cover_image').in('id', ids)
    const fiches = new Map(((data ?? []) as unknown as Fiche[]).map((a) => [a.id, a]))

    return publications.flatMap((p) => {
      const fiche = fiches.get(parSlug.get(p.slug)?.armee_id ?? '')
      if (!fiche) return []
      return [{ id: `codex-${p.slug}-${p.version}`, version: p.version, published_at: p.publie, changelog: p.changelog || null, armies: fiche }]
    })
  } catch (e) {
    // L'accueil vit sans : mieux vaut les seules parutions PDF qu'une page en erreur.
    console.warn(`[accueil] parutions des codex ignorées : ${(e as Error).message}`)
    return []
  }
}
