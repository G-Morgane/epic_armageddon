/** $fetch vers les routes admin. La session voyage dans le cookie Supabase. */
export const useAdminApi = () => ({
  get<T>(url: string) { return $fetch<T>(url) },
  post<T>(url: string, body: unknown) { return $fetch<T>(url, { method: 'POST', body: body as Record<string, unknown> }) },
  put<T>(url: string, body: unknown) { return $fetch<T>(url, { method: 'PUT', body: body as Record<string, unknown> }) },
  del<T>(url: string) { return $fetch<T>(url, { method: 'DELETE' }) },
})
