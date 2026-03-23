import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

export const useSupabase = () => {
  const config = useRuntimeConfig()

  const client = createClient<Database>(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  )

  return client
}
