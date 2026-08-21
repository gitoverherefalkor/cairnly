// translate-section — the single translation boundary of the language contract.
//
// Report sections are ALWAYS generated in English (canonical, stored in
// report_sections.content). This function translates a section — or every
// eligible section of a report — into the user's language and stores the
// result in report_sections.content_i18n[lang]. Display layers read
// content_i18n[lang] and fall back to the English canonical.
// See docs/LANGUAGE_CONTRACT_PLAN.md.
//
// Inputs (POST, n8n shared secret auth):
//   { report_id: string,  target_language?: string, force?: boolean }
//   { section_id: string, target_language?: string, force?: boolean }
// target_language defaults to the report owner's profiles.preferred_language.
//
// Callers:
//   - analysis-completed (before it marks the report ready — the readiness gate)
//   - WF6 (after regenerating a section from chat feedback)
//   - WF7 (after inserting the exec summary)
//
// Guarantees:
//   - Never writes a translation that fails the deterministic gate
//     (_shared/translationGate.ts). Retries once with the failure list, then
//     gives up: the worst outcome is the English fallback, never garbled text.
//   - Never translates non-English canonical content: if the input doesn't
//     read as English, that is a GENERATOR regression — it is reported, not
//     translated (the permanent alarm the old pipeline never had).
//   - Never overwrites newer content: the UPDATE is guarded on the content
//     value read, so a section rewritten mid-translation is left alone (the
//     rewriter's own translate call handles the new content).
//   - Idempotent: existing translations are skipped unless force=true.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifySharedSecret, errorResponse } from '../_shared/cors.ts';
import { resolveLang, type Lang } from '../_shared/language.ts';
import { DO_NOT_TRANSLATE, PREFERRED, RULES, LANG_NAMES } from '../_shared/glossary.ts';
import { runGate, canonicalLooksEnglish } from '../_shared/translationGate.ts';

const serverHeaders = { 'Content-Type': 'application/json' };

const MODEL = 'claude-sonnet-5'; // NOTE: never send `temperature` to sonnet-5 (API rejects it)
const CONCURRENCY = 4;
const PER_CALL_TIMEOUT_MS = 100_000;

// Section types that must NOT be translated:
//   init_summary       — internal extraction artifact, never shown to users
//   chat_highlights    — the user's own chat content, natively in their language
//   chapter_1_feedback — JSON-encoded feedback structure, not prose
// Everything else is user-facing generated prose and translates by default,
// so NEW section types are covered automatically.
const EXEMPT_TYPES = new Set(['init_summary', 'chat_highlights', 'chapter_1_feedback']);

interface SectionRow {
  id: string;
  report_id: string;
  section_type: string;
  title: string | null;
  content: string | null;
  content_i18n: Record<string, unknown> | null;
}

interface FailureEntry {
  section_id: string;
  section_type: string;
  reason: string;
}

function buildSystemPrompt(target: Lang): string {
  const langName = LANG_NAMES[target] ?? target;
  const voiceRules = (RULES[target] ?? []).map((r) => `- ${r}`).join('\n');
  const glossaryPairs = Object.entries(PREFERRED[`en->${target}`] ?? {})
    .map(([en, tr]) => `- "${en}" -> "${tr}"`)
    .join('\n');
  const doNotTranslate = DO_NOT_TRANSLATE.map((t) => `- ${t}`).join('\n');

  return `You translate career-guidance report sections for Cairnly, from English to ${langName}.

AUDIENCE AND REGISTER
The reader is a professional aged 18-55, mostly college-educated office workers, reading a paid, personalised career report about themselves. The text is read once and acted on. Warm, direct, concrete. Not marketing, not academic.

VOICE RULES (${langName})
${voiceRules || '- Natural, contemporary register.'}

GLOSSARY — translate these terms consistently:
${glossaryPairs || '(none)'}

NEVER TRANSLATE these brand terms and tokens (reproduce verbatim):
${doNotTranslate}
Job/role titles: keep widely-used English job titles in English when that is how the role is named in the ${langName} job market (e.g. "Product Manager", "COO"); translate descriptive role phrases naturally.

STRUCTURAL CONTRACT — hard constraints, checked mechanically after you answer:
- Reproduce every HTML tag exactly: same tags, same nesting, same count, same order. Never add or remove one. Translate only the human-readable text inside them.
- Reproduce every <!-- ... --> comment token verbatim. Never translate its contents.
- Reproduce every URL verbatim.
- Every number, score, salary figure and year survives unchanged. You may localise thousand/decimal separators (€1,500 -> €1.500) but never change, drop or spell out a digit.
- Keep markdown structure 1:1: same number of "## " headings, "- " bullets, ✓ and ⚠ markers, ** bold spans, \`\`\` fences.
- Inside any fenced JSON block: translate only the values of "headline" and "explanation". Every key and every other value stays byte-identical.
- The input uses <<<TITLE>>>, <<<CONTENT>>> and <<<END>>> markers. Your answer uses the same three markers, in the same order, with the translated title and content between them. If the title is [NO TITLE], answer [NO TITLE] for it.
- Return nothing outside the markers. No preamble, no explanation, no code fence around the whole answer.`;
}

function buildUserMessage(title: string | null, content: string): string {
  return `<<<TITLE>>>\n${title ?? '[NO TITLE]'}\n<<<CONTENT>>>\n${content}\n<<<END>>>`;
}

function parseModelAnswer(raw: string): { title: string | null; content: string } | null {
  const m = raw.match(/<<<TITLE>>>\s*\n([\s\S]*?)\n\s*<<<CONTENT>>>\s*\n([\s\S]*?)\n?\s*<<<END>>>/);
  if (!m) return null;
  const title = m[1].trim() === '[NO TITLE]' ? null : m[1].trim();
  return { title, content: m[2].trim() };
}

async function callClaude(
  system: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PER_CALL_TIMEOUT_MS);
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 8192, system, messages }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      throw new Error(`claude-api-error ${r.status}: ${body.slice(0, 300)}`);
    }
    const data = await r.json();
    // sonnet-5 may emit thinking blocks first — find the text block, never
    // assume content[0] (documented gotcha from intake-chat).
    const textBlock = (data.content ?? []).find((b: { type: string }) => b.type === 'text');
    if (!textBlock?.text) throw new Error('claude response had no text block');
    return textBlock.text as string;
  } finally {
    clearTimeout(timer);
  }
}

/** Translate one section. Returns null on success, or a failure reason. */
async function translateOne(
  supabase: SupabaseClient,
  row: SectionRow,
  target: Lang,
): Promise<string | null> {
  const canonicalContent = row.content ?? '';
  if (canonicalContent.trim().length === 0) return null; // nothing to translate

  if (!canonicalLooksEnglish(canonicalContent)) {
    // Generator regression: canonical content is not English. Do NOT translate
    // it — the display fallback will show it as-is, and the alert points at
    // the real problem (a workflow prompt), not at translation.
    return 'canonical-not-english: generator produced non-English canonical content';
  }

  const system = buildSystemPrompt(target);
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: buildUserMessage(row.title, canonicalContent) },
  ];

  let lastFailures = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try {
      raw = await callClaude(system, messages);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === 0) continue; // one retry on API/network errors
      return `api-error: ${msg}`;
    }

    const parsed = parseModelAnswer(raw);
    if (!parsed) {
      lastFailures = 'answer did not use the <<<TITLE>>>/<<<CONTENT>>>/<<<END>>> markers';
    } else {
      const contentGate = runGate(canonicalContent, parsed.content, target);
      const titleGate = row.title
        ? runGate(row.title, parsed.title ?? '', target)
        : { ok: parsed.title === null || parsed.title === '', failures: ['title appeared where canonical had none'] };
      // Titles are short (often just a role name): language sniffing and digit
      // checks matter, but an all-English job title is legitimate — runGate's
      // sniff returns 'unknown' for short strings, so this stays permissive.
      const failures = [...contentGate.failures, ...(titleGate.ok ? [] : titleGate.failures)];

      if (failures.length === 0) {
        // Write, guarded on the content we translated: if the section was
        // rewritten mid-flight, this update matches 0 rows and we skip.
        const entry = {
          title: parsed.title,
          content: parsed.content,
          translated_at: new Date().toISOString(),
          model: MODEL,
        };
        const { data: fresh } = await supabase
          .from('report_sections')
          .select('content_i18n')
          .eq('id', row.id)
          .single();
        const merged = { ...((fresh?.content_i18n as Record<string, unknown>) ?? {}), [target]: entry };
        const { data: updated, error } = await supabase
          .from('report_sections')
          .update({ content_i18n: merged })
          .eq('id', row.id)
          .eq('content', canonicalContent)
          .select('id');
        if (error) return `db-write-error: ${error.message}`;
        if (!updated || updated.length === 0) {
          console.warn(`[translate-section] ${row.section_type} ${row.id}: content changed mid-translation, skipping write`);
        }
        return null;
      }
      lastFailures = failures.join(' | ');
    }

    // Feed the failures back for one corrective attempt.
    messages.push({ role: 'assistant', content: raw });
    messages.push({
      role: 'user',
      content: `Your translation failed these mechanical checks:\n${lastFailures}\n\nProduce the corrected translation. Same marker format, full document.`,
    });
  }
  return `gate-failed: ${lastFailures}`;
}

async function alertAdmin(subject: string, lines: string[]): Promise<void> {
  console.error(`[translate-section] ALERT: ${subject}\n${lines.join('\n')}`);
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Cairnly <no-reply@cairnly.io>',
        to: ['sjoerd@falkoratlas.com'],
        subject: `[Cairnly] ${subject}`,
        text: `${lines.join('\n')}\n\nThe affected section(s) fall back to English for the user (readable, not broken). Re-run: POST translate-section with the report_id.`,
      }),
    });
  } catch (e) {
    console.error('[translate-section] alert email failed:', e);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });

  const authError = verifySharedSecret(req);
  if (authError) return authError;

  try {
    const body = await req.json().catch(() => ({}));
    const reportId = body.report_id as string | undefined;
    const sectionId = body.section_id as string | undefined;
    const force = body.force === true;

    if (!reportId && !sectionId) {
      return errorResponse('report_id or section_id is required', 400, serverHeaders);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('NEW_N8N_SERVICE_ROLE_KEY') ?? '',
    );

    // Load the target sections.
    let query = supabase
      .from('report_sections')
      .select('id, report_id, section_type, title, content, content_i18n');
    query = sectionId ? query.eq('id', sectionId) : query.eq('report_id', reportId!);
    const { data: rows, error: rowsError } = await query;
    if (rowsError || !rows || rows.length === 0) {
      return errorResponse(`no sections found: ${rowsError?.message ?? 'empty'}`, 404, serverHeaders);
    }
    const sections = rows as SectionRow[];
    const resolvedReportId = sections[0].report_id;

    // Resolve the target language (explicit param, else the owner's profile).
    let target: Lang;
    if (body.target_language) {
      target = resolveLang(body.target_language);
    } else {
      const { data: report } = await supabase
        .from('reports')
        .select('user_id')
        .eq('id', resolvedReportId)
        .single();
      const { data: profile } = await supabase
        .from('profiles')
        .select('preferred_language')
        .eq('id', report?.user_id ?? '')
        .maybeSingle();
      target = resolveLang(profile?.preferred_language);
    }

    if (target === 'en') {
      return new Response(
        JSON.stringify({ success: true, target_language: 'en', translated: 0, skipped: sections.length, note: 'canonical is already English' }),
        { headers: serverHeaders },
      );
    }

    const eligible = sections.filter(
      (s) =>
        !EXEMPT_TYPES.has(s.section_type) &&
        (force || !(s.content_i18n && typeof s.content_i18n === 'object' && target in s.content_i18n)),
    );

    const failures: FailureEntry[] = [];
    let translated = 0;

    // Simple concurrency pool.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, eligible.length) }, async () => {
      while (cursor < eligible.length) {
        const row = eligible[cursor++];
        const failure = await translateOne(supabase, row, target);
        if (failure) {
          failures.push({ section_id: row.id, section_type: row.section_type, reason: failure });
        } else {
          translated++;
        }
      }
    });
    await Promise.all(workers);

    if (failures.length > 0) {
      await alertAdmin(
        `translate-section: ${failures.length} section(s) fell back to English (report ${resolvedReportId})`,
        failures.map((f) => `- ${f.section_type} (${f.section_id}): ${f.reason}`),
      );
    }

    return new Response(
      JSON.stringify({
        success: failures.length === 0,
        target_language: target,
        translated,
        skipped: sections.length - eligible.length,
        failed: failures,
      }),
      { headers: serverHeaders },
    );
  } catch (error) {
    console.error('Error in translate-section:', error);
    return errorResponse('Internal server error', 500, serverHeaders);
  }
});
