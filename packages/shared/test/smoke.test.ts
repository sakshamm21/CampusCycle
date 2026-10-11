import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampusClient } from '../src/api/client.ts';
import { signIn, getMyContext } from '../src/api/rider.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../..');

if (!process.env.SUPABASE_URL) {
  try {
    process.loadEnvFile(path.join(rootDir, '.env'));
  } catch {
    // ignore
  }
}

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);

describe('Smoke test: Rider API against hosted project', () => {
  it.skipIf(!hasSupabase)('signs in as demo rider and calls getMyContext', async () => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    expect(url).toBeDefined();
    expect(anonKey).toBeDefined();

    const client = createCampusClient(url!, anonKey!);

    const session = await signIn(client, 'demo-rider@example.com', 'ride-the-demo-2026');
    expect(session.user).toBeDefined();
    expect(session.user?.email).toBe('demo-rider@example.com');

    const ctx = await getMyContext(client);
    expect(ctx).toBeDefined();
    expect(ctx?.profile).toBeDefined();
    expect(ctx?.profile.email).toBe('demo-rider@example.com');
    expect(ctx?.profile.status).toBe('approved');
    expect(ctx?.pass).toBeDefined();
    expect(ctx?.college).toBeDefined();
    expect(ctx?.college?.short_code).toBe('IITK');
  });
});
