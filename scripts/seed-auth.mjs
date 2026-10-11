#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Parse --target flag (default: dev)
const args = process.argv.slice(2);
let target = 'dev';
const targetIdx = args.indexOf('--target');
if (targetIdx !== -1 && args[targetIdx + 1]) {
  target = args[targetIdx + 1];
}

const envFile = target === 'prod' ? '.env.prod' : '.env';
const envPath = path.join(rootDir, envFile);
if (fs.existsSync(envPath)) {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn(`[seed-auth] Warning loading ${envFile}:`, err.message);
  }
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('[seed-auth] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const IITK_ID = '11111111-1111-4111-8111-111111111111';
const DEMO_PASSWORD = 'ride-the-demo-2026';

const SAMPLE_NAMES = [
  'Arjun Mehta',
  'Diya Patel',
  'Vihaan Rao',
  'Saanvi Nair',
  'Aditya Kumar',
  'Ananya Joshi',
  'Reyansh Das',
  'Myra Kapoor',
  'Krish Malhotra',
  'Aarohi Bose',
  'Vivaan Reddy',
  'Kiara Menon',
  'Ayaan Chatterjee',
  'Ira Shah',
  'Dhruv Pillai',
  'Tara Banerjee',
  'Rudra Saxena',
  'Anika Desai',
  'Shaurya Kulkarni',
  'Zoya Khan',
];

const APPLICANT_NAMES = ['Ishaan Gupta', 'Meera Iyer', 'Kabir Singh', 'Rohan Verma'];

function randomPassword() {
  return crypto.randomBytes(18).toString('base64url').slice(0, 24);
}

async function listAllUsers() {
  const users = new Map();
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    if (!data.users || data.users.length === 0) break;
    for (const u of data.users) {
      if (u.email) users.set(u.email.toLowerCase(), u);
    }
    if (data.users.length < 200) break;
    page++;
  }
  return users;
}

async function getOrCreateUser(existingUsers, { email, password, full_name, roll_number, phone }) {
  const normEmail = email.toLowerCase();
  if (existingUsers.has(normEmail)) {
    return existingUsers.get(normEmail);
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email: normEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name,
      college_id: IITK_ID,
      phone,
      roll_number,
    },
  });
  if (error) throw error;
  existingUsers.set(normEmail, data.user);
  return data.user;
}

async function main() {
  console.log(`[seed-auth] Seeding auth for target: ${target}`);
  const existingUsers = await listAllUsers();

  // 1. Core demo users
  const coreUsers = [
    {
      kind: 'rider',
      email: 'demo-rider@example.com',
      password: DEMO_PASSWORD,
      full_name: 'Aanya Sharma',
      pass_number: 421,
      roll_number: '230421',
      phone: '+91 90000 00421',
    },
    {
      kind: 'college_admin',
      email: 'demo-admin@example.com',
      password: DEMO_PASSWORD,
      full_name: 'Demo Admin',
      pass_number: 422,
      roll_number: 'ADM-001',
      phone: '+91 90000 00422',
    },
    {
      kind: 'super_admin',
      email: 'demo-super@example.com',
      password: DEMO_PASSWORD,
      full_name: 'Demo Super Admin',
      pass_number: 423,
      roll_number: 'ADM-002',
      phone: '+91 90000 00423',
    },
  ];

  for (const item of coreUsers) {
    const user = await getOrCreateUser(existingUsers, item);
    const { error: rpcErr } = await supabase.rpc('admin_setup_demo_account', {
      p_user: user.id,
      p_kind: item.kind,
      p_college: IITK_ID,
      p_pass_number: item.pass_number,
    });
    if (rpcErr) throw new Error(`setup demo account ${item.email}: ${rpcErr.message}`);
  }

  // 2. 20 Sample riders
  for (let i = 0; i < 20; i++) {
    const numStr = String(i + 1).padStart(2, '0');
    const passNum = 101 + i;
    const item = {
      kind: 'sample_rider',
      email: `sample${numStr}@example.com`,
      password: randomPassword(),
      full_name: SAMPLE_NAMES[i],
      pass_number: passNum,
      roll_number: `2301${numStr}`,
      phone: `+91 90000 001${numStr}`,
    };
    const user = await getOrCreateUser(existingUsers, item);
    const { error: rpcErr } = await supabase.rpc('admin_setup_demo_account', {
      p_user: user.id,
      p_kind: item.kind,
      p_college: IITK_ID,
      p_pass_number: item.pass_number,
    });
    if (rpcErr) throw new Error(`setup sample rider ${item.email}: ${rpcErr.message}`);
  }

  // 3. 4 Applicants
  const idCardsDir = path.resolve(rootDir, 'supabase/seed/assets/id-cards');
  for (let i = 0; i < 4; i++) {
    const numStr = String(i + 1).padStart(2, '0');
    const item = {
      kind: 'applicant',
      email: `applicant${numStr}@example.com`,
      password: randomPassword(),
      full_name: APPLICANT_NAMES[i],
      pass_number: null,
      roll_number: `2402${numStr}`,
      phone: `+91 90000 002${numStr}`,
    };
    const user = await getOrCreateUser(existingUsers, item);
    const { error: rpcErr } = await supabase.rpc('admin_setup_demo_account', {
      p_user: user.id,
      p_kind: item.kind,
      p_college: IITK_ID,
      p_pass_number: null,
    });
    if (rpcErr) throw new Error(`setup applicant ${item.email}: ${rpcErr.message}`);

    // Upload ID card
    const idCardPath = path.join(idCardsDir, `applicant${numStr}.png`);
    if (fs.existsSync(idCardPath)) {
      const buffer = fs.readFileSync(idCardPath);
      const targetPath = `${user.id}/id-sample.png`;
      const { error: uploadErr } = await supabase.storage.from('id-cards').upload(targetPath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });
      if (uploadErr) throw new Error(`upload ID card for ${item.email}: ${uploadErr.message}`);
      const { error: pathErr } = await supabase
        .from('profiles')
        .update({ id_photo_path: targetPath })
        .eq('id', user.id);
      if (pathErr) throw new Error(`set ID card path for ${item.email}: ${pathErr.message}`);
    }
  }

  // 4. Owner user
  const ownerEmail = process.env.OWNER_EMAIL;
  const ownerPassword = process.env.OWNER_PASSWORD;
  if (ownerEmail && ownerPassword) {
    if (!existingUsers.has(ownerEmail.toLowerCase())) {
      const { error: ownerErr } = await supabase.auth.admin.createUser({
        email: ownerEmail,
        password: ownerPassword,
        email_confirm: true,
        user_metadata: { full_name: 'Owner' },
      });
      if (ownerErr) throw new Error(`create owner: ${ownerErr.message}`);
      console.log('owner: created');
    } else {
      console.log('owner: exists');
    }
  }

  // 5. Run demo reset
  console.log('[seed-auth] Running admin_run_demo_reset...');
  const { error: resetErr } = await supabase.rpc('admin_run_demo_reset');
  if (resetErr) throw new Error(`admin_run_demo_reset: ${resetErr.message}`);

  // 6. Print summary table
  console.log('\nDemo Logins:');
  console.table([
    { Role: 'Rider', Email: 'demo-rider@example.com', Password: DEMO_PASSWORD },
    { Role: 'College Admin', Email: 'demo-admin@example.com', Password: DEMO_PASSWORD },
    { Role: 'Super Admin', Email: 'demo-super@example.com', Password: DEMO_PASSWORD },
  ]);
  console.log('done\n');
}

main().catch((err) => {
  console.error('[seed-auth] Fatal error:', err);
  process.exit(1);
});
