import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { env } from "@/lib/server/env" // Validates environment on first server module load

let _supabase: SupabaseClient | null = null

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!_supabase) {
      _supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY)
    }
    return Reflect.get(_supabase, prop, receiver)
  },
})
