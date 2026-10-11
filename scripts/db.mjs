#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const USAGE = 'Usage: node scripts/db.mjs <push|reset|types|test> [--target dev|prod]';
const command = process.argv[2];
const targetIdx = process.argv.indexOf('--target');
const target = targetIdx === -1 ? 'dev' : process.argv[targetIdx + 1];

if (!['push', 'reset', 'types', 'test'].includes(command) || !['dev', 'prod'].includes(target)) {
  console.error(USAGE);
  process.exit(1);
}

// The production project holds real riders and is never wiped or used for tests.
// It only ever receives new migrations (push).
if (target === 'prod' && command !== 'push') {
  console.error(`[db] "${command}" runs against the dev project only. Production accepts "push".`);
  process.exit(1);
}

// dev reads .env, prod reads .env.prod (01 §3.4). In CI the dev values arrive as .env.
const envFile = target === 'prod' ? '.env.prod' : '.env';
const envPath = path.join(rootDir, envFile);
if (fs.existsSync(envPath)) {
  process.loadEnvFile(envPath);
} else if (target === 'prod') {
  console.error('[db] .env.prod not found');
  process.exit(1);
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
const dbUrl = process.env.SUPABASE_DB_URL;

if (!projectRef || !dbUrl) {
  console.error(`[db] SUPABASE_PROJECT_REF and SUPABASE_DB_URL must be set in ${envFile}`);
  process.exit(1);
}

// Last line of defence: .env must never point at the project named in .env.prod.
const prodEnvPath = path.join(rootDir, '.env.prod');
if (target === 'dev' && fs.existsSync(prodEnvPath)) {
  const prodRef = /^SUPABASE_PROJECT_REF=["']?([a-z0-9]+)/m.exec(fs.readFileSync(prodEnvPath, 'utf8'))?.[1];
  if (prodRef === projectRef) {
    console.error(
      '[db] .env points at the production project (same ref as .env.prod). Refusing to continue.',
    );
    process.exit(1);
  }
}

// Every CLI call names its database explicitly, so it never depends on which project is linked.
// The connection string holds the password: it goes to the CLI, never to the log.
function supabaseDb(args) {
  console.warn(`[db] Running: supabase db ${args} --db-url <${target}>`);
  execSync(`pnpm exec supabase db ${args} --db-url "${dbUrl}"`, { cwd: rootDir, stdio: 'inherit' });
}

function run(cmd) {
  console.warn(`[db] Running: ${cmd}`);
  execSync(cmd, { cwd: rootDir, stdio: 'inherit' });
}

async function handleReset() {
  console.warn(`[db] Resetting the dev database (${projectRef})...`);
  supabaseDb('reset --yes');

  console.warn('[db] Re-applying private configuration...');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const internalSecret = process.env.INTERNAL_SECRET;
  if (!serviceKey || !supabaseUrl || !internalSecret) {
    console.error(
      '[db] SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and INTERNAL_SECRET are required to re-apply private config',
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Must be in place before seed:auth creates the owner: the sign-up trigger reads owner_email.
  const config = {
    owner_email: process.env.OWNER_EMAIL ?? '',
    functions_base_url: `${supabaseUrl}/functions/v1`,
    internal_secret: internalSecret,
  };
  for (const [key, value] of Object.entries(config)) {
    let error;
    // Right after a reset the API may not have reloaded its schema cache yet (PGRST202).
    for (let attempt = 0; attempt < 10; attempt++) {
      ({ error } = await supabase.rpc('admin_set_app_config', { p_key: key, p_value: value }));
      if (error?.code !== 'PGRST202') break;
      await sleep(1500);
    }
    if (error) {
      console.error(`[db] Could not set app_config.${key}: ${error.message}`);
      process.exit(1);
    }
  }

  console.warn('[db] Calling pnpm seed:auth...');
  run('pnpm seed:auth');
}

async function main() {
  switch (command) {
    case 'push': {
      console.warn(`[db] Pushing migrations and seed to ${target} (${projectRef})...`);
      supabaseDb('push --include-all --include-seed');
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
      // One worker without isolation, so the files share their demo logins (sign-ins are rate limited).
      run(
        'pnpm exec vitest run supabase/tests/database --fileParallelism=false --no-isolate --testTimeout=60000 --hookTimeout=180000',
      );
      break;
    }
  }
}

main().catch((err) => {
  console.error('[db] Failed:', err.message);
  process.exit(1);
});
