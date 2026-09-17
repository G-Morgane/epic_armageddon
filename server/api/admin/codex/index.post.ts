/** Crée une nouvelle armée (brouillon vide). */
export default defineEventHandler(async (event) => {
  await exigerAdmin(event)
  const body = await readBody<{ nom: string; faction: 'imperium' | 'chaos' | 'xenos' }>(event)
  if (!body?.nom?.trim()) throw createError({ statusCode: 400, message: 'Nom requis' })
  const slug = body.nom.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const existants = await listerSlugsCodex()
  if (existants.includes(slug)) throw createError({ statusCode: 409, message: `Une armée « ${slug} » existe déjà` })
  await ecrireBrouillon(slug, codexVide(slug, body.nom.trim(), body.faction ?? 'imperium'))
  return { slug }
})
