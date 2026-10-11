import { createClient, type SupabaseClient, type SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '../database.types.ts';

export type CampusClient = SupabaseClient<Database>;

export function createCampusClient(url: string, anonKey: string, storage?: SupportedStorage): CampusClient {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storage,
    },
  });
}
