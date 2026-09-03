// Run the REAL job search once for a DEMO persona and freeze the result into
// the persona's fixture, for the public /demo/jobs page (phase 4 of
// docs/handoff/demo-toolkit-plan.md). Then mark a few listings as saved.
//
//   node scripts/demo-run-job-search.mjs <email> --career=top_career_1 [--persona=marcel]
//       signs in as the persona and calls functions/v1/search-jobs with the
//       payload the Jobs page builds (title, overview, country from the
//       profile, languages and avoid-preferences from the report payload).
//       Writes `jobs` (JobSearchResult[]) into src/demo/fixtures/<persona>.<lang>.json.
//       Refuses to re-run a career the fixture already holds unless --force:
//       a second run costs a WF8 run (Apify + two LLM calls) and returns
//       different listings than the ones the copy may refer to.
//
//   node scripts/demo-run-job-search.mjs <email> --save=<jobId>,<jobId> [--applied=<jobId>] [--replace] [--persona=marcel]
//       inserts saved_jobs rows for the persona (service role, the same
//       columns useSavedJobs.saveJob writes), optionally marks one as
//       applied, and writes `savedJobs` (SavedJob[]) into the fixture.
//       --replace first deletes ALL of the persona's saved rows (when the
//       shown career changes). demo-export-fixture.mjs exports the same
//       rows on a re-freeze.
//
//   node scripts/demo-run-job-search.mjs <email> --drop=<section_type> [--persona=marcel]
//       removes that career's frozen results from the fixture (the demo
//       shows one career per persona; a thin result gets replaced, not
//       stacked). Saved rows that point at it must be replaced too.
//
//   node scripts/demo-run-job-search.mjs <email> --list [--persona=marcel]
//       prints the frozen listings (id, score, title, company) to pick from.
//
// Search options (defaults are the demo's decisions): --arrangement=any|
// remote_friendly|remote_only (default remote_friendly), --commitment=any|
// full_time|part_time|contract (default full_time), --country=<code>
// (default: the profile's country).
//
// REFUSES any address that is not an obvious demo account: this spends money
// on the persona's behalf and writes into the account.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
const rest = process.argv.slice(3);
if (!email) {
  console.error('usage: node scripts/demo-run-job-search.mjs <email> --career=<section_type> | --save=<ids> | --list (see header)');
  process.exit(1);
}
if (!/^demo[.\-+]/i.test(email)) {
  console.error(`Refusing "${email}": demo accounts only (address must start with "demo.").`);
  process.exit(1);
}
const flag = (name) => {
  const hit = rest.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const has = (name) => rest.includes(`--${name}`);

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
const anonKey = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const passwordVar = `DEMO_${email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}_PASSWORD`;
const password = env[passwordVar];
if (!url || !anonKey || !serviceKey || !password) {
  console.error(`VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / SUPABASE_SERVICE_ROLE_KEY / ${passwordVar} missing from .env.local`);
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const client = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const { data: signin, error: signinErr } = await client.auth.signInWithPassword({ email, password });
if (signinErr) {
  console.error(`Login failed for ${email}: ${signinErr.message}`);
  process.exit(1);
}
const userId = signin.user.id;
const token = signin.session.access_token;

const { data: profile } = await admin
  .from('profiles')
  .select('first_name, country, preferred_language')
  .eq('id', userId)
  .maybeSingle();

// ── The fixture this persona's demo reads ──────────────────────────────────
const personaSlug =
  flag('persona')?.toLowerCase() ??
  email.split('@')[0].replace(/^demo[.\-+]/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
const fixturePath = join('src', 'demo', 'fixtures');
const candidates = ['nl', 'en'].map((l) => join(fixturePath, `${personaSlug}.${l}.json`)).filter(existsSync);
if (candidates.length !== 1) {
  console.error(`Expected exactly one fixture for persona "${personaSlug}" in ${fixturePath}, found: ${candidates.join(', ') || 'none'}`);
  process.exit(1);
}
const fixtureFile = candidates[0];
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
const reportId = fixture.persona.reportId;
const writeFixture = () => writeFileSync(fixtureFile, JSON.stringify(fixture, null, 2) + '\n');

// ── Helpers copied from src/pages/Jobs.tsx (keep in step) ──────────────────
const stripHtml = (html) => (html ?? '').replace(/<[^>]*>/g, '').replace(/\*+/g, '').trim();
const extractOverview = (content) => {
  if (!content) return null;
  const m = content.match(/<h\d>\s*(?:Overview|Overzicht)\s*<\/h\d>\s*([\s\S]*?)(?=<h\d>|$)/i);
  if (!m) return null;
  const text = m[1]
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 400);
  return text || null;
};
// section_type → the sectionType key the Jobs page uses (SECTION_TYPE_MAP).
const SECTION_KEY = { top_career_1: 'first-career', top_career_2: 'second-career', top_career_3: 'third-career' };
const countryCode = (c) => {
  const lower = (c ?? '').toLowerCase();
  if (lower.includes('netherlands') || lower.includes('holland')) return 'nl';
  if (lower.includes('united kingdom') || lower.includes('uk') || lower.includes('britain')) return 'gb';
  if (lower.includes('united states') || lower.includes('usa')) return 'us';
  if (lower.includes('belgi')) return 'be';
  if (lower.includes('german')) return 'de';
  return null;
};

// ── --list ─────────────────────────────────────────────────────────────────
if (has('list')) {
  for (const r of fixture.jobs ?? []) {
    console.log(`${r.sectionType} · ${r.careerTitle} · ${r.jobs.length} listings (${r.status}${r.cached ? ', cached' : ''})`);
    for (const j of r.jobs) {
      console.log(`  ${j.id}  ${String(j.match_score ?? '-').padStart(2)}/10  ${j.title} — ${j.company} · ${j.location}`);
    }
  }
  console.log(`savedJobs: ${(fixture.savedJobs ?? []).map((s) => `${s.external_job_id} (${s.status})`).join(', ') || 'none'}`);
  process.exit(0);
}

// ── --drop=<section_type>: forget a career's results ───────────────────────
const drop = flag('drop');
if (drop) {
  const key = SECTION_KEY[drop];
  const before = (fixture.jobs ?? []).length;
  fixture.jobs = (fixture.jobs ?? []).filter((r) => r.sectionType !== key);
  if (fixture.jobs.length === before) {
    console.error(`Fixture holds no results for ${drop}.`);
    process.exit(1);
  }
  const orphans = (fixture.savedJobs ?? []).filter((s) => !fixture.jobs.some((r) => r.jobs.some((j) => j.id === s.external_job_id)));
  writeFixture();
  console.log(`dropped ${drop} from ${fixtureFile}; ${fixture.jobs.length} result set(s) left${orphans.length ? `; ${orphans.length} saved row(s) now point at nothing, re-run --save --replace` : ''}`);
  process.exit(0);
}

// ── --career=<section_type>: the real search, once ─────────────────────────
const career = flag('career');
if (career) {
  const sectionType = SECTION_KEY[career];
  if (!sectionType) {
    console.error(`--career must be one of ${Object.keys(SECTION_KEY).join(', ')}`);
    process.exit(1);
  }
  const section = fixture.sections.find((s) => s.section_type === career);
  if (!section) {
    console.error(`Fixture has no ${career} section.`);
    process.exit(1);
  }
  const careerTitle = stripHtml(section.title);
  const existing = (fixture.jobs ?? []).find((r) => r.sectionType === sectionType);
  if (existing && !has('force')) {
    console.error(`Fixture already holds ${existing.jobs.length} listings for ${career} (${careerTitle}). Pass --force to spend a new WF8 run.`);
    process.exit(1);
  }

  // Languages + avoid preferences, as Jobs.tsx derives them from reports.payload.
  const { data: report, error: repErr } = await admin.from('reports').select('id, payload').eq('id', reportId).maybeSingle();
  if (repErr || !report) {
    console.error(`Report ${reportId} not found: ${repErr?.message ?? ''}`);
    process.exit(1);
  }
  const payload = typeof report.payload === 'string' ? JSON.parse(report.payload) : report.payload;
  const responses = payload?.responses ?? {};
  const SKILLS_QID = '11111111-1111-1111-1111-11111111111f';
  const AVOID_ASPECTS_QID = '33333333-3333-3333-3333-333333333338';
  const validProf = new Set(['native', 'fluent', 'conversational', 'basic']);
  const userLanguages = [];
  const langs = responses[SKILLS_QID]?.languages;
  for (const group of [langs?.presets, langs?.other]) {
    if (!group || typeof group !== 'object') continue;
    for (const [language, prof] of Object.entries(group)) {
      const p = String(prof || '').toLowerCase();
      if (language && validProf.has(p)) userLanguages.push({ language, proficiency: p });
    }
  }
  const clean = (s) => String(s ?? '').replace(/\*\*/g, '').split(/\n|\(e\.g/i)[0].replace(/\s+/g, ' ').trim();
  const isNoPref = (s) => /doesn'?t matter|no preference|not applicable/i.test(s);
  const avoid = [];
  const v = responses[AVOID_ASPECTS_QID];
  if (Array.isArray(v)) for (const item of v) { const c = clean(item); if (c && !isNoPref(c)) avoid.push(c); }
  const avoidPreferences = [...new Set(avoid)];

  const country = flag('country') ?? countryCode(profile?.country);
  if (!country) {
    console.error(`Could not map profile country "${profile?.country}" to a code; pass --country=`);
    process.exit(1);
  }
  const body = {
    career_title: careerTitle,
    country_codes: [country],
    work_arrangement: flag('arrangement') ?? 'remote_friendly',
    job_commitment: flag('commitment') ?? 'full_time',
    location: '',
    alternate_titles: [],
    career_overview: extractOverview(section.content) ?? '',
    user_languages: userLanguages,
    avoid_preferences: avoidPreferences,
    report_id: reportId,
  };
  console.log('search-jobs payload:', JSON.stringify(body, null, 2));
  const started = Date.now();
  const resp = await fetch(`${url}/functions/v1/search-jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: anonKey },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  if (!resp.ok) {
    console.error(`search-jobs ${resp.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  // LinkedIn's job-view URLs work without the scrape-session tracking
  // tokens (?position=&refId=&trackingId=); a public fixture carries none.
  const jobs = (data.jobs ?? []).map((j) => ({ ...j, apply_url: String(j.apply_url ?? '').split('?')[0] }));
  const result = {
    careerTitle,
    sectionType,
    jobs,
    totalCount: data.total_count ?? 0,
    cached: !!data.cached,
    status: 'done',
    // Not part of JobSearchResult; the intro card prints when the listings were found.
    searchedAt: new Date().toISOString(),
    searchOptions: { countryCodes: [country], workArrangement: body.work_arrangement, jobCommitment: body.job_commitment },
  };
  fixture.jobs = [...(fixture.jobs ?? []).filter((r) => r.sectionType !== sectionType), result];
  writeFixture();
  console.log(`\n${result.jobs.length} listings for "${careerTitle}" in ${Math.round((Date.now() - started) / 1000)}s (${result.cached ? 'served from cache' : 'fresh WF8 run'}) → ${fixtureFile}`);
  for (const j of result.jobs) console.log(`  ${j.id}  ${String(j.match_score ?? '-').padStart(2)}/10  ${j.title} — ${j.company} · ${j.location}`);
  process.exit(0);
}

// ── --save=<ids>: saved_jobs rows for the kanban ───────────────────────────
const save = flag('save');
if (save) {
  const ids = save.split(',').map((s) => s.trim()).filter(Boolean);
  const applied = flag('applied');
  const all = (fixture.jobs ?? []).flatMap((r) => r.jobs.map((j) => ({ job: j, fromCareer: r.careerTitle })));
  const rows = [];
  for (const id of ids) {
    const hit = all.find((x) => x.job.id === id);
    if (!hit) {
      console.error(`Listing ${id} is not in the fixture's jobs; run --list.`);
      process.exit(1);
    }
    const { job, fromCareer } = hit;
    // Same columns as useSavedJobs.saveJob.
    rows.push({
      user_id: userId,
      external_job_id: job.id,
      job_title: job.title,
      company_name: job.company || null,
      location: job.location || null,
      salary_min: job.salary_min || null,
      salary_max: job.salary_max || null,
      description_snippet: job.description?.slice(0, 500) || null,
      apply_url: job.apply_url || null,
      source: job.source || 'unknown',
      posted_date: job.posted_date || null,
      status: id === applied ? 'applied' : 'saved',
      applied_at: id === applied ? new Date().toISOString() : null,
      from_career: fromCareer,
      match_score: job.match_score ?? null,
    });
  }
  // Idempotent: a re-run replaces the persona's rows for these listings
  // (--replace: all of the persona's rows, when the shown career changed).
  const del = admin.from('saved_jobs').delete().eq('user_id', userId);
  const { error: delErr } = await (has('replace') ? del : del.in('external_job_id', ids));
  if (delErr) throw delErr;
  const { error: insErr } = await admin.from('saved_jobs').insert(rows);
  if (insErr) throw insErr;
  const { data: savedRows, error: readErr } = await admin
    .from('saved_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false });
  if (readErr) throw readErr;
  fixture.savedJobs = savedRows ?? [];
  writeFixture();
  console.log(`saved_jobs for ${email}: ${fixture.savedJobs.map((s) => `${s.job_title} (${s.status})`).join(', ')} → ${fixtureFile}`);
  process.exit(0);
}

console.error('Nothing to do: pass --career=, --save= or --list.');
process.exit(1);
