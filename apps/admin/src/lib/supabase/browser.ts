import { createBrowserClient } from '@supabase/ssr';
import type { Database, CampusClient } from '@campuscycle/shared';

export const supabase: CampusClient = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
) as unknown as CampusClient;

export function getBrowserClient(): CampusClient {
  return supabase;
}
