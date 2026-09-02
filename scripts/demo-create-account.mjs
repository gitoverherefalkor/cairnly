// Create a DEMO persona account the way a real signup would leave it: an
// auth user (email confirmed, `demo: true` in the metadata) whose profile row
// the `handle_new_user` trigger fills from first_name / last_name, then the
// profile fields a persona needs (preferred language, country).
//
//   node scripts/demo-create-account.mjs demo.emma@cairnly.io \
//     --first=Emma --last=Whitfield --lang=en --country='United Kingdom'
//
// Follow up with `node scripts/demo-set-password.mjs <email>` for a login the
// sibling scripts can use, then `demo-rerun-report.mjs <email> --payload=…`
// to run the persona's survey answers through the pipeline.
//
// Idempotent: an existing user is left alone (the profile fields are still
// applied), so re-running after a partial failure is safe.
//
// REFUSES any address that is not an obvious demo account: this runs with the
// service role and writes an auth user + profile.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error(
    'usage: node scripts/demo-create-account.mjs <email> --first=<name> --last=<name> [--lang=en|nl] [--country=<name>]',
  );
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}
const flag = (name) => {
  const hit = process.argv.slice(3).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const firstName = flag('first');
const lastName = flag('last') ?? '';
const lang = (flag('lang') ?? 'en').slice(0, 2).toLowerCase();
const country = flag('country');
if (!firstName) {
  console.error('--first=<name> is required (it becomes profiles.first_name, which the coach uses).');
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
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local');
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. Auth user (or the existing one).
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
let user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (user) {
  console.log(`auth user exists: ${user.id}`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // Same metadata shape as the existing demo account: the profile trigger
    // reads first_name / last_name, and `demo: true` marks the persona.
    user_metadata: { demo: true, first_name: firstName, last_name: lastName },
  });
  if (error) throw error;
  user = data.user;
  console.log(`auth user created: ${user.id}`);
}

// 2. Profile fields the trigger does not set. The trigger runs synchronously
//    with the insert, so the row exists by now; upsert anyway in case it
//    was ever removed.
const profilePatch = {
  id: user.id,
  email,
  first_name: firstName,
  last_name: lastName || null,
  preferred_language: lang,
  ...(country ? { country } : {}),
};
const { error: profErr } = await admin.from('profiles').upsert(profilePatch, { onConflict: 'id' });
if (profErr) throw profErr;

const { data: profile } = await admin
  .from('profiles')
  .select('id, email, first_name, last_name, preferred_language, country, partner_id')
  .eq('id', user.id)
  .maybeSingle();
console.log('profile:', JSON.stringify(profile));
console.log(`\nNext: node scripts/demo-set-password.mjs ${email}`);
