export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: 'membre' | 'admin' | 'super_admin'
  created_at: string
}

/**
 * Session et profil de l'utilisateur courant.
 *
 * `user` vient de @nuxtjs/supabase : ce sont les claims du jeton (donc `sub`,
 * pas `id`), disponibles dès le rendu serveur. Le profil, lui, porte le rôle
 * applicatif et le pseudo, et se lit dans la table `profiles`.
 *
 * `useState` et non un `ref` de module : au rendu serveur, un ref de module
 * serait partagé entre deux visiteurs.
 */
export const useAuth = () => {
  const supabase = useSupabase()
  const user = useSupabaseUser()
  const profile = useState<Profile | null>('auth:profil', () => null)
  const chargePour = useState<string | null>('auth:profil-pour', () => null)

  const userId = computed(() => (user.value?.sub as string | undefined) ?? null)
  const isAuthenticated = computed(() => !!user.value)
  const loading = computed(() => isAuthenticated.value && chargePour.value !== userId.value)
  const isAdmin = computed(() => ['admin', 'super_admin'].includes(profile.value?.role ?? ''))
  const isSuperAdmin = computed(() => profile.value?.role === 'super_admin')
  /** Pseudo public ; null tant que le membre n'en a pas choisi un. */
  const pseudo = computed(() => profile.value?.display_name ?? null)

  async function fetchProfile() {
    if (!userId.value) {
      profile.value = null
      chargePour.value = null
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId.value).single()
    profile.value = (data as unknown as Profile) ?? null
    chargePour.value = userId.value
  }

  /** Charge le profil si ce n'est pas déjà fait pour cet utilisateur. */
  async function init() {
    if (chargePour.value !== userId.value) await fetchProfile()
  }

  /** Connexion par mot de passe : réservée aux comptes admin. */
  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    await fetchProfile()
  }

  /**
   * URL de retour du lien magique ou du détour par Google, et mémorisation de
   * la page à rouvrir : ni le gabarit d'email de Supabase ni le retour OAuth
   * ne savent d'où l'on vient, ils ne peuvent pas transporter la destination.
   */
  function preparerRetour(suivant: string) {
    useCookie('ea_suivant', { maxAge: 3600, path: '/', sameSite: 'lax' }).value = suivant
    // en local, le retour doit revenir sur localhost, pas sur le site public
    const base = import.meta.client ? location.origin : useRuntimeConfig().public.siteUrl
    return new URL('/connexion/retour', base).toString()
  }

  /**
   * Connexion des membres : un lien reçu par email, pas de mot de passe.
   * `suivant` est la page à rouvrir une fois le lien cliqué.
   */
  async function envoyerLienMagique(email: string, suivant = '/') {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: preparerRetour(suivant) },
    })
    if (error) throw error
  }

  /**
   * Connexion par compte Google. Le navigateur part chez Google et revient sur
   * /connexion/retour : le reste (création du profil, pseudo) est identique au
   * lien magique. Une même adresse utilisée des deux façons reste un seul
   * compte, Supabase rattache l'identité Google à l'email déjà vérifié.
   */
  async function connexionGoogle(suivant = '/') {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: preparerRetour(suivant) },
    })
    if (error) throw error
  }

  async function logout(destination = '/') {
    await supabase.auth.signOut()
    profile.value = null
    chargePour.value = null
    await navigateTo(destination)
  }

  return {
    user,
    userId,
    profile,
    pseudo,
    loading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    init,
    login,
    envoyerLienMagique,
    connexionGoogle,
    logout,
    fetchProfile,
  }
}
