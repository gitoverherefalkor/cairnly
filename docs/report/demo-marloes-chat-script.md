# Marloes — chat script for the Dutch coach flow (run of 2026-09-01, afternoon)

Demo script for running the persona through the AI chat, written against report
`10646823-1920-4889-9dc0-f780b4215fca` (the post-rubric-fix re-run). The chat on
this report is untouched: zero messages, so the recording starts from the
welcome card.

Besides producing a real `exec_summary` and `chat_highlights`, this version is
built to **showcase every interaction the product has**: all four quick pills,
the wrap-up pill, the Keep button, read-aloud, the chapter-1 feedback card, the
career-card pills (Vraag iets over deze rol + the Move pill), the comparison
radar with its explain button, and one question the report cannot answer, so the
coach visibly knows things beyond the database.

Account: `demo.marloes@cairnly.io` · switch the interface to Dutch before
starting, or the chrome will be English.

## Before you start

1. **All sections are Dutch (verified 2026-09-01).** The Career Counselor
   runner-up card initially missed its translation; it was re-run via the
   n8n utility **"OPS - Retranslate report (manual)"** (inactive, manual
   trigger, reuses the shared-secret credential — edit the report_id in its
   HTTP node to reuse for any report). Re-verify anytime:
   `SELECT section_type FROM report_sections WHERE report_id = '10646823-1920-4889-9dc0-f780b4215fca' AND section_type <> 'init_summary' AND content_i18n->'nl' IS NULL;`
   — an empty result means everything is Dutch.
2. **The old backup table `public.demo_marloes_backup_20260828` is now stale.**
   It holds sections of a report that no longer exists. Don't restore from it;
   drop it whenever convenient.
3. **PDF timing note still applies.** WF6 rewrites trigger re-translation; a
   PDF downloaded in that window comes out entirely English. Wait, then
   download again.

## What this run says (one-paragraph refresher)

Top 3: **Customer Service Trainer 94** (Ready now), **HR Advisor L&D 92**
(Upskill: a 2-3 month instructional-design course), **Onboarding Specialist
90** (Ready now, but "laagste plafond van de drie"). Runner-ups: L&D Specialist
89, Training Coordinator 82, **Career Counselor 80** — her literal dream job,
ranked with honest reasons why it is not top 3. Outside the box: Food Service
Program Manager (it found her voedselbank volunteering), Athlete Wellbeing
Manager (her running), and Facilitator Restorative Practices (her
tension-absorbing habit reframed as a profession). Dream jobs: Trainer =
**"kun je volgend kwartaal al"** because she already holds the Praktijkopleider
certificate, Career Counselor = Upskill via a post-HBO certificate (6-12
months part-time, NOLOC), explicitly *not* a full retrain. The emotional peak
of this run is the dream-jobs section: both dreams come back ranked and
answered, one of them marked Ready now.

## Her voice

41, HBO Bedrijfskunde, teamleider klantenservice at an insurer. Practical,
warm, a little self-deprecating. Firm about exactly two things: her Wednesday
at home, and not wanting to manage a team again.

**She types like someone answering between meetings.** Lower-case sentence
starts, commas where a full stop belongs, the odd typo she does not fix, often
no final period. Keep typed replies short: two to four sentences. **Once in
the session she dictates instead** (marked [DICTEER]): that one runs long,
reads like narration, full sentences, clean punctuation, no typos. Do not
clean up the typed ones and do not shorten the dictated one; the contrast is
what makes it feel real.

## The controls, and where this script uses them

Quick pills (below the coach's message):

| Pill | Dutch label | Used at |
|---|---|---|
| continue | Door naar de volgende sectie | after deep-dives in 2 and 7 |
| explore | Hier wil ik dieper op ingaan | 2, 9 |
| differently | Dit zie ik anders | 3 |
| somethingElse | Iets anders | 10 |
| wrap up | Klaar, sessie afronden | end |

Special moves (each appears once, so the recording covers them all):

| Feature | Where it is | Used at |
|---|---|---|
| Keep button (Bewaren) | on any coach message | 1, 9 |
| Voorlezen (read-aloud) | on any coach message | 1 |
| Tap-to-open subsection cards | every career section | 5 (called out once) |
| Move pill ("Stap: Ready now · ontdek waarom") | career card | 5 |
| Comparison radar + "Leg deze vergelijking uit" | careers 2 and 3 | 6 |
| "Vraag iets over deze rol" (input gets "[Over …]" context) | career card | 7 |
| Chapter-1 feedback card ("Door naar loopbanen →") | after section 4 | 4 |
| Non-database question (coach's own knowledge) | anywhere | 10 |

**[CLICK]** = press the pill, type nothing. **[TYPE]** = paste the text.
**[TAP]** = open the subsection cards. **[KEEP]** = press Bewaren on the
coach's message.

### Explore-clicks are a live collaboration

After **Hier wil ik dieper op ingaan**, the coach generates 2-3 numbered
chips on the spot (since the 2026-09-01 WF5 update: in Dutch, phrased in
Marloes's first person, closing with "Iets anders, zeg het maar!"). Those
chips can't be scripted in advance. The flow during recording:

1. Click the explore pill and wait for the chips.
2. **Click one of the numbered chips on camera** at least once in the
   session: it posts as Marloes's own message, and that Claude-style
   multiple choice is itself a capability worth showing.
3. For the typed follow-up after the coach's deep-dive, paste the chips
   and the coach's answer to Claude in the working session; you get a
   reply in Marloes's voice within a minute. The [TYPE] texts under 2 and
   9 below are fallbacks written blind, use them only if you don't want
   to wait.

---

## 0. Welcome

**[CLICK] Ik ben er klaar voor!** — the platform delivers section 1 directly.

## 1. Jouw aanpak

The section lands on one idea: her satisfaction tracks the *distance to the
person she is trying to help*, not title or seniority. It also gently notes
that her self-picked "The Leader" archetype sits oddly next to how she
actually leads (influence and closeness, not authority).

First, two demo beats on the coach's message itself: **press Voorlezen** for a
few seconds of read-aloud, then **[KEEP]** the message with the
afstand-tot-de-persoon insight.

**[TYPE]**:
> die zin over de afstand tot de persoon die je probeert te helpen, die komt
> wel even binnen. iedereen vond het gek dat ik senior klantcontact leuker
> vond dan teamleider, dit is de eerste keer dat iemand uitlegt waarom

The coach replies; the pills reappear. **[CLICK] Door naar de volgende
sectie.**

## 2. Jouw sterke punten

Core claim: across four very different jobs her real skill is spotting the
exact point where a process breaks a person. Key insight: colleagues already
come to her to ask whether their work still suits them, so she is *already*
doing informal career coaching without calling it that.

**[CLICK] Hier wil ik dieper op ingaan** — chips appear. **Click the chip
about the informal coaching** (this is the on-camera multiple-choice beat).
After the coach's deep-dive, paste the exchange to Claude for her follow-up,
or use this blind fallback **[TYPE]**:
> daar heb ik nooit een naam aan gegeven, het voelde gewoon als je werk goed
> doen. hoe maak ik daar iets zichtbaars van zonder dat het meteen een andere
> functie hoeft te zijn

After the answer: **[CLICK] Door naar de volgende sectie.**

## 3. Ontwikkelpunten

The report folds her three survey answers into one habit: absorbing tension so
others don't have to feel it, and argues part-time won't protect her energy as
long as she can't say no. The disagreement beat of the session.

**[CLICK] Dit zie ik anders** (input opens with "Vertel hoe jij het ziet…"),
then **[TYPE]**:
> dat ik spanning absorbeer klopt, dat weet ik van mezelf. maar confrontatie
> vermijden vind ik te groot klinken, ik ga het gesprek echt wel aan alleen
> kies ik mijn momenten. waar ik wel stil van werd is dat parttime me niet
> gaat redden zolang ik geen nee zeg. ik dacht altijd dat minder uren het
> probleem was, niet hoe ik werk

## 4. Jouw loopbaanwaarden

The section reconciles an apparent contradiction: she doesn't want less
responsibility for people, she wants less exposure to high-stakes decisions
under pressure. And it redefines erkenning as "dat mensen bij jou
terechtkunnen", not a title.

**[TYPE]** — she volunteers a constraint that is NOT in her survey, which the
coach should carry into every later section:
> klopt helemaal dat het niet om minder verantwoordelijkheid gaat. voor de
> duidelijkheid, mijn woensdag thuis is heilig zolang de kinderen op de
> basisschool zitten, dat is geen voorkeur dat is een voorwaarde. en die zin
> over erkenning, dat mensen bij je terechtkunnen, dat is em precies

Then the **chapter-1 feedback card** appears. Fill it on camera, it takes ten
seconds and shows the product asks for feedback mid-flow:
- Hoe kwam dit deel binnen? → **Inzichtelijk**
- De lengte voelde: → **Precies goed**
- Sterkste onderdeel? → **Sterke punten**
- Free text: `ontwikkelpunten was scherp maar wel eerlijk`
- **[CLICK] Door naar loopbanen →**

---

## 5. Customer Service Trainer — Top match, 94%

*Large (201-1000) / Corporate, Move: Ready now.* Built on her 8/10 period, her
10→6 weeks onboarding rewrite, and her Praktijkopleider certificate. The
report is honest that 32 hours lands at €35-49k, under her stated range.

**[TAP]** the subsection cards open one by one (say on camera: the report
reveals per block, you're not dumped into a wall of text). Then **[CLICK] the
Move pill** — "Stap: Ready now · ontdek waarom" — and let the coach explain
why there's no retraining gap.

Then **[TYPE]**:
> ready now staat er makkelijk he. maar die realiteitscheck is raak, iemand
> aanspreken die het na zes weken nog niet kan, dat vind ik nu al lastig bij
> mijn eigen mensen. en dat salaris bij 32 uur is even slikken, al is het
> netjes dat dat er gewoon eerlijk bij staat

## 6. HR Advisor, Learning and Development — Second match, 92%

*Move: Upskill.* Formalizes her informal coaching into an advisory role; the
reality check is budget fights and influencing without authority.

Once the cards are open, the **comparison radar** appears (this role plotted
against nr. 1 on pace, social, autonomy, schedule, stability). **[CLICK] Leg
deze vergelijking uit** — a prewritten explanation posts into the chat:
"reikwijdte versus nabijheid".

**[TYPE]**:
> fijn om ze zo naast elkaar te zien, reikwijdte versus nabijheid is precies
> mijn twijfel. en eerlijk, dat budgetgevecht schrikt me meer af dan die
> cursus. een cursus kan ik inplannen, opboksen tegen afdelingshoofden niet

## 7. Onboarding Specialist — Third match, 90%

*Move: Ready now.* The most literal match with her proven work, and the report
says out loud it has the lowest ceiling of the three.

**[CLICK] Vraag iets over deze rol** — the input shows "Vraag over: Onboarding
Specialist" and her message gets the [Over …] context. Then **[TYPE]**:
> is dit niet gewoon mijn oude inwerkproject als fulltime baan? dat heb ik al
> een keer gedaan. ben ik hier niet binnen een jaar op uitgekeken

The honest answer is *yes, partly* — the report itself calls it a two-year
platform, not a destination. If the coach hedges instead of conceding, that's
worth knowing. **[CLICK] Door naar de volgende sectie.**

## 8. Runner-ups

L&D Specialist (89), Training Coordinator (82), Career Counselor (80). Her
dream job shows up here, ranked, with honest reasons why it is not top 3.

**[TYPE]** — short, picks sides, and asks the question a real user would ask:
> mooi dat loopbaanbegeleider er gewoon tussen staat, met redenen die ik ook
> nog snap. die training coordinator hoeft van mij niet, dat is precies het
> geregel waar ik vanaf wil. en is die l&d specialist niet gewoon nummer 2 met
> een andere naam? dat wil ik wel snappen

(The distinction is real: the runner-up is hands-on program ownership at a
mid-market company, nr. 2 is org-wide advisory. Good test of the coach.)

## 9. Outside the box

Food Service Program Manager (voedselbank operations), Athlete Wellbeing
Manager, Facilitator Restorative Practices. The last one is the clever one: it
takes her *development area* (absorbing tension) and reframes it as the core
skill of a mediation profession.

**[CLICK] Hier wil ik dieper op ingaan** — chips appear; here you can skip
them and type directly (one chip-click earlier in the session is enough).
Paste the chips to Claude if you want a tailored reply, or use this blind
fallback **[TYPE]**:
> dat jullie de voedselbank erbij pakken had ik niet zien aankomen, dat heb ik
> alleen bij hobbys ingevuld. leuk bedacht maar dat salaris wordt niks, dat
> weet ik van dichtbij. die mediation vind ik eigenlijk het interessantst, dat
> je van spanning opvangen je vak kan maken, daar moet ik even op kauwen

**[KEEP]** the coach's reply about the restorative-practices reframe. Second
Keep of the session, showing saved insights build up.

## 10. Droombanen — Loopbaanbegeleider en Trainer

The peak of this run. Trainer: feasibility **Hoog**, "de droombaan die je
eigenlijk al volgend kwartaal kunt starten", because the Praktijkopleider
certificate she almost forgot about is exactly the paper Dutch employers want.
Career Counselor: feasibility Gemiddeld, with the precise gap named — a
post-HBO certificate, 6-12 months part-time, NOLOC — "geen volledige
omscholing".

**[DICTEER]** — her one dictated message. Long, clean, narration:
> Wat hier staat had ik echt niet verwacht. Ik heb die droombaanvraag een
> beetje schuldig ingevuld, alsof het iets voor later was, en nu staat er dat
> trainer helemaal geen droom is maar iets wat ik volgend kwartaal al kan doen
> omdat ik die papieren blijkbaar al heb. Dat praktijkopleider certificaat was
> ik zelf eerlijk gezegd bijna vergeten, dat voelde altijd als iets interns
> van de zaak. En bij loopbaanbegeleider staat nu eindelijk eens concreet wat
> er dan nog mist, een post-hbo certificaat van een maand of zes naast mijn
> werk, dat is te overzien. Ik ging ervan uit dat jullie zouden zeggen dat het
> niet realistisch was, en er staat precies het tegenovergestelde.

Then the non-database beat. **[CLICK] Iets anders** ("Laat weten wat je
bezighoudt…"), then **[TYPE]**:
> weet je ook wat zo'n noloc erkende opleiding ongeveer kost en of dat in de
> avond kan? en is dat iets waar ik mijn opleidingsbudget van de zaak voor kan
> gebruiken, of vinden werkgevers dat gek als je er misschien mee vertrekt

None of that is in the report. The coach has to answer from its own knowledge
(realistic range, evening/part-time formats exist, how to frame a training
request). This is the moment that shows the coach is a coach, not a
text-reader.

## Wrap-up

**[CLICK] Klaar, sessie afronden.** The wrap-up card appears, WF6/WF7 fold the
session into the report (her Wednesday line and the dream-job exchange should
surface in the highlights), then **[CLICK] Naar het dashboard** and end the
recording on the finished report.

---

## Pacing recap

- Two **Hier wil ik dieper op ingaan** (2, 9), one **Dit zie ik anders** (3),
  one **Iets anders** (10), continues wherever pace is needed.
- One special move per career section: Move pill (5), comparison explain (6),
  ask-about-role (7). Don't stack them in one section; spreading them is what
  makes the demo read as capability breadth.
- The single dictated message is 10. Everything else stays short.

## What to watch while you run it

- Does the coach stay in **Dutch** the whole way, including after the
  comparison explanation (prewritten) and the non-database answer (live)?
- Does it **carry the Wednesday condition** from section 4 into the career
  discussions without being reminded?
- Section 7: does it **concede honestly** that Onboarding Specialist is a
  step-back risk, like its own report says?
- Section 10: does the NOLOC cost answer stay sensible and hedged (ranges, not
  invented prices)? This is the highest-risk moment of the demo.
- At wrap-up: `exec_summary` should be English canonical, then translated. If
  it lands in Dutch directly, a language-contract node regressed.
