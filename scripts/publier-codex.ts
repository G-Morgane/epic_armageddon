/**
 * Publie les codex des fichiers YAML dans Supabase, pour que la base devienne la source.
 *
 *   npx tsx scripts/publier-codex.ts                     # essai à blanc : valide tout, n'écrit rien
 *   npx tsx scripts/publier-codex.ts --ecrire --texte "…"  # publie ceux qui n'ont aucune version
 *   npx tsx scripts/publier-codex.ts --ecrire --texte "…" --republier  # publie aussi ceux déjà publiés
 *   npx tsx scripts/publier-codex.ts --ecrire --texte "…" tyranides    # limite à un ou plusieurs slugs
 *
 * `--texte` est obligatoire dès qu'on écrit : il devient le changelog de chaque
 * version publiée, et c'est ce que les joueurs lisent dans l'historique. Il
 * était écrit en dur, ce qui faisait partir la même phrase sur tout, vraie la
 * première fois et fausse ensuite.
 *
 * Applique les mêmes contrôles que le bouton Publier de l'admin : schéma strict,
 * références croisées, puis rejeu des listes de test. Un codex en échec est signalé
 * et sauté, les autres passent.
 *
 * N'écrit que dans la table codex_versions. Les brouillons et le reste de la base
 * ne sont pas touchés.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chargerCodexBrut, listerSlugs } from '../shared/codex/charger'
import { chargerCodex, verifierReferences } from '../shared/codex/schema'
import { indexerCodex, calculerListe, varianteParDefaut } from '../shared/codex/engine'
import { normaliserFormation } from '../shared/codex/liste'
import { fusionnerAllies, alliesReferences } from '../shared/codex/allies'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const ecrire = args.includes('--ecrire')
const republier = args.includes('--republier')

/** `--texte "..."` ou `--texte=...`. Les deux, parce que les deux se tapent. */
function lireTexte(): { valeur: string; consomme: number } {
  const i = args.findIndex((a) => a === '--texte' || a.startsWith('--texte='))
  if (i === -1) return { valeur: '', consomme: -1 }
  const a = args[i]!
  if (a.startsWith('--texte=')) return { valeur: a.slice('--texte='.length), consomme: -1 }
  return { valeur: args[i + 1] ?? '', consomme: i + 1 }
}
const { valeur: texte, consomme } = lireTexte()
const cibles = args.filter((a, i) => !a.startsWith('--') && i !== consomme)

if (ecrire && !texte.trim()) {
  console.error('--texte "ce que change cette publication" est requis avec --ecrire.')
  console.error('Il est affiché aux joueurs dans l\'historique des versions.')
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

const url = process.env.SUPABASE_URL ?? process.env.NUXT_PUBLIC_SUPABASE_URL
const cle = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY
if (!url || !cle) {
  console.error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY absente de .env')
  process.exit(1)
}
const sb = createClient(url, cle)

/** Contrôles identiques à ceux du bouton Publier. Renvoie la liste des problèmes. */
function controler(slug: string, brut: unknown): string[] {
  const problemes: string[] = []
  let codex
  try {
    codex = chargerCodex(brut)
  } catch (e) {
    return [`schéma : ${(e as Error).message.split('\n')[0]}`]
  }
  problemes.push(...verifierReferences(codex))

  // les alliés doivent exister, sinon le PDF et le builder tomberont
  const allies: Record<string, ReturnType<typeof chargerCodex>> = {}
  for (const a of alliesReferences(codex)) {
    try { allies[a] = chargerCodex(chargerCodexBrut(a)) } catch { problemes.push(`codex allié introuvable : ${a}`) }
  }
  const complet = Object.keys(allies).length ? fusionnerAllies(codex, allies) : codex

  const idx = indexerCodex(complet)
  for (const t of complet.listes_test) {
    const liste = {
      id: 't', nom: t.nom, codex: slug, limite: t.limite,
      formations: t.formations.map((f) => normaliserFormation(f as never, (id) => varianteParDefaut(idx, id))),
    }
    const r = calculerListe(idx, liste)
    if (t.attendu === 'valide' && !r.valide) problemes.push(`liste de test « ${t.nom} » devrait être valide : ${r.erreurs.map((e) => e.message).join(' ; ')}`)
    if (t.attendu === 'refusee' && r.valide) problemes.push(`liste de test « ${t.nom} » devrait être refusée`)
    if (t.attendu === 'refusee' && t.erreur && !r.erreurs.some((e) => e.type === t.erreur)) problemes.push(`liste de test « ${t.nom} » : erreur ${t.erreur} attendue`)
  }
  return problemes
}

async function main() {
  const slugs = (cibles.length ? cibles : listerSlugs()).sort()
  console.log(ecrire ? 'Publication des codex dans Supabase\n' : "Essai à blanc : validation seule, rien n'est écrit (ajouter --ecrire)\n")

  let publies = 0
  let sautes = 0
  let echecs = 0

  for (const slug of slugs) {
    let brut: ReturnType<typeof chargerCodexBrut>
    try {
      brut = chargerCodexBrut(slug)
    } catch {
      console.log(`  ! ${slug.padEnd(24)} fichier YAML introuvable`)
      echecs++
      continue
    }

    const { data: deja, error: eLecture } = await sb.from('codex_versions').select('version').eq('slug', slug).order('published_at', { ascending: false }).limit(1)
    if (eLecture) {
      console.log(`  ! ${slug.padEnd(24)} lecture des versions : ${eLecture.message}`)
      echecs++
      continue
    }
    if (deja?.length && !republier) {
      console.log(`  = ${slug.padEnd(24)} déjà publié en v${deja[0]!.version} (--republier pour refaire)`)
      sautes++
      continue
    }

    const problemes = controler(slug, brut)
    if (problemes.length) {
      console.log(`  ✗ ${slug.padEnd(24)} ${problemes.length} problème(s)`)
      for (const p of problemes.slice(0, 6)) console.log(`      ${p}`)
      if (problemes.length > 6) console.log(`      … et ${problemes.length - 6} autre(s)`)
      echecs++
      continue
    }

    const version = String((brut as { codex: { version?: string } }).codex.version ?? '1.0')
    if (!ecrire) {
      console.log(`  ↑ ${slug.padEnd(24)} v${version} prêt à publier`)
      publies++
      continue
    }

    const { error } = await sb.from('codex_versions').insert({
      slug,
      version,
      // Lu par les joueurs, pas par nous : il dit ce qui change POUR EUX, pas
      // d'où vient le fichier. La première vague est partie avec « Changement du
      // fonctionnement des PDF et du constructeur d'armée. Aucune modification
      // de la liste effective. »
      changelog: texte.trim(),
      data: brut,
      published_at: new Date().toISOString(),
    })
    if (error) {
      console.log(`  ! ${slug.padEnd(24)} publication : ${error.message}`)
      echecs++
      continue
    }
    console.log(`  ↑ ${slug.padEnd(24)} publié en v${version}`)
    publies++
  }

  console.log(`\n${publies} publié(s), ${sautes} sauté(s), ${echecs} en échec.`)
  if (!ecrire && publies) console.log('Relancer avec --ecrire pour appliquer.')
  if (echecs) process.exitCode = 1
}

main().catch((e) => { console.error(e); process.exit(1) })
