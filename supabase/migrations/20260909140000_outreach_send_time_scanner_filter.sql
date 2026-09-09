-- Outreach: record when each bureau was mailed, and split clicks into
-- "confirmed" and "suspect" on that basis.
--
-- Why this exists. The first three clicks of the bureaus-sep26 campaign landed
-- 48, 53 and 83 seconds after their mail was sent, from three different Chrome
-- versions across Windows and Mac. That is a mail security scanner fetching the
-- link on delivery, not a person reading. The user-agent blocklist in the
-- outreach-click function cannot catch those: enterprise scanners (Proofpoint,
-- Mimecast, Barracuda and friends) deliberately present a real browser
-- user-agent. The only signal that separates them is TIME since sending, which
-- is why the phase 2 brief parked this until a send timestamp existed.
--
-- This is that timestamp, kept deliberately light: one nullable column, filled
-- either by hand (a backfill from Gmail) or automatically when the status is
-- flipped to 'verzonden' in /ops. No Gmail coupling in the product.
--
-- Classification (SUSPECT_WINDOW below): a non-bot click inside
-- [verzonden_op, verzonden_op + 2 minutes) is suspect. Everything else non-bot
-- is confirmed, including every click on a prospect whose send time is unknown,
-- so rows we know nothing about keep behaving exactly as they did before.
-- Nothing is deleted or hidden: suspect clicks stay in the table and in the raw
-- log, they just stop counting as someone having read the mail.
--
-- Additive and reversible: one column plus a view replacement.

alter table public.outreach_prospects
  add column if not exists verzonden_op timestamptz;

comment on column public.outreach_prospects.verzonden_op is
  'When the outreach mail to this bureau actually went out. Set automatically when status flips to verzonden in /ops, or backfilled from the Sent folder. Used to tell scanner clicks (within 2 minutes of sending) from real opens.';

-- Rebuilt to left join the prospect row for its send time. Still keyed on the
-- click side, so clicks on an unknown slug (a typo, a not-yet-seeded bureau)
-- keep showing up.
create or replace view public.outreach_prospect_stats
with (security_invoker = true) as
select
  c.slug,
  -- Every non-bot click, unchanged: the honest raw number.
  count(*) filter (where not c.is_bot)                                        as kliks_totaal,
  count(distinct (c.created_at at time zone 'Europe/Amsterdam')::date)
    filter (where not c.is_bot)                                               as kliks_uniek_dagen,
  min(c.created_at) filter (where not c.is_bot)                               as eerste_klik,
  max(c.created_at) filter (where not c.is_bot)                               as laatste_klik,
  count(*) filter (where c.is_bot)                                            as bot_kliks,

  -- Suspect: landed in the two minutes right after the mail went out.
  count(*) filter (
    where not c.is_bot
      and p.verzonden_op is not null
      and c.created_at >= p.verzonden_op
      and c.created_at < p.verzonden_op + interval '2 minutes'
  )                                                                           as kliks_verdacht,

  -- Confirmed: the rest. Unknown send time counts as confirmed, deliberately —
  -- absence of evidence must not silently downgrade a real click.
  count(*) filter (
    where not c.is_bot
      and not (
        p.verzonden_op is not null
        and c.created_at >= p.verzonden_op
        and c.created_at < p.verzonden_op + interval '2 minutes'
      )
  )                                                                           as kliks_bevestigd,

  count(distinct (c.created_at at time zone 'Europe/Amsterdam')::date) filter (
    where not c.is_bot
      and not (
        p.verzonden_op is not null
        and c.created_at >= p.verzonden_op
        and c.created_at < p.verzonden_op + interval '2 minutes'
      )
  )                                                                           as dagen_bevestigd,

  min(c.created_at) filter (
    where not c.is_bot
      and not (
        p.verzonden_op is not null
        and c.created_at >= p.verzonden_op
        and c.created_at < p.verzonden_op + interval '2 minutes'
      )
  )                                                                           as eerste_bevestigde_klik,

  max(c.created_at) filter (
    where not c.is_bot
      and not (
        p.verzonden_op is not null
        and c.created_at >= p.verzonden_op
        and c.created_at < p.verzonden_op + interval '2 minutes'
      )
  )                                                                           as laatste_bevestigde_klik

from public.outreach_clicks c
left join public.outreach_prospects p on p.slug = c.slug
where c.slug is not null
group by c.slug;

comment on view public.outreach_prospect_stats is
  'Per utm_content slug. kliks_totaal/eerste_klik/laatste_klik are every non-bot click. kliks_verdacht are the ones inside 2 minutes of verzonden_op (mail scanner shaped); kliks_bevestigd and the dagen_bevestigd / eerste_bevestigde_klik / laatste_bevestigde_klik columns are what the ops tab actually shows and sorts on. Clicks on prospects with no known send time count as confirmed.';

revoke all on public.outreach_prospect_stats from anon, authenticated;
