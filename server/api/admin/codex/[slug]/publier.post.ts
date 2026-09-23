import { indexerCodex, calculerListe, varianteParDefaut } from '~~/shared/codex/engine'
import { normaliserFormation } from '~~/shared/codex/liste'
import type { Codex } from '~~/shared/codex/schema'

/** Publie le brouillon : validation stricte + listes de test, puis snapshot versionné. */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const slug = getRouterParam(event, 'slug') ?? ''
  const body = await readBody<{ version: string; changelog?: string }>(event)
  if (!body?.version?.trim()) throw createError({ statusCode: 400, message: 'Numéro de version requis' })
  // Le texte accompagne la version pour toujours : c'est lui que les joueurs
  // lisent dans l'historique, et une version sans explication ne se rattrape
  // qu'a la main en base. La regle est ici et pas seulement dans la modale :
  // l'API est ce qui publie.
  if (!body?.changelog?.trim()) {
    throw createError({ statusCode: 400, message: 'Explications de la mise à jour requises' })
  }
  try {
    // 1. validation stricte sur une copie
    const b = await lireBrouillon(slug)
    const { chargerCodex } = await import('~~/shared/codex/schema')
    const codex = chargerCodex({ ...b.data, codex: { ...b.data.codex, version: body.version } })
    // 2. listes de test
    const idx = indexerCodex(codex)
    const echecs: string[] = []
    for (const t of codex.listes_test) {
      const liste = { id: 't', nom: t.nom, codex: slug, limite: t.limite, formations: t.formations.map((f) => normaliserFormation(f as never, (id) => varianteParDefaut(idx, id))) }
      const r = calculerListe(idx, liste)
      if (t.attendu === 'valide' && !r.valide) echecs.push(`« ${t.nom} » devrait être valide : ${r.erreurs.map((e) => e.message).join(' ; ')}`)
      if (t.attendu === 'refusee' && r.valide) echecs.push(`« ${t.nom} » devrait être refusée`)
      if (t.attendu === 'refusee' && t.erreur && !r.erreurs.some((e) => e.type === t.erreur)) echecs.push(`« ${t.nom} » : erreur ${t.erreur} attendue`)
    }
    if (echecs.length) throw createError({ statusCode: 422, message: `Listes de test en échec :\n${echecs.join('\n')}` })
    // 3. publication
    const version = body.version.trim()
    await publierBrouillon(slug, version, body.changelog.trim())
    // 4. le public lit des réponses gardées une minute : les oublier, sinon la fiche
    //    et l'aperçu PDF montrent encore l'ancienne version après un Publier réussi
    await oublierCacheCodex(slug)
    // 5. la fiche publique suit le codex : nom, faction, statut, citation et icône
    //    ne s'écrivent plus qu'ici, l'admin des armées ne fait que les afficher.
    //    Le statut ne suit que s'il a été saisi : le schéma le met à « official »
    //    par défaut, et publier un codex qui n'en porte pas ferait passer une
    //    armée bêta ou expérimentale en officielle sans que personne le demande.
    await synchroniserFicheArmee(codex.codex, b.data.codex.statut !== undefined)
    // 6. PDF figé pour l'historique : si ça échoue, la publication reste valide et le PDF sera composé à la volée
    let pdf: string | null = null
    try {
      pdf = await figerPdfVersion(getRequestURL(event).origin, slug, version)
    } catch (e) {
      console.warn(`[codex] PDF de ${slug} v${version} non figé : ${(e as Error).message}`)
    }
    return { ok: true, version, pdf }
  } catch (e) {
    if ((e as { statusCode?: number }).statusCode) throw e
    throw createError({ statusCode: 422, message: (e as Error).message })
  }
})

/**
 * Recopie dans la ligne `armies` les champs dont le codex est désormais la seule
 * source : l'admin ne les saisit qu'une fois. Sans `armee_id`, rien à faire.
 * Le statut `archived` n'existe pas côté codex : on ne le remplace pas, sinon
 * publier une correction ferait réapparaître une armée retirée du site.
 * `statutSaisi` : faux quand le codex ne porte pas de statut, auquel cas la
 * fiche garde le sien plutôt que d'hériter du « official » par défaut du schéma.
 */
async function synchroniserFicheArmee(meta: Codex['codex'], statutSaisi: boolean) {
  const id = meta.armee_id
  if (!id) return
  const sb = useSupabaseServer()
  const { data: fiche } = await sb.from('armies').select('status').eq('id', id).maybeSingle()
  if (!fiche) return
  const statutActuel = (fiche as { status?: string }).status
  const champs: Record<string, unknown> = {
    name: meta.nom,
    faction: meta.faction,
    quote: meta.citation?.texte ?? null,
    quote_author: meta.citation?.auteur ?? null,
  }
  if (statutSaisi && statutActuel !== 'archived') champs.status = meta.statut
  if (meta.logo) champs.cover_image = meta.logo
  const { error } = await sb.from('armies').update(champs as never).eq('id', id)
  // La publication est faite : une fiche non mise à jour se rattrape, la perdre non.
  if (error) console.warn(`[codex] fiche d'armée ${id} non synchronisée : ${error.message}`)
  else await oublierCacheArmees()
}
