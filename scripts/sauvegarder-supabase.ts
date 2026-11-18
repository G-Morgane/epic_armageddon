/**
 * Sauvegarde des données Supabase : une table = un fichier JSON, plus les comptes auth.
 *
 *   npx tsx scripts/sauvegarder-supabase.ts
 *
 * Écrit dans `backups/supabase-<horodatage>/` (dossier ignoré par git : il contient des emails).
 * Lecture seule, par l'API REST et la clé service de .env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 * Les tables sont découvertes dans le schéma OpenAPI de PostgREST : une nouvelle table est prise sans retoucher ce script.
 * Ne sauvegarde pas la structure (voir supabase/*.sql), ni les fichiers (R2).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const PAGE = 1000

function chargerEnv() {
  const f = join(RACINE, '.env')
  if (!existsSync(f)) return
  for (const ligne of readFileSync(f, 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
chargerEnv()

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absent de .env')
  process.exit(1)
}
const entetes = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }

async function lireJson<T>(url: string, extra: Record<string, string> = {}): Promise<T> {
  const r = await fetch(url, { headers: { ...entetes, ...extra } })
  if (!r.ok) throw new Error(`${r.status} ${url} : ${await r.text()}`)
  return r.json() as Promise<T>
}

/** Tables (et vues) exposées par PostgREST dans le schéma public. */
async function listerTables(): Promise<string[]> {
  const spec = await lireJson<{ definitions?: Record<string, unknown> }>(`${SUPABASE_URL}/rest/v1/`, { Accept: 'application/openapi+json' })
  return Object.keys(spec.definitions ?? {}).sort()
}

async function lireTable(table: string): Promise<unknown[]> {
  const lignes: unknown[] = []
  for (let debut = 0; ; debut += PAGE) {
    const page = await lireJson<unknown[]>(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { Range: `${debut}-${debut + PAGE - 1}` })
    lignes.push(...page)
    if (page.length < PAGE) return lignes
  }
}

/** Comptes auth.users, par l'API admin : la table n'est pas exposée par PostgREST. */
async function lireComptes(): Promise<unknown[]> {
  const comptes: unknown[] = []
  for (let page = 1; ; page++) {
    const r = await lireJson<{ users: unknown[] }>(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${PAGE}`)
    comptes.push(...r.users)
    if (r.users.length < PAGE) return comptes
  }
}

const horodatage = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const dossier = join(RACINE, 'backups', `supabase-${horodatage}`)
mkdirSync(dossier, { recursive: true })

const resume: Record<string, number | string> = {}
for (const table of await listerTables()) {
  try {
    const lignes = await lireTable(table)
    writeFileSync(join(dossier, `${table}.json`), JSON.stringify(lignes, null, 2))
    resume[table] = lignes.length
  } catch (e) {
    resume[table] = `ERREUR ${(e as Error).message.slice(0, 200)}`
  }
}
const comptes = await lireComptes()
writeFileSync(join(dossier, 'auth.users.json'), JSON.stringify(comptes, null, 2))
resume['auth.users'] = comptes.length

writeFileSync(join(dossier, '_resume.json'), JSON.stringify({ date: new Date().toISOString(), lignes: resume }, null, 2))
console.table(resume)
console.log(`Sauvegarde : ${dossier}`)
