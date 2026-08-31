# Marloes — chat script for the Dutch coach flow

Suggested replies for running the demo persona through the AI chat, so the
report finishes the way a real one does: WF7 writes a genuine `exec_summary`,
the chat produces a real `chat_highlights`, and the report reaches `completed`.

Right now both of those sections are **hand-authored placeholders**. A real run
replaces them.

Account: `demo.marloes@cairnly.io` · report `ff7a062b-bb97-4644-9c49-0dda5b54d2c0`
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

## 1. Jouw aanpak (Understanding Your Approach)

**[TYPE]** — the report's best insight deserves a real answer:
> dit klopt meer dan me lief is. ik heb het nooit zo scherp gehad maar het is
> precies dat. als teamleider ben ik de hele dag bezig met roosters, escalaties
> en overleggen over overlegen, en de momenten dat ik er echt zin in heb zijn de
> keren dat ik zelf even een lastige klant bel. dat zegt eigenlijk wel genoeg

## 2. Jouw sterke punten (Strengths)

**[TYPE]** — adds something the survey could not know:
> Klopt. al wil ik er wel bij zeggen dat die onboarding niemand gevraagd had,
> ik ergerde me gewoon aan dat nieuwe mensen zes weken lang niks konden en ben
> het in de avonduren gaan herschrijven. dat is wel een patroon bij mij, als
> iets rammelt ga ik het maken of het nou mijn taak is of niet

## 3. Ontwikkelpunten (Areas for Development)

**[CLICK] Dit zie ik anders**, then **[TYPE]** into the box that opens:
> het delegeren en te veel oppakken herken ik helemaal. maar "confrontaties
> vermijden" vind ik te zwart wit. ik ga het gesprek wel aan alleen kies ik mijn
> momenten, en ik wil niet dat het escaleert. misschien is dat ook gewoon een
> vorm van uitstellen dat kan. maar het voelt niet als bang zijn

## 4. Jouw loopbaanwaarden (Career Values)

**[TYPE]** — makes an abstraction concrete, and sets a hard boundary:
> werk prive balans klinkt zo vaag als je het zo opschrijft. voor mij is het
> heel concreet, ik ben op woensdag thuis en dat blijft zo tot de jongste naar
> de middelbare gaat. dat is geen voorkeur dat is een voorwaarde. en dat stuk
> over zware beslissingen klopt wel, ik hoef niet degene te zijn die knopen
> doorhakt over budgetten of reorganisaties, daar word ik niet blij van

---

## 5. Customer Service Trainer — Top match, 94%

**[CLICK] Hier wil ik dieper op ingaan**, then when the coach opens it up,
**[TYPE]**:
> hier werd ik wel enthousiast van, dit is het leukste deel van mijn werk alleen
> dan de hele dag. mijn twijfel zit em in de sector. blijf ik hiermee niet gewoon
> in verzekeringen hangen? ik doe dit al 18 jaar en ik weet niet of ik over vijf
> jaar nog steeds over polissen wil uitleggen

## 6. Praktijkopleider — Second match, 93%

The one she had not heard of, so exploring it is the natural move and the best
thing in the whole demo.

**[CLICK] Hier wil ik dieper op ingaan**, then **[TYPE]**:
> Deze kende ik niet als functie en die moest ik even opzoeken, maar dit is
> eigenlijk precies wat ik nu al doe met stagiairs alleen dan officieel en niet
> ernaast, dus ik zie mezelf dit echt doen. Wel een praktische vraag, heb ik hier
> een papiertje voor nodig? ik heb HBO bedrijfskunde en verder niks in de
> onderwijshoek

Follow up once more if the answer is good — a partner watching should see the
coach handle a second, harder question:
> en hoe kom ik daar dan aan? ik zie ze niet vaak voorbijkomen op indeed

## 7. Onboarding Specialist — Third match, 89%

**[TYPE]** — deliberately lukewarm, so the top three do not all read as wins:
> deze spreekt me minder aan. als ik het goed lees is dit vooral regelen dat
> laptops op tijd klaarstaan en checklists afvinken, dat is meer projectwerk dan
> mensenwerk. en het mensenwerk is nou juist waar ik het voor doe

## 8. Runner-ups

**[CLICK] Door naar de volgende sectie.**

One clean skip is realistic and gives the recording some pace. If you would
rather she reacts, this is short enough to stay quick:
> learning and development specialist vind ik interessant. die customer
> experience quality specialist niet, dat is voor mijn gevoel weer terug naar
> rapportages en dashboards en daar kom ik juist vandaan

## 9. Outside the box

**[CLICK] Hier wil ik dieper op ingaan**, then **[TYPE]**:
> wijkcoach raakt wel iets, dat is het soort werk waarvan ik denk dat het er echt
> toe doet. tegelijk lees ik wat het betaalt en dat gaat gewoon niet passen met
> onze hypotheek. bedrijfsmaatschappelijk werk vind ik eerlijk gezegd het
> interessantst van deze drie, dat zit dichter bij waar ik nu zit dan ik had
> verwacht

## 10. Droombaan — Loopbaanbegeleider

**[TYPE]** — dictated, so it runs long:
> Fijn dat jullie er niet omheen draaien, ik wist al half dat iedereen zich
> loopbaancoach mag noemen en dat het er vol zit. Wat ik hier vooral uit haal is
> dat ik het niet in een keer hoef te doen, als ik eerst praktijkopleider word en
> dat begeleidende stuk daar opbouw kom ik er misschien vanzelf. een jaar zonder
> inkomen een praktijk opbouwen kan ik niet, dat is gewoon zo

---

## Pacing for a demo recording

If this session is going to be watched by a partner, the rhythm matters as much
as the content. Roughly:

- **Two or three `Door naar de volgende sectie` clicks** across the whole run.
  Silence is realistic; a user who writes an essay every turn is not.
- **Three `Hier wil ik dieper op ingaan`**, on the two top careers and outside
  the box. This is the button that shows the product doing something a static
  report cannot.
- **One `Dit zie ik anders`**, on the development section. One disagreement is
  plausible; three looks like a person arguing with a document.
- Keep the two dictated answers (Praktijkopleider, droombaan) long. The contrast
  with the short clicks is what makes the rest read as genuine.

## Filler replies

For turns where you want to move on but a click is not offered.

- `klopt, ga verder`
- `ja hier herken ik me wel in`
- `dit had ik zelf ook al bedacht maar goed om bevestigd te zien`
- `prima, volgende`
- `interessant, daar moet ik even over nadenken. ga maar door`

## What to watch while you run it

- Does the coach reply in **Dutch**? WF5's Dutch path has never run.
- Does it pick up the Wednesday and the "no managing again" boundary, and carry
  them into later sections?
- The **Praktijkopleider qualification question** is a genuine question. If the
  coach fumbles it, that is worth knowing before a bureau reads this.
- At wrap-up: does WF7 write a Dutch or English `exec_summary`? Under the
  language contract it should be **English canonical**, then translated. If it
  comes out Dutch, stage 3 missed a node.
