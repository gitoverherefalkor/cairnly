// Render a DEMO account's report to PDF through the production pipeline and
// save it where /demo serves it as the "download her report" footnote.
//
//   node scripts/demo-render-pdf.mjs demo.marloes@cairnly.io
//   node scripts/demo-render-pdf.mjs demo.marloes@cairnly.io --report=<uuid> --keep-partner
//   node scripts/demo-render-pdf.mjs demo.marloes@cairnly.io \
//     --partner-name='[partnernaam]' --out=public/partners/cairnly-voorbeeldrapport-nl-template.pdf
//
// --partner-name=<name> renders the white-label TEMPLATE: the print route's
// `?pn=` override puts that name where the bureau's name goes and drops the
// logo (see partners/README.md). It implies --keep-partner, because the
// override only applies to a profile that has a partner link.
//
// Picks the report the committed fixture was frozen from (src/demo/fixtures/
// <persona>.<lang>.json → persona.reportId) so the PDF matches the transcript;
// --report=<uuid> overrides, and without a fixture it falls back to the
// newest completed report. Output: public/demo/cairnly-demo-<persona>-<lang>.pdf
// (or --out=<path>). `.gitignore` carves out public/demo/*.pdf on purpose.
//
// The render is the real thing: a single-use token in report_render_tokens,
// then POST /api/render-report on the live site with the shared secret from
// .env.local (see partners/README.md). `?sample=1` is always on, so the cover
// says "Voorbeeldrapport" and the file can never pass for a client's report.
//
// The demo profile is linked to the sample partner ("Loopbaanbureau
// Voorbeeld") for the white-labelled specimen on /partners. The public demo
// is not a partner story, so by default that link is cleared for the
// duration of the render and restored afterwards (also on failure). Pass
// --keep-partner to render the white-labelled variant instead.
//
// REFUSES any address that is not an obvious demo account: this touches the
// profile row and writes the resulting PDF into a public folder.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.cairnly.io';

const email = process.argv[2];
if (!email) {
  console.error('usage: node scripts/demo-render-pdf.mjs <email> [--report=<uuid>] [--out=<path>] [--keep-partner]');
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
const partnerName = flag('partner-name');
const keepPartner = process.argv.includes('--keep-partner') || partnerName !== undefined;

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
const renderSecret = env.RENDER_SHARED_SECRET;
if (!url || !serviceKey || !renderSecret) {
  console.error('VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / RENDER_SHARED_SECRET missing from .env.local');
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

// 1. User + profile.
const { data: list, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 });
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No auth user found for ${email}`);
  process.exit(1);
}
const { data: profile, error: profErr } = await admin
  .from('profiles')
  .select('partner_id, preferred_language')
  .eq('id', user.id)
  .maybeSingle();
if (profErr) throw profErr;
const language = (profile?.preferred_language || 'en').slice(0, 2).toLowerCase();
const personaSlug = email.split('@')[0].replace(/^demo[.\-+]/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();

// 2. Which report: the frozen fixture's, unless overridden.
let reportId = flag('report');
const fixturePath = join('src', 'demo', 'fixtures', `${personaSlug}.${language}.json`);
if (!reportId && existsSync(fixturePath)) {
  reportId = JSON.parse(readFileSync(fixturePath, 'utf8'))?.persona?.reportId;
  if (reportId) console.log(`report from fixture: ${reportId}`);
}
if (!reportId) {
  const { data: rep } = await admin
    .from('reports')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  reportId = rep?.id;
  if (reportId) console.log(`report (newest completed): ${reportId}`);
}
if (!reportId) {
  console.error('No report to render.');
  process.exit(1);
}
const { data: owned } = await admin.from('reports').select('id').eq('id', reportId).eq('user_id', user.id).maybeSingle();
if (!owned) {
  console.error(`Report ${reportId} does not belong to ${email}.`);
  process.exit(1);
}

const outPath = flag('out') ?? join('public', 'demo', `cairnly-demo-${personaSlug}-${language}.pdf`);

// 3. Optionally detach the partner for the duration of the render.
const originalPartner = profile?.partner_id ?? null;
const detachPartner = !keepPartner && originalPartner !== null;
const setPartner = async (value) => {
  const { error } = await admin.from('profiles').update({ partner_id: value }).eq('id', user.id);
  if (error) throw error;
};

try {
  if (detachPartner) {
    await setPartner(null);
    console.log(`partner link ${originalPartner} cleared for this render`);
  }

  // 4. Single-use render token (10-minute expiry by default).
  const { data: tok, error: tokErr } = await admin
    .from('report_render_tokens')
    .insert({ report_id: reportId, user_id: user.id })
    .select('token')
    .single();
  if (tokErr) throw tokErr;

  // 5. Render on the live site.
  const printUrl =
    `${SITE_URL}/report/print?rt=${tok.token}&sample=1` +
    (partnerName !== undefined ? `&pn=${encodeURIComponent(partnerName)}` : '');
  console.log('rendering… (30-90s)');
  const started = Date.now();
  const res = await fetch(`${SITE_URL}/api/render-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-render-secret': renderSecret },
    body: JSON.stringify({ printUrl }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.pdfBase64) {
    console.error(`render failed (${res.status}):`, JSON.stringify(body).slice(0, 600));
    process.exit(2);
  }
  const pdf = Buffer.from(body.pdfBase64, 'base64');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, pdf);
  console.log(`printBuild: ${body.printBuild ?? '(not reported)'}  pages: ${body.pages ?? '?'}  took ${Math.round((Date.now() - started) / 1000)}s`);
  console.log(`written: ${outPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
} finally {
  if (detachPartner) {
    await setPartner(originalPartner);
    console.log(`partner link ${originalPartner} restored`);
  }
}
