#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables if .env exists
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.error('[db] Error loading .env:', err.message);
  }
}

const command = process.argv[2];

if (!command || !['push', 'reset', 'types', 'test'].includes(command)) {
  console.error('Usage: node scripts/db.mjs <push|reset|types|test>');
  process.exit(1);
}

function run(cmd, env = process.env) {
  console.warn(`[db] Running: ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit', env });
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!projectRef || !dbUrl) {
  console.error('[db] SUPABASE_PROJECT_REF and SUPABASE_DB_URL must be set in .env');
  process.exit(1);
}

async function handleReset() {
  console.warn('[db] Resetting linked database...');
  run('pnpm exec supabase db reset --linked --yes');

  console.warn('[db] Re-applying private configuration...');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    console.error('[db] SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL are required to re-apply private config');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const ownerEmail = process.env.OWNER_EMAIL ?? 'owner@example.com';
  const functionsBaseUrl = `${supabaseUrl}/functions/v1`;
  const internalSecret = process.env.INTERNAL_SECRET;

  const { error } = await supabase
    .schema('private')
    .from('app_config')
    .upsert([
      { key: 'owner_email', value: ownerEmail },
      { key: 'functions_base_url', value: functionsBaseUrl },
      { key: 'internal_secret', value: internalSecret ?? '' },
    ]);

  if (error) {
    console.warn(`[db] Notice updating app_config: ${error.message}`);
  }

  console.warn('[db] Calling pnpm seed:auth...');
  run('pnpm seed:auth');
}

async function main() {
  switch (command) {
    case 'push': {
      console.warn('[db] Pushing database migrations and seed...');
      run('pnpm exec supabase db push --include-all --include-seed');
      break;
    }
    case 'reset': {
      await handleReset();
      break;
    }
    case 'types': {
      console.warn(`[db] Generating types for project ${projectRef}...`);
      const targetPath = path.join(rootDir, 'packages', 'shared', 'src', 'database.types.ts');
      const typesOutput = execSync(
        `pnpm exec supabase gen types typescript --project-id ${projectRef} --schema public`,
        { cwd: rootDir, encoding: 'utf8' },
      );
      fs.writeFileSync(targetPath, typesOutput, 'utf8');
      console.warn(`[db] Generated ${targetPath}`);
      break;
    }
    case 'test': {
      console.warn('[db] Running database tests...');
      run('pnpm exec vitest run supabase/tests/database --fileParallelism=false --testTimeout=30000');
      break;
    }
  }
}

main().catch((err) => {
  console.error('[db] Failed:', err.message);
  process.exit(1);
});
