# Encore v2: question id list

Source of truth for the Encore v2 survey ids and answer formats. Survey migration, frontend (CV mapper, region ids, dashboard sections) and the n8n chain (WF1P to WF4P) all key off these ids. Copy (English + Dutch with "u") is approved separately in a copy doc; this file only fixes ids, types and the stored answer values.

Status: draft for gate A (copy approval), 2026-11-08. Based on the v2 draft in the survey critique doc plus Sjoerd's decisions of 2026-11-08.

## Survey

- Survey id: `00000000-0000-0000-0000-000000000004` (new row; v1 `...0003` stays in place as fallback and is retired after launch)
- Survey type: `Encore - Post-Career Direction - 2026 v2` (add to `SURVEY_TYPE_MAPPING`; point `ENCORE_SURVEY_ID` / `ENCORE_SURVEY_TYPE` at v2)
- Section ids: `c3c3c3c3-0000-4000-a000-00000000000S` (S = 1-7)
- Question ids: `c3c3c3c3-000S-4000-a000-0000000000NN` (S = section, NN = question number). Pro uses `1111...`-`7777...`, Starter `a1a1a1a1-...`, Encore v1 `b2b2b2b2-...`. Never reuse those.
- Also route `...0004` in `forward-to-n8n` to `N8N_ENCORE_WEBHOOK_URL` and in `payment-success` (flavor encore mints the v2 survey type).

## Rules

- Stored answer values are the ENGLISH choice strings below. Dutch labels go in `questions.translations.nl.choices` (display only), the same pattern as Pro.
- Every multiple-choice row sets `min_selections` / `max_selections` and `config.exclusive_choices` as listed. `(one)` = single choice (`allow_multiple false`).
- Skip logic: a question's `config.show_if` (`{question_id, in | not_in}`) hides it based on an earlier answer (src/lib/surveySkip.ts). 5.2 is hidden when 5.1 is "I don't have a partner" (migration 20261111230000). 3.1 still offers the partner option, because it comes before 5.1.
- 28 questions at launch (7.2 reserved). 4 open text answers, 2 of them required (2.3, 3.2).

## Section 1: About you

Section id `c3c3c3c3-0000-4000-a000-000000000001`. Description: "A few basics, so the advice fits your life."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 1.1 | `c3c3c3c3-0001-4000-a000-000000000001` | short_text | yes |  | What is your first name? |  |  |
| 1.2 | `c3c3c3c3-0001-4000-a000-000000000002` | number | yes |  | How old are you? |  |  |
| 1.3 | `c3c3c3c3-0001-4000-a000-000000000003` | dropdown (country picker) | yes |  | Where do you live? |  | Keeps the 10 region-band choices so the country picker renders; add id to REGION_QUESTION_IDS. |
| 1.4 | `c3c3c3c3-0001-4000-a000-000000000004` | multiple_choice (one) | yes |  | Where are you in your working life? | `Still working, I stop in more than a year`; `Still working, I stop within a year`; `Working less, step by step`; `Stopped less than a year ago`; `Stopped one to three years ago`; `Stopped more than three years ago`; `I run my own business and want to step back` |  |
| 1.5 | `c3c3c3c3-0001-4000-a000-000000000005` | multiple_choice (one) | yes |  | Whose decision is it to stop working? | `My own`; `Partly mine`; `It was decided for me, for example in a reorganisation`; `Nothing is decided yet` |  |

## Section 2: Your working life

Section id `c3c3c3c3-0000-4000-a000-000000000002`. Description: "What you did, and what you'd like to keep from it."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 2.1 | `c3c3c3c3-0002-4000-a000-000000000001` | career_history (slim mode, new) | yes |  | Which roles shaped your working life? |  | Widget needs a slim mode: no months, company size, culture or 1-10 slider; max 4 roles; one voice-enabled text box per role. CV mapper maps into it. |
| 2.2 | `c3c3c3c3-0002-4000-a000-000000000002` | multiple_choice (up to 5) | yes | /5 | What were you known for at work? | `Explaining things clearly`; `Organising and planning`; `Listening and giving advice`; `Solving practical problems`; `Leading a team`; `Bringing people together`; `Numbers and money`; `Writing`; `Selling and convincing`; `Making or building things`; `Looking after people`; `Spotting risks early`; `Starting new things`; `Other` (free text) |  |
| 2.3 | `c3c3c3c3-0002-4000-a000-000000000003` | long_text | yes |  | What did you love about your work? |  |  |
| 2.4 | `c3c3c3c3-0002-4000-a000-000000000004` | multiple_choice (up to 3) | yes | /3 | What are you glad to leave behind? | `Long meetings`; `Office politics`; `Targets and reviews`; `Commuting`; `Being on call`; `Fixed hours`; `A lot of travel`; `Pressure and deadlines`; `Managing people`; `Other` (free text); `Not much, I liked it all` (exclusive) |  |

## Section 3: Being useful

Section id `c3c3c3c3-0000-4000-a000-000000000003`. Description: "The heart of it: what being useful looks like for you."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 3.1 | `c3c3c3c3-0003-4000-a000-000000000001` | multiple_choice (one) | yes |  | Which of these feels most true for you right now? | `I want to stay useful, but not in a job like my old one. I don't know what fits me.`; `Work gave my week its shape. I'm not sure what will replace it.`; `Most of my contacts came through work. I don't want to lose that.`; `My partner and I need to figure this out together.`; `None of these. I mostly want to make the most of the coming years.` | Wording is provisional: replace with interview words. Choice VALUES may change, so WF prompts should read the choice position/meaning, not exact text. |
| 3.2 | `c3c3c3c3-0003-4000-a000-000000000002` | long_text | yes |  | When did you feel most useful? |  |  |
| 3.3 | `c3c3c3c3-0003-4000-a000-000000000003` | multiple_choice (up to 3) | yes | /3 | Who would you most like to be useful to? | `One person at a time, like a student or a starter`; `A team or organisation`; `Young people`; `People going through a hard time`; `My own field or profession`; `My town or neighbourhood`; `A cause, like nature, culture or health`; `My family`; `Myself, by making or learning something` |  |
| 3.4 | `c3c3c3c3-0003-4000-a000-000000000004` | multiple_choice (several) | yes |  | Which of these would you like to explore? | `Paid work, part time or per project`; `Interim or freelance work in my field`; `A board, supervisory or advisory role`; `Mentoring or coaching`; `Teaching or training`; `Volunteering`; `Starting something small of my own`; `Learning something new`; `I don't know yet, show me what fits` (exclusive) | Drives WF2P: which path types to offer. |
| 3.5 | `c3c3c3c3-0003-4000-a000-000000000005` | long_text | no |  | Is there something you already tried, or an idea you keep coming back to? |  |  |

## Section 4: What suits you

Section id `c3c3c3c3-0000-4000-a000-000000000004`. Description: "How you like to spend your time and energy."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 4.1 | `c3c3c3c3-0004-4000-a000-000000000001` | multiple_choice (one) | yes |  | After a day with lots of people, how do you feel? | `Full of energy`; `Good, but I need some quiet after`; `A bit tired`; `Drained, I need time alone` |  |
| 4.2 | `c3c3c3c3-0004-4000-a000-000000000002` | multiple_choice (one) | yes |  | What should your week look like? | `Fixed days and set appointments`; `A steady rhythm with room to move`; `Free, I commit per project or season`; `Completely open` |  |
| 4.3 | `c3c3c3c3-0004-4000-a000-000000000003` | multiple_choice (one) | yes |  | Which role suits you best? | `Leading, taking charge`; `Doing, rolling up my sleeves`; `Advising, being the sounding board`; `Teaching, helping someone grow`; `Connecting, bringing people together`; `It depends on the setting` |  |
| 4.4 | `c3c3c3c3-0004-4000-a000-000000000004` | multiple_choice (exactly 3) | yes | 3/3 | What matters most to you in the coming years? | `Being useful to others`; `Keeping my mind busy`; `Having people around me`; `A rhythm to my week`; `My experience being valued`; `Some extra income`; `Freedom for travel and family`; `Making or building something`; `Giving back to a cause`; `Learning something new` |  |

## Section 5: The people around you

Section id `c3c3c3c3-0000-4000-a000-000000000005`. Description: "Your partner, your friends, and who you'd like to do things with."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 5.1 | `c3c3c3c3-0005-4000-a000-000000000001` | multiple_choice (one) | yes |  | How do your plans relate to your partner's? | `We make plans together`; `We each do our own thing, and that works`; `We haven't really talked about it yet`; `We want different things`; `I don't have a partner` |  |
| 5.2 | `c3c3c3c3-0005-4000-a000-000000000002` | long_text | no |  | What does your partner hope for in the coming years? |  | Hidden when 5.1 = "I don't have a partner" (`config.show_if`). |
| 5.3 | `c3c3c3c3-0005-4000-a000-000000000003` | multiple_choice (one) | yes |  | How do you feel about the people around you? | `I have plenty of good people around me`; `Enough, but new contacts would be welcome`; `I miss the daily contact from work`; `I'd like to meet people in the same phase of life` |  |
| 5.4 | `c3c3c3c3-0005-4000-a000-000000000004` | multiple_choice (one) | yes |  | Do you like to do things on your own or with others? | `On my own`; `With one or two others`; `As part of a group`; `It doesn't matter` |  |

## Section 6: Fitting it into your life

Section id `c3c3c3c3-0000-4000-a000-000000000006`. Description: "Time, place and money, so the options are realistic."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 6.1 | `c3c3c3c3-0006-4000-a000-000000000001` | multiple_choice (one) | yes |  | How much time would you like to spend on what comes next? | `A few hours a month`; `Half a day a week`; `One or two days a week`; `Three days or more`; `It depends on the season` |  |
| 6.2 | `c3c3c3c3-0006-4000-a000-000000000002` | multiple_choice (several) | yes |  | What is already fixed in your calendar? | `Days with grandchildren`; `Caring for someone`; `Long trips or winters abroad`; `Clubs or volunteering I want to keep`; `Nothing fixed` (exclusive) |  |
| 6.3 | `c3c3c3c3-0006-4000-a000-000000000003` | multiple_choice (one) | yes |  | Where would you like this to happen? | `From home, online`; `Close to home`; `Within an hour's travel`; `Anywhere, for the right thing` |  |
| 6.4 | `c3c3c3c3-0006-4000-a000-000000000004` | multiple_choice (one) | yes |  | Does it need to pay? | `No, money isn't the point`; `A little would be nice`; `Yes, extra income matters to me` |  |

## Section 7: To finish

Section id `c3c3c3c3-0000-4000-a000-000000000007`. Description: "One last question, and room for anything else."

| # | Id | Type | Req | Min/Max | Label (EN) | Stored values | Notes |
|---|---|---|---|---|---|---|---|
| 7.1 | `c3c3c3c3-0007-4000-a000-000000000001` | multiple_choice (up to 2) | yes | /2 | What would make this worth it for you? | `A clear picture of what suits me now`; `Options I hadn't thought of`; `A first step I can take next week`; `Help to talk it over with my partner`; `Someone checking in with me in the coming months`; `An honest view on an idea I already have` |  |
| 7.2 | `c3c3c3c3-0007-4000-a000-000000000002` | multiple_choice (one) | yes |  | May we check in with you later? | `Yes, after 3, 6 and 12 months`; `Once, after 6 months`; `No, thank you` | Id reserved, NOT in the launch survey. Insert only when the check-in emails exist (workstream 7). |
| 7.3 | `c3c3c3c3-0007-4000-a000-000000000003` | long_text | no |  | Anything else you'd like us to know? |  |  |

## Mapping notes for the n8n chain

- WF1P (profile): strengths and energy from 2.1-2.4, 3.2, 4.1-4.3; what they want to keep from 2.3; what to avoid from 2.4.
- WF2P (options): path types from 3.4, audience from 3.3, sized by 6.1-6.4 and 6.2 fixed commitments; 3.5 is an idea to assess honestly.
- WF3P (scoring): weights from 4.4 (exactly 3) plus 5.3/5.4 (social need) and 6.4 (pay).
- WF4P (report): open with the problem picked in 3.1; every option gets a first step for next week; 7.1 says what the person wants from the report; partner context from 5.1-5.2.
- 3.1 wording is provisional (to be replaced by interview words), so prompts should not match on the exact choice text.
