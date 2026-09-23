# Handoff: Jev in Cairnly uitwerken (vervolg op de brainstorm van 23-09-2026)

Doel: een Claude Code-sessie in de Cairnly-repo die de Cairnly-kansen uit de brainstorm
"Jev in de stack" uitwerkt tot een concreet ontwerp en een meetplan. Alleen lezen en
ontwerpen; niets bouwen.

```
Je werkt in de repo Cairnly (~/Documents/Code Projects/Cairnly). Lees eerst CLAUDE.md en houd je aan de werkwijze daar. Taak: werk de Cairnly-ideeën uit de brainstorm "Jev in de stack" uit tot een concreet ontwerp en een meetplan. Je bouwt niets, wijzigt geen n8n-workflow, edge function of database, en doet geen calls naar TypeSafe.

## Wat vaststaat (niet opnieuw onderzoeken)
- Jev (TypeSafe) is een beslismodel, geen tekstmodel. Vraagtypes: Choice (1 uit max 255 opties, kans per optie plus confidence; betrouwbaar tot ongeveer 240 opties), Score (2 tot 10 beschreven niveaus), Noul (kans dat een ja/nee-bewering klopt). Alle vragen in één call worden parallel en onafhankelijk beantwoord. Alleen tekst. $0,042 per miljoen invoertokens, uitvoer gratis. Context 64k tokens, 32k voor state plus de langste vraag. Zwak in tellen, rekenen, datums, lange irrelevante state; leest letterlijk; state kan de uitkomst sturen (injectie). Engels is de sterkste taal, en Cairnly's inhoud is Engels (de "language contract").
- Privacy: TypeSafe host in de VS (privacy policy), DPA met EU-standaardcontractbepalingen, zero data retention alleen voor enterprise, geen training op klantdata. Sjoerd heeft NOG NIET besloten of profiel- of cv-data naar TypeSafe mag. Ontwerp zo dat AI-impact (gaat over een functietitel, niet over een persoon) los kan starten.
- Volumes (productie, 23-09-2026): 32 rapporten (21 in de laatste 90 dagen), 40 profielen, 556 rapportsecties, 334 chatberichten, 19 hoofdstukfeedbacks, 0 dismissed_careers (functie sinds 15-09), 14 saved_jobs. Kosten zijn bij deze aantallen nergens het argument; de waarde zit in consistentie, eerlijke twijfel, snelheid waar de gebruiker wacht, en regels die code afdwingt in plaats van een prompt.

## Wat je eerst leest
1. De brainstorm zelf, op OutsideInput main (de lokale checkout daar loopt achter, dus lees hem uit git):
   git -C "/Users/sjoerdgeurts/Documents/Code Projects/OutsideInput" fetch origin main
   git -C "/Users/sjoerdgeurts/Documents/Code Projects/OutsideInput" show origin/main:docs/jev-brainstorm-2026-09-23.md
   De Cairnly-ideeën: #4 fit-scoring in stukjes, #5 labels één keer beslissen, #7 coachbeurt eerst sorteren (de kern), en #9, #12, #14 (bijzaak).
2. De inventaris van Cairnly's beslismomenten, met bestands- en node-verwijzingen: handoffs_temp/jev-cairnly-inventaris-2026-09-23.md (in deze repo).
3. De Jev-docs via https://docs.typesafe.ai/llms.txt, minimaal: primitives.md, confidence.md, patterns/composite-scoring.md, patterns/intent-routing.md, cookbooks/llm_guardrails.md, cookbooks/classification_using_confidence.md, model-jaggedness/jev-1.13.md.
4. De betrokken workflows en code: n8n_wfs_cairnly/WF3 (Objective Compat score, OC Score, BatchingOC, Step 2 analysis, Step 2 - Final Score, Ranking, Outside Of Box Analysis, Parse OOB), WF2 (ai_impact1, Set AI Impact Prompt1, 15TitSizAISal1, clean up JSON1), WF4 (Top 3 Careers HTTP, Split Top3, Runner Up Analysis, Parse runner up, Dream Job Feasibility, Parse Dream), WF5 (Cairnly Coach Agent), WF6 (Parse Query, Route by Section Type, de Build *Prompt / AI *-paren), src/components/chat/CareerScoreCard.tsx, src/lib/moveScale.ts, src/lib/enumLabels.ts. De exports in n8n_wfs_cairnly/ kunnen achterlopen op live: controleer waar je ontwerp op leunt met de n8n MCP, alleen get_workflow_details en search_workflows.

## Wat je oplevert
Eén document docs/jev-cairnly-ontwerp-2026-09-23.md met:
1. Fit-scoring (idee 4): per dimensie de Score- en Noul-vragen letterlijk uitgeschreven (instructie plus niveaubeschrijvingen); hoe 15 carrières in één request passen (state-opbouw, tokenbudget tegen 64k en 32k); gewichten en de harde bodem in code (salaris en uren als code, dealbreakers als Noul); wat WF4 als vaste input krijgt; en of de huidige 0-108-schaal blijft of wordt vervangen.
2. Labels (idee 5): AI-impact, Move en Feasibility als Score met de huidige beschrijvingen; waar ze worden opgeslagen; welke prompts ze niet meer hoeven te herhalen; welke regex- en aliascode in CareerScoreCard.tsx weg kan; de Noul "zelfde functiefamilie?" voor outside-the-box. Scheid wat loodgieterswerk is (een label opslaan, kan zonder Jev) van wat Jev toevoegt.
3. Coachbeurt (idee 7): de beurtcategorieën, de sectiekeuze, en het beleid dat code afdwingt: vervangen alleen na een sterke afwijzing met hoge zekerheid én een expliciet ja; "klaar na discussie" roept altijd eerst WF6 aan; CAT 0 slaat de hergeneratie over. Plus een voorstel voor wat de coach doet bij een signaal van nood; dat besluit is aan Sjoerd.
4. Een meetplan zonder productiewijziging: (a) bestaat de WF3-variantie nog (5 opgeslagen profielen, elk 3 keer scoren, zonder database-writes); (b) Jev-labels tegen de huidige labels in de 556 secties; (c) 60 handgelabelde coachbeurten uit chat_messages. Per meting: de aanpak van het script, wat er naar TypeSafe gaat, en een kostenplafond.
5. Kort over #9, #12 en #14: alleen wat afwijkt van de brainstorm.
6. Maximaal 5 vragen aan Sjoerd, en een samenvatting van 10 regels in gewoon Nederlands.
Commit dat document samen met dit handoffbestand en de inventaris, volgens de werkwijze in CLAUDE.md.

## Grenzen
- Geen n8n-workflow wijzigen, geen edge function deployen, geen database-writes, geen calls naar TypeSafe of naar een LLM met gebruikersdata.
- Geen persoonsgegevens (cv-inhoud, namen, e-mailadressen) in het document.
- Geen kosten- of latencycijfers die je niet uit de docs of de code kunt onderbouwen; markeer schattingen als schatting.
- De top-3-volgorde in WF4 (niet gesorteerd op score) is een bekende bug met een eigen taak; neem die niet mee.
- Klaar wanneer het document er staat, de drie kernontwerpen compleet zijn met letterlijk uitgeschreven vragen, en het meetplan per meting zegt wat nodig is.

Dit is een prompt voor een agent met echte systeemtoegang. Controleer de scope (alleen lezen, één nieuw document) voordat je hem plakt.
```

Doelmodel: Claude Code in de Cairnly-map. Het ontwerpwerk met Opus of Fable; laat het lezen
van de grote workflow-JSON's aan Sonnet 5-subagents over (Sjoerds regel voor onderzoek).

Opstarten:
1. Open Claude Code in de map `~/Documents/Code Projects/Cairnly`.
2. Plak alles tussen de twee regels met drie backticks hierboven.
3. Gelukt als de sessie begint met de brainstorm uit OutsideInput en de inventaris in
   `handoffs_temp/` te lezen.
