import type { Database } from '~/types/database'

/**
 * Client Supabase du navigateur, typé.
 *
 * La session vit dans un cookie géré par @nuxtjs/supabase : elle est donc
 * connue du serveur au rendu, et les routes /api la lisent sans en-tête.
 */
export const useSupabase = () => useSupabaseClient<Database>()
