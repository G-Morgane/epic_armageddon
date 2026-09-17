import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

/**
 * Génère le PDF d'un codex en imprimant la page /codex-test/{slug}/imprimer
 * avec un Chromium sans écran. En production ce fichier partirait sur R2
 * au moment de « Publier » ; ici il est produit à la demande.
 */
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[a-z0-9-]+$/.test(slug)) throw createError({ statusCode: 400, statusMessage: 'slug invalide' })

  const origine = getRequestURL(event).origin
  const candidats = [
    process.env.CHROMIUM_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter((p): p is string => !!p && existsSync(p))
  if (!candidats.length) throw createError({ statusCode: 500, statusMessage: 'Aucun Chromium trouvé (définir CHROMIUM_PATH)' })

  const navigateur = await chromium.launch({ executablePath: candidats[0], headless: true })
  try {
    const page = await navigateur.newPage()
    await page.goto(`${origine}/codex-test/${slug}/imprimer`, { waitUntil: 'networkidle' })
    await page.waitForSelector('[data-pret]', { timeout: 15000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Disposition', `inline; filename="codex-${slug}.pdf"`)
    return pdf
  } finally {
    await navigateur.close()
  }
})
