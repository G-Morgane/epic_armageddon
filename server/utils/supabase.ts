import { createClient } from '@supabase/supabase-js'
import type { Database } from '~/types/database'

export const useSupabaseServer = () => {
  const config = useRuntimeConfig()

  return createClient<Database>(
    config.supabaseUrl,
    config.supabaseServiceRoleKey,
  )
}
