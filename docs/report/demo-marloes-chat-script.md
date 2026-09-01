# Marloes — chat script for the Dutch coach flow

Suggested replies for running the demo persona through the AI chat, so the
report finishes the way a real one does: WF7 writes a genuine `exec_summary`,
the chat produces a real `chat_highlights`, and the report reaches `completed`.

Right now both of those sections are **hand-authored placeholders**. A real run
replaces them.

Account: `demo.marloes@cairnly.io` · report `9144c1e6-9859-4289-9182-5421d2492b41`
Switch the interface to Dutch before starting, or the chrome will be English.

## Before you start

**Nothing to configure. Just run it.**

1. **Your sections are already backed up** in `public.demo_marloes_backup_20260828`
   (17 rows, 15 carrying Dutch). WF6 rewrites `content` on the sections she gives
   feedback on, so if the Dutch output disappoints, restore from there and drop
   the table when you no longer need it.
2. **`N8N_SHARED_SECRET` needs no action.** An earlier draft of this file called
   it a blocker; that was wrong. It is absent from the local `.env.local`, but it
   is set server-side — probed live, `translate-section` answers 401
   (Unauthorized) rather than 503 (secret not set). The local copy only matters
   if you want to invoke the translator from a terminal.
3. **Re-translation is automatic.** WF6 and WF7 both call `translate-section`
   themselves, so a rewritten section is re-translated without you doing
   anything.

The one thing worth knowing: the staleness trigger wipes `content_i18n` the
moment `content` changes, and the printed report is all-or-nothing per document.
So between WF6 rewriting a section and the translator catching up, a downloaded
PDF will come out **entirely in English**. That is the contract working, not a
fault. Wait for the workflows to finish and download again.

## Her voice

41, HBO, teamleider klantenservice at an insurer. Practical, warm, a little
self-deprecating. Firm about exactly two things: her Wednesday at home, and not
wanting to manage a team again.

**She types like someone answering between meetings.** Lower-case sentence
starts, commas where a full stop belongs, the odd typo she does not go back to
fix, a trailing thought without a final period. Occasionally she dictates, which
shows up as longer run-on sentences with almost no typos. Do not clean these up
when you paste them — a report generated from suspiciously well-formed input is
not a fair test of the coach.

## Use the buttons, not just the box

A real user does not type a paragraph at every turn. They click. Mixing the two
is what makes a recorded session look real rather than staged, and it is the
difference between a demo that reads like a transcript and one that reads like a
script.

The four you will use, with their Dutch labels:

| Button | Dutch label | What it does |
|---|---|---|
| `continue` | Door naar de volgende sectie | Moves on. No typing. |
| `explore` | Hier wil ik dieper op ingaan | Sends "Hier wil ik wat dieper op ingaan", then the coach digs in |
| `differently` | Dit zie ik anders | Opens the box with "Vertel hoe jij het ziet…" — then you type |
| `somethingElse` | Iets anders | Opens the box for anything off-script |

Each section below says which to use. **[TYPE]** means paste the text.
**[CLICK]** means press the button and type nothing.

---

## Sections 1-2 are done

You have already covered Jouw aanpak and Jouw sterke punten. This script picks
up at **Ontwikkelpunten**.

Report `9144c1e6-9859-4289-9182-5421d2492b41` (the 2026-09-01 re-run). The
content below is written against THAT run, not the earlier one — the top three
changed completely.

---

## 3. Ontwikkelpunten — you are here

The report frames it as one habit rather than three faults: she protects harmony
by absorbing work and friction herself. And it ties that directly to her hours:
"expensive right now specifically because you're trying to reduce your hours."

**[CLICK] Dit zie ik anders**, then **[TYPE]**:
> het klopt dat ik dingen naar me toe trek, dat weet ik van mezelf. maar
> "confrontaties vermijden" vind ik te zwart wit. ik ga het gesprek wel aan
> alleen kies ik mijn momenten. wat me wel raakt is dat stuk dat het me juist
> uren kost, daar had ik het verband nooit zo gelegd. ik dacht altijd dat ik
> minder uren wilde, niet dat ik anders moest werken

## 4. Jouw loopbaanwaarden

The report picks up her own word, *leegloop*, and argues she is refusing to
trade meaning for hours rather than looking for an easy job.

**[TYPE]**:
> ja. en fijn dat je leegloop overneemt want zo voelt het echt. voor mij is die
> balans trouwens heel concreet, ik ben op woensdag thuis en dat blijft zo tot
> de jongste naar de middelbare gaat. dat is geen voorkeur dat is een
> voorwaarde. minder uren in dezelfde rol heb ik al geprobeerd en dat hielp
> niks, dus dat klopt wel wat er staat

---

## 5. Learning and Development Specialist — Top match, 92%

*Large (201-1000) / Corporate.* The report leans on her own sentence: "Wat ik
het liefste doe is mensen beter maken in hun werk."

**[CLICK] Hier wil ik dieper op ingaan**, then **[TYPE]**:
> dat zinnetje van mij staat er nu wel heel groot, maar het klopt gewoon. wat
> me een beetje tegenhoudt is dat large corporate. ik zit nu bij een
> verzekeraar en juist die lagen en die afstand zijn waar ik vanaf wil. wordt
> dit dan niet weer een trainingsfabriek waar ik e-learnings zit te maken die
> niemand doet?

## 6. Quality Coach Customer Contact — Second match, 88%

The most realistic of the three: her current world, minus the managing.

**[TYPE]**:
> deze zou ik morgen kunnen. dat is meteen ook mijn twijfel, is dit niet gewoon
> een stap terug? ik was hiervoor senior klantcontact en dan ga ik nu coachen op
> gesprekken van anderen. aan de andere kant, die 8 die ik gaf was wel precies
> die periode dus misschien is terug hier niet het goede woord

## 7. Career Counselor — Third match, 81%

The emotional peak of the run. Her literal dream job, ranked, with her own
"papieren" doubt quoted back at her and answered.

**[CLICK] Hier wil ik dieper op ingaan**, then **[TYPE]**:
> oke hier moest ik even van slikken. dit is letterlijk wat ik heb opgeschreven
> bij die droombaan vraag en ik had niet verwacht dat het gewoon in de top 3 zou
> staan. ik ging er eigenlijk vanuit dat jullie zouden zeggen dat het niet
> realistisch was

Then push once more, because this is the question she actually has:
> en die papieren dan? ik heb hbo bedrijfskunde en verder niks. moet ik dan
> eerst een opleiding doen voor iemand me serieus neemt, of kan dat naast een
> baan

## 8. Runner-ups

MBO Teacher Business Services (81), Onboarding Program Manager (80),
Reintegration Coach (78).

**[TYPE]** — short, and picks a side:
> mbo docent had ik zelf nooit bedacht maar dat spreekt me aan, opleiden en
> begeleiden tegelijk. onboarding program manager minder, dat voelt weer als
> regelen en plannen. reintegratiecoach vind ik interessant maar ook zwaar, dat
> zijn wel mensen op hun slechtste moment

## 9. Outside the box

Community Health Worker, Athlete Wellbeing Advisor, and a Recipe Developer /
community cooking lead — the last one is genuinely odd, which is the point.

**[CLICK] Hier wil ik dieper op ingaan**, then **[TYPE]**:
> die kookprogramma's, daar moest ik om lachen. maar eerlijk gezegd raakt het
> wel iets, ik kook veel en ik snap wel dat je mensen daarmee bij elkaar krijgt.
> alleen ga ik daar de hypotheek niet mee betalen. die wijkgerichte zorg vind ik
> van deze drie het meest realistisch, al vraag ik me af of ik dat emotioneel
> aankan op de lange termijn

## 10. Droombanen — Loopbaanbegeleider en Trainer

Both dreams, and the report has already ranked one of them.

**[TYPE]** — dictated, so it runs long and stays clean:
> Wat me hier opvalt is dat allebei mijn droombanen ook gewoon terugkomen in de
> lijst hierboven, dus blijkbaar is het niet zo'n gek idee als ik zelf dacht. Ik
> zat er eigenlijk op te wachten dat er zou staan dat het te vol zit of dat
> iedereen zich coach mag noemen, dat hoor ik namelijk vaak. Wat ik hieruit
> meeneem is dat ik het niet in een keer hoef om te gooien, als ik ergens begin
> waar ik al mensen begeleid dan bouw ik dat vanzelf op. Een jaar zonder inkomen
> een praktijk opbouwen gaat niet, dat is gewoon de realiteit met twee kinderen

---

## Pacing

- **Three `Hier wil ik dieper op ingaan`** — L&D, Career Counselor, outside the
  box. The Career Counselor one is the moment to let run: her dream job came
  back ranked, and she asks the practical follow-up. That exchange is the single
  best thing in the recording.
- **One `Dit zie ik anders`** — ontwikkelpunten.
- **One or two `Door naar de volgende sectie`** wherever you want pace.

## What to watch while you run it

- Does the coach reply in **Dutch**? WF5's Dutch path has never run.
- Does it pick up the Wednesday and the "no managing again" boundary, and carry
  them into later sections?
- The **Praktijkopleider qualification question** is a genuine question. If the
  coach fumbles it, that is worth knowing before a bureau reads this.
- At wrap-up: does WF7 write a Dutch or English `exec_summary`? Under the
  language contract it should be **English canonical**, then translated. If it
  comes out Dutch, stage 3 missed a node.
