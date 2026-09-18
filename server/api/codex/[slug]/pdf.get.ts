import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'

/**
 * Génère le PDF d'un codex en imprimant la page /codex-test/{slug}/imprimer
 * avec un Chromium sans écran. Sur Vercel (ou tout serverless), Chromium vient
 * de @sparticuz/chromium ; en local, du Chrome installé ou de CHROMIUM_PATH.
 */
async function executable(): Promise<{ path: string; args: string[] }> {
  const locaux = [
    process.env.CHROMIUM_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
  ].filter((p): p is string => !!p && existsSync(p))
  if (locaux.length && !process.env.VERCEL) return { path: locaux[0]!, args: [] }
  const sparticuz = await import('@sparticuz/chromium')
  const mod = (sparticuz.default ?? sparticuz) as { executablePath: (p?: string) => Promise<string>; args: string[] }
  return { path: await mod.executablePath(), args: mod.args }
}

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[a-z0-9-]+$/.test(slug)) throw createError({ statusCode: 400, statusMessage: 'slug invalide' })
  const brouillon = getQuery(event).brouillon ? '?brouillon=1' : ''

  const origine = getRequestURL(event).origin
  const exe = await executable()
  const navigateur = await chromium.launch({ executablePath: exe.path, args: exe.args, headless: true })
  try {
    const page = await navigateur.newPage()
    const reponse = await page.goto(`${origine}/codex-test/${slug}/imprimer${brouillon}`, { waitUntil: 'networkidle', timeout: 45000 })
    if (reponse && reponse.status() >= 400) {
      throw createError({ statusCode: 502, statusMessage: `La page à imprimer répond ${reponse.status()} (protection de déploiement Vercel active ?)` })
    }
    await page.waitForSelector('[data-pret]', { timeout: 15000 })
    const pdf = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
    setHeader(event, 'Content-Type', 'application/pdf')
    setHeader(event, 'Content-Disposition', `inline; filename="codex-${slug}.pdf"`)
    return pdf
  } finally {
    await navigateur.close()
  }
})
