/**
 * Publie sur R2 l'archive des binaires Chromium utilisée par la génération de
 * PDF en production.
 *
 *   npx tsx scripts/publier-pack-chromium.ts            # essai à blanc, n'écrit rien
 *   npx tsx scripts/publier-pack-chromium.ts --ecrire   # téléverse
 *   npx tsx scripts/publier-pack-chromium.ts --ecrire --remplacer   # écrase une clé déjà présente
 *
 * @sparticuz/chromium-min n'embarque pas le binaire : il le télécharge au
 * premier PDF depuis l'URL que lui passe server/utils/codex-pdf.ts. C'est ce
 * qui garde la fonction Vercel légère, donc son démarrage à froid court.
 * À relancer après chaque montée de version de @sparticuz/chromium-min : la
 * version publiée doit correspondre au paquet installé.
 *
 * Lit les identifiants dans .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL). N'écrit que la clé
 * `chromium-v{version}-pack.x64.tar` : rien d'autre n'est touché.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

const ecrire = process.argv.includes('--ecrire')
const remplacer = process.argv.includes('--remplacer')

/** Charge .env sans dépendance : une ligne CLE=valeur, guillemets optionnels. */
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

async function existeDeja(cle: string) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: cle }))
    return true
  } catch {
    return false
  }
}

async function main() {
  const pkg = JSON.parse(readFileSync(join(RACINE, 'node_modules/@sparticuz/chromium-min/package.json'), 'utf8')) as { version: string }
  const cle = `chromium-v${pkg.version}-pack.x64.tar`
  const source = `https://github.com/Sparticuz/chromium/releases/download/v${pkg.version}/${cle}`
  const url = `${R2_PUBLIC_URL}/${cle}`

  console.log(ecrire ? 'Publication du pack Chromium sur R2\n' : 'Essai à blanc : rien ne sera écrit (ajouter --ecrire)\n')
  console.log(`  version installée  ${pkg.version}`)
  console.log(`  source             ${source}`)
  console.log(`  destination        ${url}\n`)

  if (await existeDeja(cle) && !remplacer) {
    console.log('  = déjà sur R2, conservé (--remplacer pour écraser)')
    console.log('\nRien à faire. server/utils/codex-pdf.ts doit pointer sur cette même version.')
    return
  }
  if (!ecrire) {
    console.log('  ↑ à télécharger depuis GitHub puis envoyer')
    console.log('\nEssai à blanc terminé. Relancer avec --ecrire pour appliquer.')
    return
  }

  const reponse = await fetch(source, { redirect: 'follow' })
  if (!reponse.ok) {
    console.error(`Téléchargement impossible : ${reponse.status} ${reponse.statusText}`)
    process.exit(1)
  }
  const corps = Buffer.from(await reponse.arrayBuffer())
  console.log(`  ↓ ${Math.round(corps.length / 1024 / 1024)} Mo téléchargés`)

  await client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: cle, Body: corps, ContentType: 'application/x-tar' }))
  console.log(`  ↑ ${Math.round(corps.length / 1024 / 1024)} Mo envoyés`)
  console.log(`\nTerminé. Vérifier que PACK_CHROMIUM dans server/utils/codex-pdf.ts vaut « ${cle} ».`)
}

main().catch((e) => { console.error(e); process.exit(1) })
