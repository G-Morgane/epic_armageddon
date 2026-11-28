/**
 * Reporte l'illustration des fichiers YAML dans la dernière version publiée de chaque codex.
 *
 *   npx tsx scripts/synchroniser-couvertures.ts            # essai à blanc
 *   npx tsx scripts/synchroniser-couvertures.ts --ecrire   # applique
 *
 * Une fois un codex publié, la base prime sur le YAML : ajouter une couverture au fichier
 * reste invisible. Ce script modifie `data.codex.illustration` de la ligne publiée la plus
 * récente, sur place. Aucune nouvelle version n'est créée, l'historique n'est pas touché,
 * et seul ce champ est écrit.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chargerCodexBrut, listerSlugs } from '../shared/codex/charger'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const ecrire = process.argv.includes('--ecrire')

function chargerEnv() {
  const f = join(RACINE, '.env')
  if (!existsSync(f)) return
  for (const ligne of readFileSync(f, 'utf8').split('\n')) {
    const m = ligne.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]!]) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, '')
  }
}
chargerEnv()

const url = process.env.SUPABASE_URL ?? process.env.NUXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY
if (!url || !cle) { console.error('Identifiants Supabase absents de .env'); process.exit(1) }
const sb = createClient(url, cle)

async function main() {
  console.log(ecrire ? "Report des couvertures dans les versions publiées\n" : "Essai à blanc : rien n'est écrit (ajouter --ecrire)\n")
  let faits = 0, jour = 0, sans = 0, hors = 0

  for (const slug of listerSlugs()) {
    const illustration = chargerCodexBrut(slug).codex.illustration
    if (!illustration) { console.log(`  - ${slug.padEnd(26)} pas d'illustration dans le YAML`); sans++; continue }

    const { data, error } = await sb.from('codex_versions')
      .select('id, version, data').eq('slug', slug)
      .order('published_at', { ascending: false }).limit(1)
    if (error) { console.log(`  ! ${slug.padEnd(26)} ${error.message}`); continue }
    if (!data?.length) { console.log(`  · ${slug.padEnd(26)} pas publié, le YAML suffit`); hors++; continue }

    const ligne = data[0]!
    const brut = ligne.data as { codex: { illustration?: string } }
    if (brut.codex.illustration === illustration) { jour++; continue }

    if (!ecrire) { console.log(`  ↑ ${slug.padEnd(26)} v${ligne.version} recevrait sa couverture`); faits++; continue }

    const { error: e2 } = await sb.from('codex_versions')
      .update({ data: { ...brut, codex: { ...brut.codex, illustration } } }).eq('id', ligne.id)
    if (e2) { console.log(`  ! ${slug.padEnd(26)} ${e2.message}`); continue }
    console.log(`  ↑ ${slug.padEnd(26)} v${ligne.version} mise à jour`)
    faits++
  }

  console.log(`\n${faits} mise(s) à jour, ${jour} déjà à jour, ${sans} sans illustration, ${hors} non publié(s).`)
  if (!ecrire && faits) console.log('Relancer avec --ecrire pour appliquer.')
}

main().catch((e) => { console.error(e); process.exit(1) })
