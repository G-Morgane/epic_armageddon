import type { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'super_admin'
  created_at: string
}

const user = ref<User | null>(null)
const profile = ref<Profile | null>(null)
const loading = ref(true)

export const useAuth = () => {
  const supabase = useSupabase()

  const isAuthenticated = computed(() => !!user.value)
  const isAdmin = computed(() => !!profile.value && ['admin', 'super_admin'].includes(profile.value.role))
  const isSuperAdmin = computed(() => profile.value?.role === 'super_admin')

  async function fetchProfile() {
    if (!user.value) {
      profile.value = null
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .single()
    profile.value = data
  }

  async function init() {
    loading.value = true
    const { data: { session } } = await supabase.auth.getSession()
    user.value = session?.user ?? null
    await fetchProfile()
    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      await fetchProfile()
    })
  }

  async function login(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    profile.value = null
    navigateTo('/admin/login')
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    init,
    login,
    logout,
    fetchProfile,
  }
}
