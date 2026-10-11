#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const targetArg = process.argv.includes('--target')
  ? process.argv[process.argv.indexOf('--target') + 1]
  : 'dev';

const envFile = targetArg === 'prod' ? '.env.prod' : '.env';
const envPath = path.join(rootDir, envFile);

if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.error(`[deploy-functions] Error loading ${envFile}:`, err.message);
  }
}

const projectRef = process.env.SUPABASE_PROJECT_REF;
if (!projectRef) {
  console.error(`[deploy-functions] SUPABASE_PROJECT_REF not found in ${envFile}`);
  process.exit(1);
}

// Order from 03 §4.1
const FUNCTION_INVENTORY = [
  { name: 'torq-chat', verifyJwt: true },
  { name: 'torq-action', verifyJwt: true },
  { name: 'torq-suggest', verifyJwt: true },
  { name: 'torq-worker', verifyJwt: false },
  { name: 'torq-cron', verifyJwt: false },
  { name: 'torq-knowledge', verifyJwt: false },
  { name: 'push-send', verifyJwt: false },
  { name: 'cleanup-photos', verifyJwt: false },
  { name: 'delete-account', verifyJwt: true },
  { name: 'admin-reset-password', verifyJwt: true },
];

console.warn(`[deploy-functions] Deploying Edge Functions to project ${projectRef}...`);

for (const fn of FUNCTION_INVENTORY) {
  const fnDir = path.join(rootDir, 'supabase', 'functions', fn.name);
  if (!fs.existsSync(fnDir)) {
    continue; // Deploy only functions that have been authored so far
  }

  const noJwtFlag = fn.verifyJwt ? '' : '--no-verify-jwt';
  const cmd =
    `pnpm exec supabase functions deploy ${fn.name} --project-ref ${projectRef} --use-api ${noJwtFlag}`.trim();
  console.warn(`[deploy-functions] Deploying ${fn.name}...`);
  try {
    execSync(cmd, { cwd: rootDir, stdio: 'inherit', env: process.env });
  } catch (err) {
    console.error(`[deploy-functions] Failed to deploy ${fn.name}:`, err.message);
    process.exit(1);
  }
}

console.warn('[deploy-functions] Edge Functions deployment finished successfully.');
