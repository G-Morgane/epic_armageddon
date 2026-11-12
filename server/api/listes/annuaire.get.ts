/**
 * Annuaire des listes publiques, lecture sans session.
 * `?q=` nom de liste ou pseudo, `?codex=a,b` codex acceptés, `?page=` à partir de 1.
 */
const PAR_PAGE = 24

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const page = Math.max(1, Math.floor(Number(q.page)) || 1)
  const codex = typeof q.codex === 'string' && q.codex ? q.codex.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100) : []
  const texte = typeof q.q === 'string' ? q.q.slice(0, 60) : ''
  const r = await chercherListesPubliques({ nombre: PAR_PAGE, decalage: (page - 1) * PAR_PAGE, codex, texte })
  return { ...r, page, parPage: PAR_PAGE }
})
