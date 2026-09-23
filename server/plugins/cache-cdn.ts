/**
 * Corrige l'en-tête `cache-control` que Nitro pose sur les routes en cache.
 *
 * `defineCachedEventHandler` (server/utils/cache.ts) tamponne sa réponse avec
 * `s-maxage=300, stale-while-revalidate`. Deux défauts, tous deux invisibles en
 * local puisqu'il n'y a pas de CDN devant :
 *
 * 1. `?fresh=1` le reçoit aussi. `shouldBypassCache` ne court-circuite que le
 *    cache mémoire de Nitro : la réponse repart bien de la base, mais le CDN la
 *    garde ensuite cinq minutes sous cette URL. Les écrans d'admin, seuls à
 *    passer ce paramètre, ne verraient donc plus leur propre écriture, ce qui
 *    est exactement ce que l'échappatoire devait garantir.
 *
 * 2. `stale-while-revalidate` est posé sans durée. La directive attend un
 *    nombre de secondes ; sans lui, le CDN revalide de façon synchrone à
 *    l'expiration et le visiteur qui tombe dessus repaie l'aller-retour.
 *
 * Le hook passe après le handler, donc après que Nitro a écrit son en-tête.
 */

// Durée pendant laquelle le CDN peut encore servir une réponse périmée en
// régénérant derrière. Volontairement large : ces données changent quelques
// fois par mois, personne ne doit jamais attendre la base.
const PERIME_TOLERE = 600

export default defineNitroPlugin((nitro) => {
  nitro.hooks.hook('beforeResponse', (event) => {
    const entete = getResponseHeader(event, 'cache-control')
    if (typeof entete !== 'string' || !entete.includes('s-maxage')) return

    // L'admin demande explicitement la base : rien ne doit s'interposer.
    if (getQuery(event).fresh) {
      setResponseHeader(event, 'cache-control', 'private, no-store')
      return
    }

    if (/stale-while-revalidate(?!=)/.test(entete)) {
      setResponseHeader(event, 'cache-control', entete.replace(/stale-while-revalidate(?!=)/, `stale-while-revalidate=${PERIME_TOLERE}`))
    }
  })
})
