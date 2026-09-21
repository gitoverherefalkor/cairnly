# Ops dashboard: add marketing reach to cairnly.io/ops

Brief for Claude Code. This describes the goal, the decisions already made, and where it plugs into the existing code. It does **not** prescribe the schema or components — inspect what's there and match it.

## Context
`cairnly.io/ops` already exists and is gated to admins. It currently covers product ops: Traffic, People, n8n Errors, Blockers, Support, Usage, Feedback, Assessment Misses. It already has first-party site analytics (per-tab sessions, no cookies, no PII): visitors, bounce rate, pages/visit, top pages.

The goal is to make this one dashboard the full command center: bugs and signups (already there) **plus marketing reach (new)**. Not a separate tool — a new section on the same page.

## Where it lives in the code (start here)
- **Page:** `src/pages/Ops.tsx` — admin-gated by the `ADMIN_EMAILS` set, built on the shadcn `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` components, default tab `traffic`. Add the Marketing tab here.
- **Data layer:** a single edge function `supabase/functions/ops-feed/index.ts` (POST, reads with the service role, returns `traffic`, `people`, `items`, `n8n_usage`, `ai_spend` as one `OpsFeedResponse`). The frontend fetches it with the session access token + anon key.
- **Mutations already have a pattern:** the feed's dismiss/resolve action is a POST to the same function with `{ action: 'dismiss', item_key }`. Post create/update and stat snapshots should follow that same shape (e.g. `{ action: 'post_upsert', ... }`, `{ action: 'post_stat_snapshot', ... }`) rather than inventing a separate stack.
- **The traffic to overlay against:** the `page_views` table, populated by the public beacon `supabase/functions/track-view/index.ts` (stores `path`, `session_id`, `referrer`, `engaged`). This is the time series the post timestamps overlay onto. Note it already captures `referrer` — relevant for a future attribution upgrade, not needed for v1.
- **Supabase project** is already live and this workspace has read access to it, so once the marketing tables exist they can be read directly rather than numbers being copy-pasted into a doc.

## Decisions already made (don't re-litigate)
1. **/ops is the source of truth for posts.** Posts are authored/logged here directly. The intended flow is that once a post is live on LinkedIn, the **actual verbatim post text is pasted in** — so store the full post body, not just metadata. (Later this may sync from Sjoerd's LinkedIn page, but for now it's manual copy-paste of the live post. Design the table so an automated push could populate rows later without a rework.)
2. **Build it all at once** — post log, hand-entered stat snapshots, sentiment + gut-read pills, traffic overlay, breakdown-by-post-type views, and CSV export together in this pass.
3. **Attribution is eyeball-only for v1** — mark post-publish times on the existing traffic timeline and read the uptick by eye. No per-post link tagging / UTM plumbing yet.

## What to build

### 1. The post log
Every post that's gone out (or is scheduled), with the **verbatim live post text** plus enough metadata to later answer "what kind of post works":
- Full post body (pasted verbatim once live)
- Post type (personal story, opinion, behind-the-build, career data/teardown, launch series, success story)
- Author — Sjoerd for now; his wife will post under the Cairnly banner later in her own voice, so **keep authorship a separable field**
- Profile: personal vs company page
- Had image y/n + image type
- Hook style
- Series vs standalone
- Date posted
- Status (draft / scheduled / posted)

### 2. Hard engagement stats per post — snapshots over time
Impressions/reach, reactions, comments, reposts. Entered by hand (LinkedIn has no personal-profile API), so the entry form must be fast: numbers in, done. **Must support recording a post's numbers more than once** (e.g. day 3 vs day 14) since reach keeps climbing — don't overwrite, keep snapshots so the growth curve is preserved.

### 3. Soft calls per post
- Comment sentiment as a pill: positive / mixed / critical / quiet
- Gut-read pill or slider: win / neutral / miss

### 4. Correlate with the traffic already on this page
The real goal isn't LinkedIn vanity metrics — it's whether a post moves site visits. **Overlay post-publish timestamps on the existing traffic time series** (the `page_views` data) so an uptick in the hours and days after a post is visible directly against the real visitor data already tracked here. Do not build a second, separate analytics view.

### 5. Views
- Performance over time per post (the snapshot curve).
- A breakdown correlating outcome (site visits in the following hours, gut read, sentiment) against post type, hook style, image presence, and author — so patterns surface instead of a stat wall.

### 6. Export
CSV export of the post log and its stats, so it's never locked into this dashboard alone.

## Not in scope
Ad spend, funnel/landing-page conversion optimisation, per-post UTM attribution, and anything about which stats to headline on the posts themselves. This is purely: log the posts (verbatim), log the reach over time, show it next to the traffic that already exists.
