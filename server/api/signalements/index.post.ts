import type { SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseUser } from '#supabase/server'
import type { Liste } from '~~/shared/codex/liste'
import type { Categorie } from '~~/server/utils/signalements'

/**
 * Envoi d'un signalement de bug depuis le builder.
 *
 * Ouvert : le builder s'utilise sans compte, exiger une session reviendrait à
 * ne recevoir qu'une partie des bugs. La session, si elle existe, rattache le
 * signalement à son auteur et remplit le pseudo.
 */

interface Corps {
  categorie?: string
  message?: string
  page?: string
  emplacement?: string
  url?: string
  email?: string
  codex?: string
  codex_nom?: string
  codex_version?: string
  faction?: string
  liste_id?: string
  liste_nom?: string
  liste_total?: number
  liste_limite?: number
  liste_valide?: boolean
  liste_data?: Liste
  liste_erreurs?: string[]
  ecran?: string
}

/** Garde-fou : la colonne est bornée en base, on coupe avant plutôt que de renvoyer une erreur SQL. */
const couper = (v: string | undefined | null, max: number) => (v ? v.trim().slice(0, max) : null)

export default defineEventHandler(async (event) => {
  const corps = await readBody<Corps>(event)
  const message = corps?.message?.trim() ?? ''
  if (message.length < 5) throw createError({ statusCode: 400, message: 'Décris le problème en quelques mots (5 caractères minimum)' })
  if (message.length > 4000) throw createError({ statusCode: 400, message: 'Message trop long (4000 caractères maximum)' })

  const categorie: Categorie = CATEGORIES.includes(corps.categorie as Categorie) ? (corps.categorie as Categorie) : 'autre'

  const claims = await serverSupabaseUser(event).catch(() => null)
  const userId = (claims?.sub as string | undefined) ?? null
  let pseudo: string | null = null
  if (userId) {
    const sb = useSupabaseServer() as unknown as SupabaseClient
    const { data } = await sb.from('profiles').select('display_name').eq('id', userId).maybeSingle()
    pseudo = (data as { display_name?: string } | null)?.display_name ?? null
  }

  return creerSignalement({
    user_id: userId,
    pseudo,
    email: couper(corps.email, 200),
    categorie,
    message,
    page: couper(corps.page, 60) ?? 'builder',
    emplacement: couper(corps.emplacement, 120),
    url: couper(corps.url, 500),
    codex: couper(corps.codex, 120),
    codex_nom: couper(corps.codex_nom, 200),
    codex_version: couper(corps.codex_version, 40),
    faction: couper(corps.faction, 120),
    // une liste n'est rattachée que si elle est bien enregistrée sur le compte,
    // sinon la clé étrangère rejette l'insertion
    liste_id: userId && corps.liste_id ? corps.liste_id : null,
    liste_nom: couper(corps.liste_nom, 200),
    liste_total: corps.liste_total ?? null,
    liste_limite: corps.liste_limite ?? null,
    liste_valide: corps.liste_valide ?? null,
    liste_data: corps.liste_data ?? null,
    liste_erreurs: corps.liste_erreurs?.slice(0, 50) ?? null,
    user_agent: couper(getRequestHeader(event, 'user-agent'), 400),
    ecran: couper(corps.ecran, 40),
  })
})
