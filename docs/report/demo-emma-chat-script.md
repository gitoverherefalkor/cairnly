# Emma — chat script for the English coach flow (re-recording, September 2026)

Demo script for running the English persona through the AI chat, written
against report `dc17ed73-2c0c-4fa8-8fab-6f0078aea3d1` (Emma Whitfield, 38,
senior marketing manager at a London fintech). The first recording of this
session (2026-09-02) was driven by `scripts/demo-chat-step.mjs`; this is the
version to record by hand in the browser, or to replay with the same script.

Account: `demo.emma@cairnly.io` · password in `.env.local` as
`DEMO_DEMO_EMMA_PASSWORD` (the bottom entry wins) · interface in **English**.

Changes versus the first recording:

- **"Explain this comparison" moves to career 3** (Design Sprint Facilitator).
  Career 3's radar plots all three top matches, so the "three careers, five
  axes" note on the demo page finally sits next to a three-career radar.
  Career 2 gets the Move pill instead; career 1 gets a plain typed reaction.
- The typed turns are **less tidy on purpose**: dropped capitals, missing full
  stops, one honest typo she does not fix. The one dictated turn stays clean;
  the contrast is the point.

## Before you start

1. **Rewind the report and wipe the chat**, in one command:
   `node scripts/demo-reset-chat.mjs demo.emma@cairnly.io --full`
   That deletes the transcript, the coach's memory, the Keeps, the wrap-up
   rows (chat_highlights, exec_summary), clears section feedback, and sets the
   report back to `pending_review` so wrap-up can complete it again. The
   generated sections are untouched.
2. Close ALL private windows, open a fresh one, log in as Emma. A truly fresh
   window starts at the WelcomeCard. (Browser localStorage is the fourth
   place "returning user" state lives; see the Marloes script for the why.)
3. Export the current fixture is NOT needed first: `src/demo/fixtures/emma.en.json`
   is already committed, so the database is expendable.

## Her voice

38, MA in strategic communication, fifteen years in marketing, three direct
reports. Dry, precise, a little self-mocking. Not burnt out, "hollowed out":
she can do the job with her eyes closed and that scares her. Two things she
will not trade: two evenings a week at home by six (partner on nursing
shifts), and work where she is close to the story.

**She types like someone between meetings.** Sentences often start lowercase,
a comma where a full stop belongs, sometimes no final period, one typo left
in. Two to four sentences. **Once she dictates instead** (marked [DICTATE]):
long, full sentences, clean punctuation. Do not tidy the typed ones.

## The controls, and where this script uses them

| Pill | Used at |
|---|---|
| Continue to next section | after every section |
| I'd like to explore this more | 2 (with a chip click), 9 (typed) |
| I see this differently | 3 |
| Something else | 4, 10 |
| All done, wrap up session | end |

| Feature | Used at |
|---|---|
| Keep (bookmark) | 1, 9 |
| Read aloud | 1 (a few seconds, on camera) |
| Move pill ("Move: Upskill · explore why") | 6 (career 2) |
| Comparison radar + "Explain this comparison" | 7 (career 3) |
| "Ask about this role" | 7 (career 3, after the explanation) |
| Non-database question | 10 |

**[CLICK]** = press the pill. **[TYPE]** = paste the text as is. **[TAP]** =
open the subsection cards. **[KEEP]** = press Keep on the coach's message.

With `demo-chat-step.mjs` the same beats are: `ready`, `say`, `keep 1`,
`continue`, `explore`, `chip <n>`, `say --pill=differently`,
`say --pill=somethingElse`, `move top_career_2`, `explain top_career_3`,
`say --about=top_career_3`, `wrapup --note=…`.

---

## 0. Welcome

**[CLICK] I'm Ready!** The platform delivers section 1 directly.

## 1. Understanding Your Approach

The section's key line: her happiness tracks proximity to the story, not
title or budget; the fintech job gave her the broadest scope of her career
and her second-lowest score.

Press **Read aloud** for a few seconds, then **[TYPE]**:

> the scope without storytelling authority line is uncomfortably accurate. i took the fintech job because it was the biggest remit anyone had offered me and I've spent three years quietly wondering why it feels smaller than the agency did. nobody has ever put it as proximity to the story before, and i think that's it

**[KEEP]** the coach's reply (the "more scope, less proximity" one). Then
**[CLICK] Continue to next section.**

## 2. Strengths

Core claim: one capability under the skills list, finding the sentence that
makes a messy situation legible; "diagnostic work disguised as marketing
work"; harder to replace than a marketing function, AI-assisted or not.

**[CLICK] I'd like to explore this more.** Chips appear. **Click the chip
about AI** (something like "why AI is less of a threat to this than to
marketing execution work"). This is the on-camera multiple-choice beat.

After the coach's answer, **[TYPE]** (fallback written blind; adapt if the
answer went elsewhere):

> thats the distinction I couldn't articulate. the tools write a perfectly servicable launch email now and I'd started to read that as the job being over. what they don't do is sit in the room and notice that sales and product are describing two different customers. so the question is how I make the diagnostic layer visible on paper, because right now my title says execution

**[CLICK] Continue to next section.**

## 3. Areas for Development

The report folds perfectionism, self-criticism and over-owning into one
loop, guesses "long deliberation followed by a late scramble", and reads her
difficulty with criticism as defensiveness. The disagreement beat.

**[CLICK] I see this differently**, then **[TYPE]**:

> the loop is fair, I recognise it. but the late scramble isn't me, I'm the one who ships early and then keeps polishing after its already gone out, which is its own problem but a different one. and I don't take criticism defensively, I take it too much to heart, which looks the same from the outside and feels nothing like it. the bit that did land is the external checkpoint. i have never once decided something was good enough, someone else always had to tell me

**[CLICK] Continue to next section.**

## 4. Aligning with Your Values

Impact outranks growth outranks autonomy; the section notes her happiest
year had the thinnest cause attached.

**[CLICK] Something else**, then **[TYPE]**. She adds two things the survey
never asked; the coach should carry both into the career chapter:

> two things you should know before we get to careers. there's a live decision on the table: my CEO has floated a Head of Marketing role for the new year, bigger team, more budget and I'd guess about double the dashboards. I'm meant to say yes or no by the end of the quarter and right now my honest answer is that I'd be saying yes to the title, not the work. and the practical one, my partners rota means I need at least two days a week where I'm home by six. thats not a preference, its a condition

If the chapter-1 feedback card appears: fill it (Insightful / Just right /
Strengths / free text `development was sharp but fair`) and continue. If it
does not appear, that is the known gating bug; carry on.

**[CLICK] Continue to next section.**

---

## 5. Service Designer — Top match, 90%, Upskill

*Large agency / consultancy.* Built on her 8/10 agency pattern and the
customer-insight programme; the reality check names conceding ground too
early and proposal crunches versus her flexibility rule.

**[TAP]** the cards open one by one. Then **[TYPE]**:

> upskill I can live with, a certification is a calendar problem not an identity one. two things in the reality check landed harder. conceding ground too early is exactly what happened with our last rebrand, I folded on the positioning to keep the CFO happy and we've been paying for it since. and the proposal crunches are the real question, not the blueprinting. if pitch weeks eat my two evenings I'm back where I started with a nicer job title

**[CLICK] Continue to next section.**

## 6. Employee Experience Consultant — Second match, 84%, Upskill

Same agency rhythm, pointed inward at culture instead of customers. The
radar here compares this role with career 1 only; leave the explain button
alone on this card.

**[CLICK] the Move pill** ("Move: Upskill · explore why"). The feasibility
question is written for her automatically; the coach defends the rating.

Then **[TYPE]**:

> ok so upskill again, same certificate, different room. what I want to know is whether the inward version is the slow one. I ran a culture piece internally two years ago, values workshops and all, and it was the slowest most political thing I've ever done. if I'm sitting in ambiguity for months I want it to be about a customer, not about which VP owns the intranet

**[CLICK] Continue to next section.**

## 7. Design Sprint Facilitator — Third match, 84%, Ready now

*Own company / boutique practice.* The only "Ready now" card. Its radar plots
all three top matches: autonomy and schedule at the ceiling, stability at 2.

Once the cards are open, **[CLICK] Explain this comparison**. The prewritten
explanation posts into the chat ("you are the business").

**[TYPE]**:

> seeing all three on one radar is the first time this has felt like a real choice instead of a list. stability at 2 is honest at least. autonomy and schedule at the top is exactly the thing the other two can't give me, and its also the thing I'd be most likely to waste

Then **[CLICK] Ask about this role**, and **[TYPE]** (the input shows
"Asking about: Design Sprint Facilitator"; the message gets the [About …]
label):

> ready now is flattering and I notice its the only card that says it. but I've run exactly four sprints, all inside companies where someone else had already found the client and paid for the room. is this a job, or a freelance business with a nicer name? and what does year one honestly look like on income for someone starting from zero pipeline, with a mortgage and a partner on shifts

The honest answer is *a business first*: the coach should concede that and
price year one well under the card's range. **[CLICK] Continue to next
section.**

## 8. Runner-ups

Behavioural Communications Consultant (81), Product Marketing Consultant
(80), Founder, Qualitative Research Studio (80): her literal dream job,
ranked, with the capital-risk reason spelled out.

**[TYPE]**:

> the research studio sitting in the runner ups with reasons I can actually argue with is the most useful thing so far, more useful than it being at number one would have been. product marketing consultant is a no, thats my current job with invoicing attached. behavioural comms I want to understand: isn't that service designer for people who like footnotes? genuinely asking, the frameworks bit appeals and the client scepticism bit doesn't

**[CLICK] Continue to next section.**

## 9. Outside the box

Museum Interpretation Manager, Athlete Wellbeing and Development Manager
(it found her hiking), Editorial Director at a podcast/audio documentary
studio (the step toward her dream job).

**[CLICK] I'd like to explore this more**, skip the chips and **[TYPE]**:

> the athlete one made me laugh, I put hiking under hobbies and you built a career out of it. I don't think thats me, I like the walking precisely because nobody needs anything from me on it. the museum role is interesting and I suspect the salary heads up is doing a lot of quiet work in that sentence. the podcast studio is the one I keep re-reading. how close does that actually get to the documentary thing, or is it a consolation prize with better hours

**[KEEP]** the coach's reply. Second Keep of the session.

**[CLICK] Continue to next section.**

## 10. Dream jobs — Documentary Producer and Research Studio Founder

The peak. Documentary Producer: feasibility Low-Moderate, Retrain, with the
"executive version" (Series Editor, Executive Producer) as the realistic
door. Research Studio: Moderate-High, Reframe, "a go-to-market problem, not
a retraining one".

**[DICTATE]**, her one dictated message. Long, clean, narration:

> I want to say this properly because it's the part I was braced for. I put documentary producer in the dream job box half expecting to be told, politely, that I am thirty-eight with a mortgage and should stop. Instead it takes the dream seriously enough to say the entry route would cost me a decade, and then it hands me the executive version, which is the first time anyone has suggested there is a door into that world that does not start at the bottom. And the research studio, which I had filed as the sensible dream, comes back as the more realistic of the two, not because it is smaller but because I apparently already have the craft and only lack the business around it. I have been telling myself for three years that I have no idea what I want. Reading this, it is clear that I do. I just did not believe it was allowed.

Then the non-database beat. **[CLICK] Something else**, then **[TYPE]**:

> practical question and its not in the report. what does a service design certification actually cost in the UK, and can it realistically be done alongside a full time job, evenings or in blocks? and is it strange to ask my current employer to fund it when there's a fair chance I'd use it to leave, or is that just what training budgets are for

None of that is in the report; the coach answers from its own knowledge
(ranges, evening formats, how to frame the request).

## Wrap-up

**[CLICK] All done, wrap up session.** In the wrap-up card, add the note:

> Head of Marketing decision is due by the end of the quarter. Two evenings a week at home by six is a condition, not a preference.

**Save & Close**, land on the dashboard, end the recording there.

---

## After the run: re-freeze the demo

1. `node scripts/demo-export-fixture.mjs demo.emma@cairnly.io` (picks the
   completed report; refuses an empty transcript).
2. Re-anchor `src/demo/fixtures/emma.en.curation.json`: every message id
   changed. Anchors, in order: `kept` = the coach reply she kept in section 1
   (bottom), `pushback` = her "I see this differently" turn, `pillTag` = the
   Head of Marketing turn, `movePill` = the auto-written feasibility question
   on career 2, `radar` = the message that delivers career 3 (bottom),
   `askRole` = the `[About Design Sprint Facilitator]` turn, `dictated` = the
   dream-jobs turn. `npm test` fails loudly on a stale id.
3. Update the `annotations.emma.*` bodies in both demo locale files where the
   beat moved (movePill now says career 2 / Employee Experience Consultant;
   radar says career 3).
4. `node scripts/demo-render-pdf.mjs demo.emma@cairnly.io`.
5. `npm test`, then commit fixture + curation + locale + PDF together.

## What to watch while you run it

- Does the coach **carry the two-evenings condition and the Head of
  Marketing offer** from section 4 into the career sections unprompted?
- Career 3: does it **concede** that "Ready now" describes the skill, not the
  business, and give a realistic year-one range?
- Section 10: does the certification answer stay hedged (ranges, not
  invented prices)? Highest-risk moment.
- The first recording produced two generator blemishes (a third-person slip
  in the Editorial Director card, a stray Chinese character in one reply).
  Read the outside-the-box replies before keeping one.
