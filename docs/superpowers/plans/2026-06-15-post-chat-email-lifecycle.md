# Post-chat Email Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flaky `report_not_viewed` reminder with a deliberate post-chat email lifecycle: one "dashboard ready" email on WF7 completion, a 2-step personalized referral-unlock nudge, and delayed progression follow-ups, all driven by the existing hourly cron.

**Architecture:** Extend the existing machinery — add new email `type`s to the `send-reminder-email` edge function (new EN/NL templates), and add new selection blocks to the `check_and_send_reminders` pg_cron function (with new dedup columns on `user_engagement_tracking`). No n8n changes. Personalization (top role title, referral code) is joined in SQL and passed in the cron payload.

**Tech Stack:** Supabase Postgres (pg_cron, pg_net), Deno edge function (TypeScript), Resend, `_shared/email-chrome.ts` templates.

**Verification model:** This repo has no edge-function/SQL test harness. Verification = (a) SQL dry-run `SELECT`s that reproduce each selection block to confirm who would be emailed without sending, (b) a manual test POST to the edge function targeting Sjoerd's own inbox to eyeball each rendered email, (c) applying the migration via Supabase MCP and confirming columns via `information_schema`. Migrations are applied individually via MCP (NOT `supabase db push` — see project memory on migration-history mismatch).

**Reference spec:** `docs/superpowers/specs/2026-06-15-post-chat-email-lifecycle-design.md`

---

## File structure

- **Create** `supabase/migrations/20260615120000_post_chat_email_lifecycle.sql`
  Adds 5 nullable columns to `user_engagement_tracking`; replaces `check_and_send_reminders`
  (removes the `report_not_viewed` block, adds A0/A1/A2/progression/refund blocks).
- **Modify** `supabase/functions/send-reminder-email/index.ts`
  Adds `stripHtml` helper, EN/NL copy + template functions for three new types
  (`dashboard_ready`, `unlock_nudge`, `referral_progression`), extends the payload
  interface and the handler `switch`.

The migration is split into two apply steps (columns first, cron function second) so the
columns exist and the edge function is deployed before the cron starts emitting new types.

---

## Task 1: Add tracking columns

**Files:**
- Create: `supabase/migrations/20260615120000_post_chat_email_lifecycle.sql`

- [ ] **Step 1: Write the column-addition migration (first half of the file)**

Create `supabase/migrations/20260615120000_post_chat_email_lifecycle.sql` with ONLY this
content for now (the cron rewrite is appended in Task 6):

```sql
-- =============================================================================
-- Post-chat email lifecycle
--   * New dedup columns for the dashboard-ready + referral-unlock emails
--   * check_and_send_reminders rewrite (appended in the second half, Task 6)
-- =============================================================================

ALTER TABLE public.user_engagement_tracking
  ADD COLUMN IF NOT EXISTS dashboard_ready_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_nudge_1_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unlock_nudge_2_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS referral_progression_nudge_count INT,
  ADD COLUMN IF NOT EXISTS refund_unlock_email_sent_at TIMESTAMPTZ;
```

- [ ] **Step 2: Apply the column additions via MCP**

Apply with the Supabase MCP `apply_migration` (name `post_chat_email_lifecycle_columns`,
the ALTER statement above). This is additive and version-controlled, so it is allowed
without extra approval per project policy.

- [ ] **Step 3: Verify the columns exist**

Run via MCP `execute_sql`:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='user_engagement_tracking'
  AND column_name IN ('dashboard_ready_sent_at','unlock_nudge_1_sent_at',
    'unlock_nudge_2_sent_at','referral_progression_nudge_count','refund_unlock_email_sent_at')
ORDER BY column_name;
```
Expected: 5 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260615120000_post_chat_email_lifecycle.sql
git commit -m "feat(email): add dedup columns for post-chat email lifecycle"
```

---

## Task 2: Edge function — HTML-strip helper + dashboard_ready email

**Files:**
- Modify: `supabase/functions/send-reminder-email/index.ts`

- [ ] **Step 1: Add the `stripHtml` helper**

Near the top of the file (after the imports, before `COPY`), add:

```ts
// Report-section titles are stored as HTML (e.g. "<h3><strong>Serious Games
// Product Designer</strong></h3>"). Strip tags + collapse whitespace for use in
// email subjects/body. Falls back handled by the caller.
function stripHtml(s: string | null | undefined): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
```

- [ ] **Step 2: Add `dashboard_ready` copy to the `COPY` object**

Inside `COPY.en` add (sibling of `reportNotViewed`):

```ts
    dashboardReady: {
      subject: (n: string) => `Your full Cairnly report is ready, ${n}`,
      title: "Your full Cairnly report is ready",
      preheader: "Your complete career report has finished generating.",
      h1: "Your full report is ready",
      greeting: (n: string) => `Hi ${n},`,
      p1: "Your coaching session is done, and Cairnly has now finished building your complete report. This is where everything comes together: your personality profile, your strengths, and your detailed career matches with the coaching feedback woven in.",
      calloutTitle: "Waiting for you on your dashboard",
      items: [
        ["Executive Summary", "your personality, strengths, and top matches at a glance"],
        ["Your Career Matches", "three detailed paths, plus runner-ups and an outside-the-box option"],
        ["Dream Job Analysis", "how your aspirations line up with your profile"],
        ["Your Toolkit", "job search, resume tailoring, and cover letters you can unlock"],
      ] as [string, string][],
      p2: "Cairnly does not stop at the chat. Take a few minutes to explore the full report, it is saved permanently and yours to revisit anytime.",
      cta: "Explore Your Report",
      footnote: "Saved permanently in your dashboard, access it anytime.",
    },
```

Inside `COPY.nl` add the Dutch sibling (casual je-form, no em-dashes):

```ts
    dashboardReady: {
      subject: (n: string) => `Je volledige Cairnly-rapport is klaar, ${n}`,
      title: "Je volledige Cairnly-rapport is klaar",
      preheader: "Je complete loopbaanrapport is klaar met genereren.",
      h1: "Je volledige rapport is klaar",
      greeting: (n: string) => `Hoi ${n},`,
      p1: "Je coachingsessie is afgerond en Cairnly heeft nu je complete rapport opgebouwd. Hier komt alles samen: je persoonlijkheidsprofiel, je sterke punten en je gedetailleerde loopbaanmatches met de coaching-feedback erin verwerkt.",
      calloutTitle: "Dit staat voor je klaar op je dashboard",
      items: [
        ["Samenvatting", "je persoonlijkheid, sterke punten en beste matches in één oogopslag"],
        ["Je loopbaanmatches", "drie uitgewerkte paden, plus runner-ups en een outside-the-box optie"],
        ["Droombaan-analyse", "hoe je ambities aansluiten bij je profiel"],
        ["Je toolkit", "vacaturezoeker, cv op maat en motivatiebrieven die je kunt ontgrendelen"],
      ] as [string, string][],
      p2: "Cairnly stopt niet bij de chat. Neem een paar minuten om je volledige rapport te bekijken, het wordt permanent bewaard en je kunt er altijd naar terug.",
      cta: "Bekijk je rapport",
      footnote: "Permanent bewaard in je dashboard, altijd toegankelijk.",
    },
```

- [ ] **Step 3: Add the `dashboardReadyEmail` template function**

After `reportNotViewedEmail(...)`, add:

```ts
function dashboardReadyEmail(firstName: string, lang: Lang): { subject: string; html: string } {
  const c = COPY[lang].dashboardReady;
  const itemsHtml = c.items
    .map(([label, rest]) => `<tr><td style="padding:5px 0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;"><strong style="color:#122E3B;font-weight:700;">${label}</strong>: ${rest}</td></tr>`)
    .join('');

  const bodyHtml =
    bodyRow(
      h1(c.h1) +
      paragraph(c.greeting(firstName)) +
      paragraph(c.p1) +
      callout(c.calloutTitle, `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${itemsHtml}
        </table>
      `) +
      paragraph(c.p2)
    ) +
    ctaRow(c.cta, `${BASE_URL}/dashboard`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(firstName),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
  };
}
```

- [ ] **Step 4: Type-check locally**

Run: `cd supabase/functions && deno check send-reminder-email/index.ts`
Expected: no errors. (If `deno` is unavailable, skip — the deploy in Task 5 type-checks.)

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-reminder-email/index.ts
git commit -m "feat(email): add dashboard_ready template + stripHtml helper"
```

---

## Task 3: Edge function — unlock_nudge email (Track A)

**Files:**
- Modify: `supabase/functions/send-reminder-email/index.ts`

- [ ] **Step 1: Add `unlockNudge` copy to `COPY.en`**

```ts
    unlockNudge: {
      subject: (role: string) => `Let Cairnly find open roles for ${role}`,
      title: "Unlock your job search",
      preheader: "Live openings matched to your top career, free.",
      greeting: (n: string) => `Hi ${n},`,
      // nudge 1 — job search
      h1a: (role: string) => `Open roles for ${role}, found for you`,
      p1a: (role: string) => `Your report points to ${role} as a strong match. Cairnly can search live job openings matched to that and your other recommendations, so you are not scrolling job boards alone.`,
      calloutTitleA: "How to unlock it",
      bodyA: "Invite one friend with your code below. The moment they join, your job search unlocks, free.",
      // nudge 2 — cv + cover letters
      h1b: (role: string) => `Tailor your CV and cover letters for ${role}`,
      p1b: (role: string) => `You have unlocked job search. Invite a couple more friends and Cairnly will also rewrite your CV and draft cover letters tailored to ${role} and the exact roles you apply for. Only Cairnly has the insight into you to make these land.`,
      calloutTitleB: "Keep unlocking",
      bodyB: "Two friends unlock CV tailoring. Three unlock cover letters. Share your code below.",
      codeLabel: "YOUR REFERRAL CODE",
      yourCode: "Your code:",
      cta: "Share your code",
      footnote: "Each friend who joins also moves you toward a full refund of what you paid.",
    },
```

- [ ] **Step 2: Add `unlockNudge` copy to `COPY.nl`**

```ts
    unlockNudge: {
      subject: (role: string) => `Laat Cairnly vacatures vinden voor ${role}`,
      title: "Ontgrendel je vacaturezoeker",
      preheader: "Live vacatures op maat van je beste match, gratis.",
      greeting: (n: string) => `Hoi ${n},`,
      h1a: (role: string) => `Vacatures voor ${role}, voor je gevonden`,
      p1a: (role: string) => `Je rapport wijst ${role} aan als sterke match. Cairnly kan live vacatures zoeken die daarbij en bij je andere aanbevelingen passen, zodat je niet alleen door vacaturesites hoeft te scrollen.`,
      calloutTitleA: "Zo ontgrendel je het",
      bodyA: "Nodig één vriend uit met je code hieronder. Zodra diegene lid wordt, ontgrendel je je vacaturezoeker, gratis.",
      h1b: (role: string) => `Maak je cv en motivatiebrieven op maat voor ${role}`,
      p1b: (role: string) => `Je hebt de vacaturezoeker ontgrendeld. Nodig nog een paar vrienden uit en Cairnly herschrijft ook je cv en stelt motivatiebrieven op die zijn afgestemd op ${role} en de specifieke vacatures waarop je solliciteert. Alleen Cairnly kent jou goed genoeg om dit echt te laten werken.`,
      calloutTitleB: "Blijf ontgrendelen",
      bodyB: "Twee vrienden ontgrendelen cv op maat. Drie ontgrendelen motivatiebrieven. Deel je code hieronder.",
      codeLabel: "JOUW REFERRALCODE",
      yourCode: "Jouw code:",
      cta: "Deel je code",
      footnote: "Elke vriend die lid wordt brengt je ook dichter bij volledige terugbetaling van wat je betaalde.",
    },
```

- [ ] **Step 3: Add the `unlockNudgeEmail` template function**

```ts
function unlockNudgeEmail(
  firstName: string,
  nudge: number,
  topRoleRaw: string | null,
  referralCode: string | null,
  lang: Lang,
): { subject: string; html: string } {
  const c = COPY[lang].unlockNudge;
  const role = stripHtml(topRoleRaw) || (lang === "nl" ? "je beste loopbaanmatch" : "your top career match");

  const isFirst = nudge === 1;
  const h1Text = isFirst ? c.h1a(role) : c.h1b(role);
  const p1Text = isFirst ? c.p1a(role) : c.p1b(role);
  const calloutTitle = isFirst ? c.calloutTitleA : c.calloutTitleB;
  const calloutBody = isFirst ? c.bodyA : c.bodyB;

  const shareHref = `${BASE_URL}/dashboard?share=1`;
  const codeLine = referralCode
    ? `<p style="margin:8px 0 0 0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;">${c.yourCode} <strong style="font-family:'Poppins','Inter',Arial,sans-serif;letter-spacing:1.5px;color:#1F8282;font-weight:700;">${referralCode}</strong></p>`
    : '';

  const bodyHtml =
    bodyRow(
      h1(h1Text) +
      paragraph(c.greeting(firstName)) +
      paragraph(p1Text) +
      callout(calloutTitle, `
        <p style="margin:0;color:#3D4A53;font-size:14.5px;line-height:1.6;font-family:'Inter',Arial,sans-serif;font-weight:500;">${calloutBody}</p>
        ${codeLine}
      `)
    ) +
    ctaRow(c.cta, shareHref) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;

  return {
    subject: c.subject(role),
    html: renderEmail({ title: c.title, preheader: c.preheader, bodyHtml, footer: 'reminder' }),
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-reminder-email/index.ts
git commit -m "feat(email): add unlock_nudge template (job search + cv/cover letters)"
```

---

## Task 4: Edge function — referral_progression email (Track B follow-up)

**Files:**
- Modify: `supabase/functions/send-reminder-email/index.ts`

- [ ] **Step 1: Add `progression` copy to `COPY.en`**

```ts
    progression: {
      // variant = "next_tool"
      subjectNext: (nextTool: string) => `One more friend unlocks ${nextTool}`,
      titleNext: "You are one invite away",
      preheaderNext: "Invite one more friend to unlock your next tool.",
      greeting: (n: string) => `Hi ${n},`,
      h1Next: (nextTool: string) => `Invite one more to unlock ${nextTool}`,
      // currentTool / nextTool labels stay in English to match the dashboard toolkit
      p1Next: (currentTool: string, nextTool: string, role: string) =>
        `You have already unlocked ${currentTool}. Invite one more friend with your code and ${nextTool} opens up too, tailored to ${role} and the roles you actually want.`,
      // variant = "refund"
      subjectRefund: "You unlocked every tool. Now earn your money back",
      titleRefund: "Every tool unlocked",
      preheaderRefund: "From here, friends who join earn you a refund.",
      h1Refund: "You have unlocked all three tools",
      p1Refund: "Job search, CV tailoring, and cover letters are all yours. From here, every friend who joins with your code earns you part of your purchase back, up to a full refund once six friends have joined.",
      codeLabel: "YOUR REFERRAL CODE",
      yourCode: "Your code:",
      ctaNext: "Share your code",
      ctaRefund: "Share your code",
      footnote: "You are receiving this because you have a Cairnly account.",
    },
```

- [ ] **Step 2: Add `progression` copy to `COPY.nl`**

```ts
    progression: {
      subjectNext: (nextTool: string) => `Nog één vriend ontgrendelt ${nextTool}`,
      titleNext: "Je bent één uitnodiging verwijderd",
      preheaderNext: "Nodig nog één vriend uit om je volgende tool te ontgrendelen.",
      greeting: (n: string) => `Hoi ${n},`,
      h1Next: (nextTool: string) => `Nodig nog één vriend uit om ${nextTool} te ontgrendelen`,
      p1Next: (currentTool: string, nextTool: string, role: string) =>
        `Je hebt ${currentTool} al ontgrendeld. Nodig nog één vriend uit met je code en ook ${nextTool} komt beschikbaar, op maat van ${role} en de functies die je echt wilt.`,
      subjectRefund: "Je hebt elke tool ontgrendeld. Verdien nu je geld terug",
      titleRefund: "Elke tool ontgrendeld",
      preheaderRefund: "Vanaf nu leveren vrienden die lid worden je geld terug op.",
      h1Refund: "Je hebt alle drie de tools ontgrendeld",
      p1Refund: "Vacaturezoeker, cv op maat en motivatiebrieven zijn allemaal van jou. Vanaf nu levert elke vriend die lid wordt met je code een deel van je aankoop terug, tot een volledige terugbetaling zodra zes vrienden lid zijn geworden.",
      codeLabel: "JOUW REFERRALCODE",
      yourCode: "Jouw code:",
      ctaNext: "Deel je code",
      ctaRefund: "Deel je code",
      footnote: "Je ontvangt deze e-mail omdat je een Cairnly-account hebt.",
    },
```

- [ ] **Step 3: Add the `progressionEmail` template function**

The tool labels mirror `REFERRAL_UNLOCK_TIERS` in `payment-success`. Map current converted
count → current/next tool label (English labels on purpose, to match the dashboard toolkit):

```ts
const PROGRESSION_TOOLS: Record<number, { current: string; next: string | null }> = {
  1: { current: "Find Open Roles", next: "Tailor Your Resume" },
  2: { current: "Tailor Your Resume", next: "Tailor Cover Letters" },
};

function progressionEmail(
  firstName: string,
  variant: "next_tool" | "refund",
  currentCount: number,
  topRoleRaw: string | null,
  referralCode: string | null,
  lang: Lang,
): { subject: string; html: string } {
  const c = COPY[lang].progression;
  const role = stripHtml(topRoleRaw) || (lang === "nl" ? "je beste loopbaanmatch" : "your top career match");
  const codeLine = referralCode
    ? `<p style="margin:0;color:#122E3B;font-size:14.5px;line-height:1.55;font-family:'Inter','Segoe UI',Arial,sans-serif;font-weight:500;">${c.yourCode} <strong style="font-family:'Poppins','Inter',Arial,sans-serif;letter-spacing:1.5px;color:#1F8282;font-weight:700;">${referralCode}</strong></p>`
    : `<p style="margin:0;"><a href="${BASE_URL}/dashboard?share=1" style="color:#1F8282;text-decoration:underline;font-weight:600;">${c.yourCode}</a></p>`;

  if (variant === "refund") {
    const bodyHtml =
      bodyRow(h1(c.h1Refund) + paragraph(c.greeting(firstName)) + paragraph(c.p1Refund) + callout(c.codeLabel, codeLine)) +
      ctaRow(c.ctaRefund, `${BASE_URL}/dashboard?share=1`) +
      `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;
    return {
      subject: c.subjectRefund,
      html: renderEmail({ title: c.titleRefund, preheader: c.preheaderRefund, bodyHtml, footer: 'reminder' }),
    };
  }

  const tools = PROGRESSION_TOOLS[currentCount] ?? PROGRESSION_TOOLS[1];
  const nextTool = tools.next ?? "Tailor Cover Letters";
  const bodyHtml =
    bodyRow(h1(c.h1Next(nextTool)) + paragraph(c.greeting(firstName)) + paragraph(c.p1Next(tools.current, nextTool, role)) + callout(c.codeLabel, codeLine)) +
    ctaRow(c.ctaNext, `${BASE_URL}/dashboard?share=1`) +
    `<tr><td style="padding:0 48px 28px;background-color:#ECE4D2;" class="px-mob">${paragraph(c.footnote, { size: 13, color: '#6B7480', align: 'center', mb: 0 })}</td></tr>`;
  return {
    subject: c.subjectNext(nextTool),
    html: renderEmail({ title: c.titleNext, preheader: c.preheaderNext, bodyHtml, footer: 'reminder' }),
  };
}
```

- [ ] **Step 4: Extend the payload interface + handler switch**

In `interface ReminderUser`, add the optional fields the new types use:

```ts
  top_role?: string | null;
  referral_code?: string | null;
  nudge?: number | null;            // unlock_nudge: 1 or 2
  variant?: "next_tool" | "refund" | null;  // referral_progression
  current_count?: number | null;    // referral_progression: 1 or 2
```

In `interface ReminderPayload`, widen `type`:

```ts
  type:
    | "signup_no_start"
    | "survey_abandoned"
    | "chat_not_completed"
    | "report_not_viewed"
    | "dashboard_ready"
    | "unlock_nudge"
    | "referral_progression";
```

In the handler `switch (type)`, add three cases before `default`:

```ts
        case "dashboard_ready":
          emailContent = dashboardReadyEmail(user.first_name, lang);
          break;
        case "unlock_nudge":
          emailContent = unlockNudgeEmail(
            user.first_name,
            user.nudge ?? 1,
            user.top_role ?? null,
            user.referral_code ?? null,
            lang,
          );
          break;
        case "referral_progression":
          emailContent = progressionEmail(
            user.first_name,
            user.variant ?? "next_tool",
            user.current_count ?? 1,
            user.top_role ?? null,
            user.referral_code ?? null,
            lang,
          );
          break;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/send-reminder-email/index.ts
git commit -m "feat(email): add referral_progression template + wire new types into handler"
```

---

## Task 5: Deploy edge function + smoke-test each email to Sjoerd's inbox

**Files:** none (deploy + manual verification)

- [ ] **Step 1: Get approval to redeploy the existing function**

Re-deploying an EXISTING edge function requires explicit user approval per project policy.
Confirm with Sjoerd before deploying `send-reminder-email`. (The change is additive — new
types only — but the policy gate still applies.)

- [ ] **Step 2: Deploy**

Deploy `send-reminder-email` via Supabase MCP `deploy_edge_function`. Expected: success,
new version number returned.

- [ ] **Step 3: Smoke-test each new email to Sjoerd's own address**

POST a synthetic payload per type to the function (Sjoerd's email as `to`, fake user_id is
fine — the function only renders + sends, it does not read tracking). Use MCP-provided
function URL + the service-role bearer. Send all four variants:

```jsonc
// dashboard_ready
{ "type": "dashboard_ready", "users": [
  { "user_id": "test", "email": "sjoerd@falkoratlas.com", "first_name": "Sjoerd", "preferred_language": "en" } ] }
// unlock_nudge #1
{ "type": "unlock_nudge", "users": [
  { "user_id": "test", "email": "sjoerd@falkoratlas.com", "first_name": "Sjoerd",
    "nudge": 1, "top_role": "<h3><strong>Serious Games Product Designer</strong></h3>",
    "referral_code": "ABC123", "preferred_language": "en" } ] }
// unlock_nudge #2 (same shape, "nudge": 2)
// referral_progression next_tool
{ "type": "referral_progression", "users": [
  { "user_id": "test", "email": "sjoerd@falkoratlas.com", "first_name": "Sjoerd",
    "variant": "next_tool", "current_count": 1, "top_role": "<h3><strong>Serious Games Product Designer</strong></h3>",
    "referral_code": "ABC123", "preferred_language": "en" } ] }
// referral_progression refund (variant "refund")
```

Expected: each arrives, renders correctly, role title shows as plain "Serious Games Product
Designer" (no HTML), referral code shows, no em-dashes, CTAs link to cairnly.io. Repeat one
with `"preferred_language": "nl"` to eyeball Dutch.

- [ ] **Step 4: Fix any rendering issues, redeploy, re-test**

If anything renders wrong, edit `index.ts`, redeploy, re-send. Commit fixes.

---

## Task 6: Rewrite check_and_send_reminders (cron selection blocks)

**Files:**
- Modify: `supabase/migrations/20260615120000_post_chat_email_lifecycle.sql` (append)

- [ ] **Step 1: Append the cron-function replacement to the migration file**

Append the full `CREATE OR REPLACE FUNCTION` below to
`20260615120000_post_chat_email_lifecycle.sql`. It is the live function with the
`report_not_viewed` block REMOVED and five new blocks added. (Blocks 1–3, signup/survey/chat,
are unchanged from the live version — copy them verbatim from the current definition captured
in the design session; shown abbreviated here with `-- … unchanged …` only to keep this plan
readable. In the actual file they MUST be the full original blocks.)

```sql
CREATE OR REPLACE FUNCTION public.check_and_send_reminders()
RETURNS void AS $$
DECLARE
  edge_function_url TEXT := 'https://pcoyafgsirrznhmdaiji.supabase.co/functions/v1/send-reminder-email';
  service_role_key TEXT;
  signup_users JSONB;
  survey_users JSONB;
  chat_users JSONB;
  dash_users JSONB;
  nudge1_users JSONB;
  nudge2_users JSONB;
  prog_users JSONB;
  refund_users JSONB;
BEGIN
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'service_role_key not found in vault — skipping reminders';
    RETURN;
  END IF;

  -- ===== Reminders 1–3 (signup / survey_abandoned / chat_not_completed) =====
  -- … unchanged … copy the three original blocks here verbatim (signup_users,
  -- survey_users, chat_users), including their net.http_post + UPDATE flag blocks.
  -- The report_not_viewed (Reminder 4) block is intentionally REMOVED.

  -- ===== A0: Dashboard ready (exec_summary exists, or 24h fallback) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'email', p.email,
    'first_name', COALESCE(p.first_name, 'there')
  )), '[]'::jsonb)
  INTO dash_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.chat_completed_at IS NOT NULL
    AND t.dashboard_ready_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.reports r
        JOIN public.report_sections s ON s.report_id = r.id
        WHERE r.user_id = t.user_id AND s.section_type = 'exec_summary'
      )
      OR t.chat_completed_at < NOW() - INTERVAL '24 hours'
    );

  IF jsonb_array_length(dash_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'dashboard_ready', 'users', dash_users),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
    UPDATE public.user_engagement_tracking
    SET dashboard_ready_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (SELECT (u->>'user_id')::uuid FROM jsonb_array_elements(dash_users) u);
  END IF;

  -- ===== A1: Unlock nudge #1 (2 days after dashboard_ready, 0 referrals) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'nudge', 1,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO nudge1_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.dashboard_ready_sent_at IS NOT NULL
    AND t.dashboard_ready_sent_at < NOW() - INTERVAL '2 days'
    AND t.unlock_nudge_1_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id);

  IF jsonb_array_length(nudge1_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'unlock_nudge', 'users', nudge1_users),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
    UPDATE public.user_engagement_tracking
    SET unlock_nudge_1_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (SELECT (u->>'user_id')::uuid FROM jsonb_array_elements(nudge1_users) u);
  END IF;

  -- ===== A2: Unlock nudge #2 (4 days after nudge #1, still 0 referrals) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'nudge', 2,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO nudge2_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.unlock_nudge_1_sent_at IS NOT NULL
    AND t.unlock_nudge_1_sent_at < NOW() - INTERVAL '4 days'
    AND t.unlock_nudge_2_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id);

  IF jsonb_array_length(nudge2_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'unlock_nudge', 'users', nudge2_users),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
    UPDATE public.user_engagement_tracking
    SET unlock_nudge_2_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (SELECT (u->>'user_id')::uuid FROM jsonb_array_elements(nudge2_users) u);
  END IF;

  -- ===== B1: Progression next-tool (count 1 or 2, stalled 3 days) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'variant', 'next_tool',
    'current_count', rc.cnt,
    'referral_code', p.referral_code,
    'top_role', (
      SELECT s.title FROM public.reports r
      JOIN public.report_sections s ON s.report_id = r.id
      WHERE r.user_id = t.user_id AND s.section_type = 'top_career_1'
      ORDER BY s.created_at DESC LIMIT 1
    )
  )), '[]'::jsonb)
  INTO prog_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  JOIN LATERAL (
    SELECT count(*)::int AS cnt, max(created_at) AS last_at
    FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
  ) rc ON TRUE
  WHERE rc.cnt IN (1, 2)
    AND rc.last_at < NOW() - INTERVAL '3 days'
    AND (t.referral_progression_nudge_count IS DISTINCT FROM rc.cnt)
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(prog_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'referral_progression', 'users', prog_users),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
    UPDATE public.user_engagement_tracking t
    SET referral_progression_nudge_count = (
      SELECT count(*)::int FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
    ), updated_at = NOW()
    WHERE t.user_id IN (SELECT (u->>'user_id')::uuid FROM jsonb_array_elements(prog_users) u);
  END IF;

  -- ===== B2: Refund unlock (count >= 3, stalled 3 days, send once) =====
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'email', p.email,
    'first_name', COALESCE(p.first_name, 'there'),
    'variant', 'refund',
    'referral_code', p.referral_code
  )), '[]'::jsonb)
  INTO refund_users
  FROM public.user_engagement_tracking t
  JOIN public.profiles p ON t.user_id = p.id
  JOIN LATERAL (
    SELECT count(*)::int AS cnt, max(created_at) AS last_at
    FROM public.referrals rf WHERE rf.referrer_user_id = t.user_id
  ) rc ON TRUE
  WHERE rc.cnt >= 3
    AND rc.last_at < NOW() - INTERVAL '3 days'
    AND t.refund_unlock_email_sent_at IS NULL
    AND p.email_reminders_enabled = TRUE
    AND p.email IS NOT NULL;

  IF jsonb_array_length(refund_users) > 0 THEN
    PERFORM net.http_post(
      url := edge_function_url,
      body := jsonb_build_object('type', 'referral_progression', 'users', refund_users),
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key)
    );
    UPDATE public.user_engagement_tracking
    SET refund_unlock_email_sent_at = NOW(), updated_at = NOW()
    WHERE user_id IN (SELECT (u->>'user_id')::uuid FROM jsonb_array_elements(refund_users) u);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

- [ ] **Step 2: Fill in the three unchanged blocks**

Replace the `-- … unchanged …` comment with the verbatim signup/survey/chat blocks from the
current live `check_and_send_reminders` (captured in the design session / retrievable via
`SELECT pg_get_functiondef('public.check_and_send_reminders'::regproc)`). Do NOT re-add the
`report_not_viewed` block.

- [ ] **Step 3: Commit the migration (before applying)**

```bash
git add supabase/migrations/20260615120000_post_chat_email_lifecycle.sql
git commit -m "feat(email): rewrite reminder cron — drop report_not_viewed, add lifecycle blocks"
```

---

## Task 7: Dry-run each selection block, then apply the cron rewrite

**Files:** none (verification + apply)

- [ ] **Step 1: Dry-run A0 (who would get dashboard_ready) — no send**

Run via MCP `execute_sql` (the A0 WHERE clause as a SELECT):

```sql
SELECT t.user_id, p.email
FROM public.user_engagement_tracking t
JOIN public.profiles p ON t.user_id = p.id
WHERE t.chat_completed_at IS NOT NULL
  AND t.dashboard_ready_sent_at IS NULL
  AND p.email_reminders_enabled = TRUE AND p.email IS NOT NULL
  AND ( EXISTS (SELECT 1 FROM public.reports r JOIN public.report_sections s ON s.report_id=r.id
                WHERE r.user_id=t.user_id AND s.section_type='exec_summary')
        OR t.chat_completed_at < NOW() - INTERVAL '24 hours' );
```
Review the list. EVERY already-completed user (incl. Natasha) will appear here on first run
because `dashboard_ready_sent_at` is NULL for everyone. **This is the backfill blast.**
Decide with Sjoerd: either (a) accept that all historical chat-completers get one
dashboard-ready email, or (b) pre-seed `dashboard_ready_sent_at = NOW()` for existing
completers so only NEW completers get it. See Step 2.

- [ ] **Step 2: (Recommended) Suppress the historical backfill**

To avoid emailing every past user, pre-stamp existing chat-completers as already-sent before
the cron goes live:

```sql
UPDATE public.user_engagement_tracking
SET dashboard_ready_sent_at = NOW()
WHERE chat_completed_at IS NOT NULL AND dashboard_ready_sent_at IS NULL;
```
(Confirm with Sjoerd first — this is an intentional data write. Skip only if he wants the
backfill blast. Same reasoning applies implicitly to nudges, which key off
`dashboard_ready_sent_at`, so stamping it also prevents a nudge blast.)

- [ ] **Step 3: Dry-run A1/A2/B blocks similarly**

Run each new block's WHERE as a SELECT (swap the `jsonb_agg` for `SELECT t.user_id, p.email,
rc.cnt`). Confirm counts are sane (likely 0 immediately after Step 2's stamping, which is
correct — nobody is 2+ days past a just-stamped timestamp yet).

- [ ] **Step 4: Apply the cron-function replacement**

Apply the appended `CREATE OR REPLACE FUNCTION` via MCP `apply_migration` (name
`post_chat_email_lifecycle_cron`). Version-controlled SQL → allowed per policy.

- [ ] **Step 5: Verify the live function no longer references report_not_viewed**

```sql
SELECT position('report_not_viewed' IN pg_get_functiondef('public.check_and_send_reminders'::regproc)) AS still_there;
```
Expected: `0` (not found). Also confirm it contains `dashboard_ready` and `unlock_nudge`:
```sql
SELECT position('dashboard_ready' IN pg_get_functiondef('public.check_and_send_reminders'::regproc)) > 0 AS has_dash,
       position('referral_progression' IN pg_get_functiondef('public.check_and_send_reminders'::regproc)) > 0 AS has_prog;
```
Expected: both `true`.

---

## Task 8: Live end-to-end verification

**Files:** none

- [ ] **Step 1: Confirm Natasha is no longer emailed**

```sql
SELECT email, dashboard_ready_sent_at, report_reminder_sent_at
FROM public.user_engagement_tracking t JOIN public.profiles p ON p.id=t.user_id
WHERE p.email = 'natashageurts@gmail.com';
```
Expected: `dashboard_ready_sent_at` is set (from Step 2 backfill suppression) → she is excluded
from A0 and all downstream nudges. The removed `report_not_viewed` block means the old email
can never fire again.

- [ ] **Step 2: Force one cron cycle and watch logs**

Run `SELECT public.check_and_send_reminders();` via MCP. Then check:
```sql
SELECT jobid, status, return_message, start_time
FROM cron.job_run_details WHERE jobid = 2 ORDER BY start_time DESC LIMIT 3;
```
And edge logs via MCP `get_logs` service `edge-function` — confirm no errors from
`send-reminder-email`. Immediately after backfill suppression, expect no sends (correct).

- [ ] **Step 3: Create one synthetic eligible user to prove A0 fires (optional but recommended)**

On a throwaway/test account you control: set `chat_completed_at = NOW()`,
`dashboard_ready_sent_at = NULL`, ensure an `exec_summary` section exists for its report,
`email_reminders_enabled = TRUE`. Run `check_and_send_reminders()`. Confirm the dashboard-ready
email arrives and `dashboard_ready_sent_at` is now set. Clean up the test row afterward.

- [ ] **Step 4: Final commit / wrap-up**

```bash
git add -A docs/superpowers
git commit -m "docs: mark post-chat email lifecycle plan tasks complete"
```
Then push per project policy (auto-deploys; edge function already deployed in Task 5).

---

## Notes / risks

- **Backfill blast** (Task 7 Step 2) is the single biggest operational risk. Stamping existing
  completers as already-sent is strongly recommended so the launch does not email the whole
  back catalogue at once.
- **English tool labels in emails** are intentional, matching the dashboard toolkit and the
  existing `payment-success` unlock email.
- **No em-dashes** in any user-facing copy (EN or NL) per the writing-style rule.
- **`report_not_viewed` removal** also makes `dashboard_visited_after_chat_at` dead as a gate;
  the client write in `Dashboard.tsx` is left untouched to minimize churn (harmless no-op).
