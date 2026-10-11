import { createClient, SupabaseClient } from '@supabase/supabase-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile(path.join(rootDir, '.env'));
  } catch (err) {
    console.warn('Could not load .env:', err);
  }
}

export const adminClient: SupabaseClient = createClient(
  process.env.SUPABASE_URL || 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } },
);

export function createAnonClient(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } },
  );
}

export async function createAuthenticatedClient(
  email: string,
  password = 'ride-the-demo-2026',
): Promise<SupabaseClient> {
  const client = createClient(
    process.env.SUPABASE_URL || 'http://localhost:54321',
    process.env.SUPABASE_ANON_KEY || '',
    { auth: { persistSession: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export async function createTestCollege(code: string, prefix: string) {
  const { data, error } = await adminClient
    .from('colleges')
    .insert({
      name: `Test ${code}`,
      short_code: code,
      bike_prefix: prefix,
      email_domains: [`${code.toLowerCase()}.test`],
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createTestStand(collegeId: string, name: string, lat: number, lng: number) {
  const { data, error } = await adminClient
    .from('stands')
    .insert({ college_id: collegeId, name, lat, lng, radius_m: 40, capacity: 2 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createTestBike(collegeId: string, code: string, standId: string, isDemo = false) {
  const { data, error } = await adminClient
    .from('bikes')
    .insert({ college_id: collegeId, short_code: code, current_stand_id: standId, is_demo: isDemo })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}
export type { SupabaseClient };
