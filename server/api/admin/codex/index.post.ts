/** Crée une nouvelle armée (brouillon vide). */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const body = await readBody<{ nom: string; faction: 'imperium' | 'chaos' | 'xenos'; type?: 'armee' | 'soutien'; armee_id?: string }>(event)
  if (!body?.nom?.trim()) throw createError({ statusCode: 400, message: 'Nom requis' })
  const slug = body.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const existants = await listerSlugsCodex()
  if (existants.includes(slug)) throw createError({ statusCode: 409, message: `Une armée « ${slug} » existe déjà` })
  const vide = codexVide(slug, body.nom.trim(), body.faction ?? 'imperium', body.type === 'soutien' ? 'soutien' : 'armee')
  // Rattachement posé dès la création quand le codex part d'une fiche d'armée
  // existante : sans lui, le site ne relie les deux que par coïncidence de nom.
  if (body.armee_id) vide.codex.armee_id = body.armee_id
  await ecrireBrouillon(slug, vide)
  return { slug }
})
