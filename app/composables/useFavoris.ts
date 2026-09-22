/** Un favori tel que la page « Mon compte » l'affiche. */
export interface FavoriArmee {
  army_id: string
  nom: string
  faction: string
  cover_image: string | null
  created_at: string
}

/**
 * Codex favoris de l'utilisateur connecté (table `favoris_armee`).
 * Sans session, la liste reste vide : l'étoile renvoie alors vers la connexion.
 *
 * `useState` et non un ref de module : au rendu serveur, un ref de module serait
 * partagé entre deux visiteurs.
 */
export const useFavoris = () => {
  const utilisateur = useSupabaseUser()
  const favoris = useState<FavoriArmee[]>('favoris:liste', () => [])
  const chargePour = useState<string | null>('favoris:charge-pour', () => null)

  const connecte = computed(() => !!utilisateur.value)
  const userId = computed(() => (utilisateur.value?.sub as string | undefined) ?? null)

  async function rafraichir() {
    if (!connecte.value) {
      favoris.value = []
      chargePour.value = null
      return
    }
    favoris.value = await $fetch<FavoriArmee[]>('/api/favoris')
    chargePour.value = userId.value
  }

  /** Charge les favoris si ce n'est pas déjà fait pour cet utilisateur. */
  async function init() {
    if (chargePour.value !== userId.value) await rafraichir()
  }

  const estFavori = (armyId: string) => favoris.value.some((f) => f.army_id === armyId)

  /**
   * L'étoile change d'état tout de suite ; l'appel serveur suit.
   * En cas d'échec, la liste est relue pour ne pas rester sur un état inventé.
   */
  async function basculer(armee: { id: string; name: string; faction: string; cover_image?: string | null }) {
    if (!connecte.value) return
    const avant = favoris.value
    if (estFavori(armee.id)) {
      favoris.value = favoris.value.filter((f) => f.army_id !== armee.id)
      try { await $fetch(`/api/favoris/${armee.id}`, { method: 'DELETE' }) }
      catch (e) { favoris.value = avant; throw e }
    } else {
      favoris.value = [
        { army_id: armee.id, nom: armee.name, faction: armee.faction, cover_image: armee.cover_image ?? null, created_at: new Date().toISOString() },
        ...favoris.value,
      ]
      try { await $fetch('/api/favoris', { method: 'POST', body: { army_id: armee.id } }) }
      catch (e) { favoris.value = avant; throw e }
    }
  }

  return { favoris, connecte, init, rafraichir, estFavori, basculer }
}
