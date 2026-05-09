import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

// Public client — uses anon key, respects Row Level Security
export const supabase: SupabaseClient = createClient(env.supabase.url, env.supabase.anonKey);

// Admin client — uses service role key, bypasses RLS. Use only in trusted server contexts.
export const supabaseAdmin: SupabaseClient = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
