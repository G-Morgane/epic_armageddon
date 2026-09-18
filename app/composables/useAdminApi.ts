/** $fetch avec le jeton Supabase de l'admin connecté. */
export const useAdminApi = () => {
  const supabase = useSupabase()
  async function entetes() {
    const { data: { session } } = await supabase.auth.getSession()
    return { Authorization: `Bearer ${session?.access_token ?? ''}` }
  }
  return {
    async get<T>(url: string) { return $fetch<T>(url, { headers: await entetes() }) },
    async post<T>(url: string, body: unknown) { return $fetch<T>(url, { method: 'POST', body: body as Record<string, unknown>, headers: await entetes() }) },
    async put<T>(url: string, body: unknown) { return $fetch<T>(url, { method: 'PUT', body: body as Record<string, unknown>, headers: await entetes() }) },
    async del<T>(url: string) { return $fetch<T>(url, { method: 'DELETE', headers: await entetes() }) },
  }
}
