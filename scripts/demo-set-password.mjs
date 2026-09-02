// Set a known password on a DEMO account, so you can log in as the persona.
//
//   node scripts/demo-set-password.mjs demo.marloes@cairnly.io
//
// Reads SUPABASE_SERVICE_ROLE_KEY + VITE_SUPABASE_URL from .env.local, sets a
// freshly generated password via the admin API, prints it, and appends it to
// .env.local so it is not lost again. .env.local is gitignored.
//
// REFUSES any address that is not an obvious demo account, because this uses
// the service role and would otherwise happily reset a real customer's login.
import { readFileSync, appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/demo-set-password.mjs <email>');
  process.exit(1);
}

// Guard rail. Widen deliberately if you ever add another demo domain.
if (!/^demo[.\-+]/i.test(email)) {
  console.error(
    `Refusing "${email}": this script is for demo accounts only (address must start with "demo.").\n` +
      'It runs with the service role and would reset a real user\'s password without warning.',
  );
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const url = env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// Find the user by email.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}

// 24 bytes of base64url — long enough that it never needs rotating, short
// enough to paste.
const password = randomBytes(24).toString('base64url');

const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true, // a seeded demo user may never have confirmed
});
if (updErr) throw updErr;

const varName = 'DEMO_' + email.split('@')[0].replace(/[^a-z0-9]+/gi, '_').toUpperCase() + '_PASSWORD';
appendFileSync('.env.local', `\n${varName}=${password}\n`);

console.log(`\n  ${email}`);
console.log(`  ${password}\n`);
console.log(`  Saved to .env.local as ${varName} (gitignored).`);
