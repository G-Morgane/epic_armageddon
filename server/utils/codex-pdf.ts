import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { requeteOptionsPdf, lireOptionsPdf } from '~~/shared/codex/pdf'

/**
 * Génère le PDF d'un codex en imprimant la page /codex/{slug}/imprimer
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

/**
 * `requete` porte la composition du document (voir shared/codex/pdf.ts) ;
 * `version` et `brouillon` disent quel état du codex imprimer.
 */
export async function genererPdfCodex(origine: string, slug: string, requete: Record<string, unknown> = {}): Promise<Buffer> {
  const opts = lireOptionsPdf(requete)
  const extra: Record<string, string> = {}
  if (requete.brouillon) extra.brouillon = '1'
  if (typeof requete.version === 'string' && requete.version) extra.version = requete.version
  const query = requeteOptionsPdf(opts, extra)

  const exe = await executable()
  const navigateur = await chromium.launch({ executablePath: exe.path, args: exe.args, headless: true })
  try {
    const page = await navigateur.newPage()
    const reponse = await page.goto(`${origine}/codex/${slug}/imprimer${query}`, { waitUntil: 'networkidle', timeout: 45000 })
    if (reponse && reponse.status() >= 400) {
      throw createError({ statusCode: 502, statusMessage: `La page à imprimer répond ${reponse.status()} (protection de déploiement Vercel active ?)` })
    }
    await page.waitForSelector('[data-pret]', { timeout: 15000 })
    return await page.pdf({ format: 'A4', landscape: opts.orientation === 'paysage', printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  } finally {
    await navigateur.close()
  }
}
