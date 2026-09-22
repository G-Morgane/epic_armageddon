/**
 * Envoie une illustration de couverture sur R2 et met à jour le YAML du codex.
 *
 *   npx tsx scripts/envoyer-couverture.ts <slug> <chemin-image>            # essai à blanc
 *   npx tsx scripts/envoyer-couverture.ts <slug> <chemin-image> --ecrire   # téléverse
 *
 * Si la clé existe déjà, l'ancienne image est d'abord recopiée sous
 * `codex/couvertures/archive/<slug>-<horodatage>.jpg` : le remplacement reste réversible.
 *
 * Lit les identifiants dans .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_PUBLIC_URL). N'écrit que sous le préfixe `codex/couvertures/`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { S3Client, PutObjectCommand, HeadObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PREFIXE = 'codex/couvertures'
/** Une couverture pleine page A4 à 150 ppp demande environ 1240 x 1754 pixels. */
const LARGEUR_CONSEILLEE = 1240

const args = process.argv.slice(2)
const ecrire = args.includes('--ecrire')
const [slug, image] = args.filter((a) => !a.startsWith('--'))

if (!slug || !image) {
  console.error('Usage : npx tsx scripts/envoyer-couverture.ts <slug> <chemin-image> [--ecrire]')
  process.exit(1)
}

function chargerEnv() {
  const f = join(RACINE, '.env')
  if (!existsSync(f)) return
  for (const ligne of readFileSync(f, 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
chargerEnv()

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env
const manquantes = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL })
  .filter(([, v]) => !v).map(([k]) => k)
if (manquantes.length) {
  console.error(`Identifiants R2 absents de .env : ${manquantes.join(', ')}`)
  process.exit(1)
}

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
})

/** Dimensions via sips (macOS), ou null si indisponible. */
function dimensions(f: string): { l: number, h: number } | null {
  try {
    const sortie = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', f], { encoding: 'utf8' })
    const l = Number(sortie.match(/pixelWidth:\s*(\d+)/)?.[1])
    const h = Number(sortie.match(/pixelHeight:\s*(\d+)/)?.[1])
    return l && h ? { l, h } : null
  } catch { return null }
}

/** Convertit en JPEG dans un fichier temporaire, pour garder une extension unique sur R2. */
function enJpeg(f: string): string {
  if (/\.jpe?g$/i.test(f)) return f
  const cible = join(process.env.TMPDIR ?? '/tmp', `couverture-${slug}-${Date.now()}.jpg`)
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', f, '--out', cible], { stdio: 'ignore' })
  return cible
}

function majYaml(url: string): 'modifie' | 'inchange' | 'absent' {
  const f = join(RACINE, 'content/codex', `${slug}.yaml`)
  if (!existsSync(f)) return 'absent'
  const avant = readFileSync(f, 'utf8')
  let apres: string
  if (/^ {2}illustration:.*$/m.test(avant)) apres = avant.replace(/^ {2}illustration:.*$/m, `  illustration: ${url}`)
  else if (/^ {2}statut:.*$/m.test(avant)) apres = avant.replace(/^( {2}statut:.*)$/m, `$1\n  illustration: ${url}`)
  else return 'absent'
  if (apres === avant) return 'inchange'
  if (ecrire) writeFileSync(f, apres)
  return 'modifie'
}

async function main() {
  if (!existsSync(image!)) {
    console.error(`Image introuvable : ${image}`)
    process.exit(1)
  }

  const dim = dimensions(image!)
  if (dim) {
    const ppp = Math.round(dim.l / 8.27)
    console.log(`Image source : ${dim.l} x ${dim.h} px, soit environ ${ppp} ppp sur une A4 pleine page.`)
    if (dim.l < LARGEUR_CONSEILLEE) console.log(`  ! En dessous des ${LARGEUR_CONSEILLEE} px conseillés : la couverture sera visiblement pixelisée à l'impression.`)
  }

  const cle = `${PREFIXE}/${slug}.jpg`
  const url = `${R2_PUBLIC_URL!.replace(/\/$/, '')}/${cle}`

  let existe = false
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: cle }))
    existe = true
  } catch { /* absente */ }

  const archive = `${PREFIXE}/archive/${slug}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.jpg`
  if (existe) console.log(`Clé déjà occupée. Ancienne image archivée sous ${archive}`)

  if (!ecrire) {
    console.log(`\nEssai à blanc, rien n'est envoyé. Ajouter --ecrire pour appliquer.`)
    console.log(`  clé   : ${cle}`)
    console.log(`  url   : ${url}`)
    console.log(`  yaml  : ${majYaml(url)}`)
    return
  }

  if (existe) {
    await client.send(new CopyObjectCommand({ Bucket: R2_BUCKET_NAME, CopySource: `${R2_BUCKET_NAME}/${cle}`, Key: archive }))
  }

  const jpeg = enJpeg(image!)
  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: cle,
    Body: readFileSync(jpeg),
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }))
  console.log(`Envoyée : ${url}`)
  console.log(`YAML    : ${majYaml(url)}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
