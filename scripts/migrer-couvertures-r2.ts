/**
 * Envoie les illustrations de couverture des codex sur R2 et met à jour les fichiers YAML.
 *
 *   npx tsx scripts/migrer-couvertures-r2.ts            # essai à blanc, n'écrit rien
 *   npx tsx scripts/migrer-couvertures-r2.ts --ecrire   # téléverse et met à jour les YAML
 *   npx tsx scripts/migrer-couvertures-r2.ts --ecrire --remplacer   # écrase une clé déjà présente
 *
 * Lit les identifiants dans .env (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 * R2_BUCKET_NAME, R2_PUBLIC_URL). N'écrit que sous le préfixe `codex/couvertures/` :
 * les PDF du site, rangés ailleurs, ne sont jamais touchés.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER_IMAGES = join(RACINE, 'public/codex/couvertures')
const DOSSIER_CODEX = join(RACINE, 'content/codex')
const PREFIXE = 'codex/couvertures'

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

/** Remplace la ligne `illustration:` du bloc codex, ou l'ajoute après `couleur:` / `statut:`. */
function majYaml(slug: string, url: string): 'modifie' | 'inchange' | 'absent' {
  const chemin = join(DOSSIER_CODEX, `${slug}.yaml`)
  if (!existsSync(chemin)) return 'absent'
  const avant = readFileSync(chemin, 'utf8')
  let apres: string
  if (/^ {2}illustration: .*$/m.test(avant)) {
    apres = avant.replace(/^ {2}illustration: .*$/m, `  illustration: ${url}`)
  } else {
    const m = avant.match(/^ {2}(?:couleur|statut): .*$/m)
    if (!m) return 'absent'
    const i = m.index! + m[0].length
    apres = `${avant.slice(0, i)}\n  illustration: ${url}${avant.slice(i)}`
  }
  if (apres === avant) return 'inchange'
  if (ecrire) writeFileSync(chemin, apres, 'utf8')
  return 'modifie'
}

const TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

async function main() {
  if (!existsSync(DOSSIER_IMAGES)) {
    console.error(`Dossier introuvable : ${DOSSIER_IMAGES}`)
    process.exit(1)
  }
  const fichiers = readdirSync(DOSSIER_IMAGES).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort()
  if (!fichiers.length) {
    console.log('Aucune image à migrer.')
    return
  }

  console.log(ecrire ? 'Migration des couvertures vers R2\n' : 'Essai à blanc : rien ne sera écrit (ajouter --ecrire)\n')

  for (const fichier of fichiers) {
    const slug = fichier.replace(/\.[^.]+$/, '')
    const ext = fichier.split('.').pop()!.toLowerCase()
    const cle = `${PREFIXE}/${fichier}`
    const url = `${R2_PUBLIC_URL}/${cle}`
    const corps = readFileSync(join(DOSSIER_IMAGES, fichier))

    const present = await existeDeja(cle)
    if (present && !remplacer) {
      console.log(`  = ${slug.padEnd(22)} déjà sur R2, conservé (--remplacer pour écraser)`)
    } else if (ecrire) {
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: cle, Body: corps, ContentType: TYPES[ext] ?? 'image/jpeg' }))
      console.log(`  ↑ ${slug.padEnd(22)} ${Math.round(corps.length / 1024)} ko envoyés`)
    } else {
      console.log(`  ↑ ${slug.padEnd(22)} ${Math.round(corps.length / 1024)} ko à envoyer`)
    }

    const etat = majYaml(slug, url)
    if (etat === 'absent') console.log(`    ! content/codex/${slug}.yaml introuvable ou sans bloc codex reconnaissable`)
    else console.log(`    ${url}`)
  }

  console.log(ecrire
    ? '\nTerminé. Vérifier les YAML, puis supprimer public/codex/couvertures et committer.'
    : '\nEssai à blanc terminé. Relancer avec --ecrire pour appliquer.')
}

main().catch((e) => { console.error(e); process.exit(1) })
