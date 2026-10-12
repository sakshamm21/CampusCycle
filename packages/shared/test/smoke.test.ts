import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCampusClient } from '../src/api/client.ts';
import { signIn, getMyContext, previewBike } from '../src/api/rider.ts';
import { AppError } from '../src/errors.ts';

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
  it.skipIf(!hasSupabase)(
    'signs in as demo rider and calls getMyContext',
    async () => {
      const url = process.env.SUPABASE_URL;
      const anonKey = process.env.SUPABASE_ANON_KEY;

      const client = createCampusClient(url!, anonKey!);

      const session = await signIn(client, 'demo-rider@example.com', 'ride-the-demo-2026');
      expect(session.user?.email).toBe('demo-rider@example.com');

      const ctx = await getMyContext(client);
      expect(ctx?.profile.email).toBe('demo-rider@example.com');
      expect(ctx?.profile.status).toBe('approved');
      expect(ctx?.pass.status).toBe('ready');
      expect(ctx?.college?.short_code).toBe('IITK');

      // A refused rider RPC must reach the caller as an AppError, never as a result.
      const refused = previewBike(client, 'K-001', 'forged_signature_00000');
      await expect(refused).rejects.toBeInstanceOf(AppError);
      await expect(refused).rejects.toMatchObject({ code: 'CC_BAD_QR' });
    },
    20_000,
  );
});
