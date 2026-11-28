/**
 * Sauvegarde des fichiers : tout le bucket R2 (PDF, couvertures, images) et les buckets Supabase Storage.
 *
 *   npx tsx scripts/sauvegarder-fichiers.ts
 *
 * Écrit dans `backups/fichiers-<horodatage>/r2/…` et `…/supabase-storage/<bucket>/…`, arborescence d'origine conservée.
 * Lecture seule. Identifiants dans .env (R2_*, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Les données des tables se sauvegardent à part : scripts/sauvegarder-supabase.ts.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

function chargerEnv() {
  const f = join(RACINE, '.env')
  if (!existsSync(f)) return
  for (const ligne of readFileSync(f, 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
chargerEnv()

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
const manquantes = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY })
  .filter(([, v]) => !v).map(([k]) => k)
if (manquantes.length) {
  console.error(`Absent de .env : ${manquantes.join(', ')}`)
  process.exit(1)
}

const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dossier = join(RACINE, 'backups', `fichiers-${horodatage}`)

function ecrire(chemin: string, contenu: Uint8Array) {
  mkdirSync(dirname(chemin), { recursive: true })
  writeFileSync(chemin, contenu)
}

/** Lance `taches` par paquets de `n` : des centaines de téléchargements d'un coup saturent la connexion. */
async function parPaquets<T>(elements: T[], n: number, tache: (e: T) => Promise<void>) {
  for (let i = 0; i < elements.length; i += n) await Promise.all(elements.slice(i, i + n).map(tache))
}

// ── R2 ──
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID!, secretAccessKey: R2_SECRET_ACCESS_KEY! },
})

async function sauvegarderR2(): Promise<{ fichiers: number; octets: number }> {
  const cles: string[] = []
  let suite: string | undefined
  do {
    const r = await r2.send(new ListObjectsV2Command({ Bucket: R2_BUCKET_NAME, ContinuationToken: suite }))
    for (const o of r.Contents ?? []) if (o.Key && !o.Key.endsWith('/')) cles.push(o.Key)
    suite = r.IsTruncated ? r.NextContinuationToken : undefined
  } while (suite)

  let octets = 0
  await parPaquets(cles, 8, async (cle) => {
    const r = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: cle }))
    const contenu = await r.Body!.transformToByteArray()
    octets += contenu.length
    ecrire(join(dossier, 'r2', cle), contenu)
  })
  return { fichiers: cles.length, octets }
}

// ── Supabase Storage ──
const entetes = { apikey: SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }

/** Chemins de tous les fichiers d'un bucket : l'API ne liste qu'un niveau, les dossiers (id null) se parcourent un à un. */
async function listerStorage(bucket: string, prefixe = ''): Promise<string[]> {
  const chemins: string[] = []
  for (let offset = 0; ; offset += 1000) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: 'POST',
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: prefixe, limit: 1000, offset }),
    })
    if (!r.ok) throw new Error(`liste ${bucket}/${prefixe} : ${r.status} ${await r.text()}`)
    const entrees = await r.json() as { name: string; id: string | null }[]
    for (const e of entrees) {
      const chemin = prefixe ? `${prefixe}/${e.name}` : e.name
      if (e.id === null) chemins.push(...await listerStorage(bucket, chemin))
      else chemins.push(chemin)
    }
    if (entrees.length < 1000) return chemins
  }
}

async function sauvegarderStorage(): Promise<Record<string, { fichiers: number; octets: number }>> {
  const r = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, { headers: entetes })
  if (!r.ok) throw new Error(`buckets : ${r.status} ${await r.text()}`)
  const buckets = await r.json() as { name: string }[]
  const resume: Record<string, { fichiers: number; octets: number }> = {}
  for (const { name: bucket } of buckets) {
    const chemins = await listerStorage(bucket)
    let octets = 0
    await parPaquets(chemins, 8, async (chemin) => {
      const f = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${chemin.split('/').map(encodeURIComponent).join('/')}`, { headers: entetes })
      if (!f.ok) throw new Error(`${bucket}/${chemin} : ${f.status}`)
      const contenu = new Uint8Array(await f.arrayBuffer())
      octets += contenu.length
      ecrire(join(dossier, 'supabase-storage', bucket, chemin), contenu)
    })
    resume[bucket] = { fichiers: chemins.length, octets }
  }
  return resume
}

const mo = (o: number) => `${(o / 1024 / 1024).toFixed(1)} Mo`
const resume: Record<string, { fichiers: number; taille: string }> = {}
const enR2 = await sauvegarderR2()
resume[`r2/${R2_BUCKET_NAME}`] = { fichiers: enR2.fichiers, taille: mo(enR2.octets) }
for (const [bucket, s] of Object.entries(await sauvegarderStorage())) resume[`storage/${bucket}`] = { fichiers: s.fichiers, taille: mo(s.octets) }

mkdirSync(dossier, { recursive: true })
writeFileSync(join(dossier, '_resume.json'), JSON.stringify({ date: new Date().toISOString(), contenu: resume }, null, 2))
console.table(resume)
console.log(`Sauvegarde : ${dossier}`)
