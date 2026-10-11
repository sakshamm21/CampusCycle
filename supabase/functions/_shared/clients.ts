import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function serviceDb(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export function userDb(authHeader: string): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  return createClient(url, key, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
}
