# Handoff: Encore marketing en outreach (NL), project

Stand: 25 november 2026. Deadline voor een eerste tractie-signaal: **12 tot 16 december 2026** (vóór het kerstreces).
Deze handoff vervangt de rommelige startsessie. Lees hem helemaal voordat je iets bouwt of verstuurt.

---

## 1. Doel

Cairnly Encore (https://cairnly.io/encore, NL: `/encore?lang=nl`) zichtbaar maken in Nederland bij 55/60-plussers die met hun
hoofdcarrière gestopt zijn (of binnenkort stoppen) en weer zinvol werk zoeken, betaald of onbetaald.
AI doet research, contactgegevens zoeken, mails schrijven en klaarzetten. **Sjoerd verstuurt zelf.**

Drie sporen tegelijk:
1. **Snel spoor, partners**: outplacement- en loopbaanbureaus met een 50+-aanbod, loopbaancoaches en netwerken voor 50+,
   LinkedIn-groepen. Insteek: Encore voor hun oudere kandidaten, niet het Pro-aanbod.
2. **PR**: seniorenbladen en -platforms, bladen en nieuwsbrieven van ouderenbonden, regionale kranten, eventueel regionale radio.
   Insteek: een toegankelijke, AI-gebaseerde oplossing die mensen na hun hoofdcarrière weer aan zinvol werk helpt.
3. **Lang spoor**: UWV, werkgeversservicepunten, grote re-integratiebureaus. Nu zaaien, oogsten in januari.

## 2. Besluiten van Sjoerd (25-11-2026)

| Vraag | Besluit |
|---|---|
| Wat krijgen partners? | Advies van Claude overgenomen: **pilot met 5 gratis Encore-codes per partner** (bestaand `access_codes`-mechanisme). Commissie of co-branding pas in januari bespreken. |
| Afzender | **sjoerd@cairnly.io** (Cairnly-mailbox, zoals de Pro-outreach). |
| Encore als campagne in het Ops-dashboard | **Ja**, met Sjoerds akkoord per batch rijen in productie. |
| Ads-cijfers | Ads zijn net gestart, nog geen cijfers. |
| Tractie-doelen | Akkoord, zie hieronder. |

**Tractie-doelen tot 16 december:**
- Kosten per betaalde aanmelding via ads (nulmeting zodra er cijfers zijn)
- Activatie: minimaal 50% van de aanmelders rondt binnen 7 dagen de vragenlijst af
- Partners: 30 mails verstuurd, 5 gesprekken, 2 partners die codes gebruiken
- PR: 10 pitches verstuurd, 2 publicaties of vermeldingen
- Instanties: 3 met een vervolgafspraak in januari

## 3. Werkafspraken (vast)

- **Nooit automatisch verzenden.** Alles wordt een concept dat Sjoerd goedkeurt.
- Elk concept krijgt een korte onderbouwing: wie is dit, waarom nu, wat is de haak.
- Externe teksten: **geen em-dashes**, NL (en EN waar nodig). Encore spreekt de eindgebruiker aan met **u**.
- Kwaliteit boven volume: ongeveer 30 grondig onderzochte partners.
- AVG: alleen zakelijke contactgegevens van organisaties, nooit persoonsgegevens van 55-plussers zelf.
  Elke mail heeft een makkelijke afmeldoptie.
- Subagents op Sonnet met effort medium. Alleen echt strategisch werk naar Opus met effort high, en zeg dan waarom.
- Nieuwe of gewijzigde teksten ter goedkeuring: in een tijdelijke Claude Doc in de sidecar, in leesvolgorde,
  met echte voorbeeldwaarden (zie CLAUDE.md "Copy approval"). Na akkoord en live: doc verwijderen.
- Productie-inserts in `outreach_*`-tabellen en wijzigingen aan bestaande edge functions of WF11/WF12:
  **eerst plan, dan akkoord van Sjoerd.**
- Git: volg CLAUDE.md (direct naar `main`, Vercel deployt). Een push die `supabase/functions/` raakt deployt
  **alle** edge functions opnieuw, inclusief de live outreach-functies. Zeg dat vooraf.

## 4. Wat er al is (feiten uit de startsessie)

### Omgeving
- **Supabase**: project `pcoyafgsirrznhmdaiji` ("Cairnly"). Lezen werkt via de MCP.
- **Gmail-connector** zit op Sjoerds **bethehitl.com**-mailbox, **niet** op sjoerd@cairnly.io.
  Drafts die je via de connector maakt komen dus niet in de juiste mailbox. Daarom loopt alle verzending
  (ook PR) via het dashboard: concepten in /ops, verzonden door WF12 vanaf sjoerd@cairnly.io.
  Uitzondering alleen als Sjoerd het anders wil.
- Er is geen `opsdash`-skill. Werk vanuit de code.
- De repo `gitoverherefalkor/outreach-dashboard` is de **verkeerde** (oud, verwijst door naar app.outsideinput.ai). Niet gebruiken.
- cairnly.io/encore is een SPA: WebFetch ziet alleen de titel. Lees de teksten uit `public/locales/nl/encore.json`.

### Ops-outreachdashboard (/ops, tab Outreach)
- Tabellen: `outreach_prospects`, `outreach_concepts`, `outreach_mails`, `outreach_clicks`, `outreach_send_queue`, `outreach_send_state`, `outreach_sync_state`.
- Edge functions: `ops-outreach`, `outreach-prepare`, `outreach-send`, `outreach-mail-sync`, `outreach-click`.
- n8n: WF11 "Outreach Mail Sync", WF12 "Outreach Send" (exports in `n8n_wfs_cairnly/`).
- Stand op 25-11: 71 prospects, allemaal `campaign = 'bureaus-sep26'` (Pro), 144 mails, 97 concepten.
- `outreach_prospects.campaign` bestaat al: Encore wordt **`encore-dec26`**. `categorie` is vrije tekst, `tier` A/B/C,
  `status` heeft een vaste lijst (zie constraint `outreach_prospects_status_check`).
- **Belangrijk:** de mailteksten zijn Pro-specifiek. `campaign` wordt nu alleen gebruikt voor de UTM-link.
  De skeletons in `supabase/functions/_shared/outreachInitial.ts` en `outreachFollowUp.ts` (en `outreachPrepare.ts`)
  sturen naar `/demo?p=partners` met de Pro-pitch. Encore-prospects in de tabel zetten zonder aanpassing
  levert Pro-mails en Pro-follow-ups op. **Dit moet eerst opgelost worden** (zie fase 1).

### Seniorenfilter op de bestaande bureaus
Een zoekactie op 50+/55+/senior/pensioen in naam, notities en openingshaak leverde **niets bruikbaars** op.
Het "filter" wordt dus: de websites van de ongeveer 40 outplacementbureaus (`categorie` DO en O) nalopen op een seniorenaanbod.
Verwacht een handvol. Verwijs in de mail niet naar de eerdere, onbeantwoorde Pro-mail.
Sla bureaus met status `afgewezen` of `geen_fit` over, tenzij de reden alleen Pro betrof (lees `notities`).

### Encore in het kort (bron: `public/locales/nl/encore.json`, `src/lib/pricing.ts`)
- Prijs **€79 eenmalig**: vragenlijst van ongeveer 15 minuten, rapport met 3 richtingen plus alternatieven, onbeperkt AI-coach.
- Richtingen betaald en onbetaald: advieswerk, toezicht, mentorschap, lesgeven, parttime, vrijwilligerswerk met inhoud, eigen onderneming.
  Per richting: waarom het past, bij welke uren, hoe je binnenkomt, eerlijk over leeftijd en AI-vaardigheid.
- Haken met bron (staan op de pagina):
  gemiddelde pensioenleeftijd 66 jaar en 4 maanden (CBS 2025); een 65-jarige leeft volgens de prognose nog 21 jaar (CBS, 2032);
  +77% meldingen van leeftijdsdiscriminatie (College voor de Rechten van de Mens, 2025);
  maar 7% van de 65- tot 74-jarigen gebruikte generatieve AI (Eurostat 2025).
- Encore-codes: `access_codes.survey_type = 'Encore - Post-Career Direction - 2026 v2'`.
  De 39 codes uit de week van 9 november zijn vermoedelijk tests, geen tractie.

### Partner-propositie (concept)
> Uw kandidaten van 58+ passen vaak niet in het gewone outplacementtraject naar een nieuwe baan.
> Encore geeft ze in een kwartier een serieus rapport met drie richtingen, betaald en onbetaald,
> met per richting hoe je binnenkomt en waar leeftijd wel en niet meespeelt. Uw coach begint het gesprek
> met een plan in plaats van een lege agenda.

Wat het de partner oplevert: een gericht aanbod voor een lastige groep, minder coachuren aan de oriëntatie, geen integratie nodig.
Aanbod: pilot met 5 gratis codes.

## 5. Plan met stop-momenten

**Fase 0: oriëntatie (half dag)**
- Lees CLAUDE.md, deze handoff, `public/locales/nl/encore.json` en de `_shared/outreach*.ts`-bestanden.
- Controleer of de gebruikte demo- of landingslink voor Encore klopt en welke UTM's nodig zijn
  (`utm_campaign=encore-dec26`, `utm_content=<slug>` naar `/encore?lang=nl`).

**Fase 1: dashboard Encore-klaar maken** → *stop: plan voorleggen, akkoord, dan bouwen*
- Encore-skeletons voor initial, chase 1/2 en check-in, gekozen op `campaign`, met de link naar `/encore?lang=nl` in plaats van `/demo`.
- Zorg dat bestaande Pro-concepten en follow-ups ongewijzigd blijven (tests in `_shared/*.test.ts` uitbreiden).
- Teksten ter goedkeuring in een Claude Doc. Deployen raakt alle edge functions: vooraf melden.

**Fase 2: research, drie parallelle subagents (Sonnet, medium)**
- (a) Partners: bestaande DO/O-bureaus nalopen op een 50+-aanbod, plus nieuwe partijen
  (loopbaancoaches voor 50+, netwerken, LinkedIn-groepen, pensioenfondsen en werkgevers met cursussen ter voorbereiding op het pensioen).
- (b) Media: seniorenbladen en -platforms, ouderenbonden (blad en nieuwsbrief), omroep, regionale kranten en radio.
  Per medium de juiste redacteur of rubriek en het zakelijke redactieadres.
- (c) Instanties: UWV, werkgeversservicepunten, grote re-integratiebureaus, met de juiste afdeling of persoon.
- Score 1 tot 5 op: past de doelgroep, bereik, snelheid van beslissen (haalbaar vóór kerst?), vindbaar zakelijk contact, concrete haak.
- Strategische weging van de shortlist en definitieve propositie: Opus, effort high.
- → *stop: gescoorde top ~30 (plus mediaal en instanties apart) voorleggen in een Claude Doc. Sjoerd keurt goed.*

**Fase 3: vastleggen en concepten (vanaf goedkeuring)**
- Goedgekeurde partijen als `outreach_prospects` met `campaign = 'encore-dec26'` → *akkoord per batch*.
- Per dag 5 tot 10 concepten in /ops, elk met onderbouwing. Sjoerd keurt goed, WF12 verstuurt.
- Partners die ja zeggen: 5 codes minten via het bestaande codemechanisme (status `codes_gemint`).

**Fase 4: ritme**
- Dagelijkse ping: nieuwe concepten, reacties, kliks, klaarstaande follow-ups (chase na 4 tot 5 werkdagen zonder reactie).
- Wekelijks: wat werkt, wat niet, bijsturen, stand van de tractie-doelen.
- Zodra de ads cijfers hebben: kosten per aanmelding en activatie na 7 dagen toevoegen aan de wekelijkse update.

## 6. Open punten
- Mag PR ook via het dashboard (vanaf sjoerd@cairnly.io), of wil Sjoerd persmails zelf vanuit Gmail sturen?
  Advies: via het dashboard, dan wordt alles op één plek gevolgd.
- Hoe meten we betaalde Encore-aanmeldingen per bron (ads, partner, media)? Uitzoeken in fase 0 (UTM's, Stripe-metadata).
