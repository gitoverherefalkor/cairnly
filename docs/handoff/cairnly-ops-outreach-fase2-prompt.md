# Prompt voor Claude Code: /ops tabblad "Outreach", fase 2 (kliktracking)

Kopieer alles onder de streep als één prompt in Claude Code, in de Cairnly-repo. Leg `outreach_prospects_seed.csv` (meegeleverd) in de repo op een plek die je in de prompt aanwijst, bijvoorbeeld `supabase/seed/outreach_prospects_seed.csv`.

---

Bouw fase 2 van het outreach-dashboard: first-party kliktracking op de partnerdemo, plus een minimaal tabblad "Outreach" in /ops dat per bureau laat zien wie de demo heeft geopend. Dit is bewust klein: geen Gmail-koppeling (dat is fase 3), geen werklijst met opvolgdata (fase 1), geen CRM.

## Context

Er gaan deze week ~20 koude mails naar re-integratiebureaus. Elke mail bevat één demolink van de vorm:

`https://cairnly.io/demo?p=partners&persona=marcel&utm_source=outreach&utm_medium=email&utm_campaign=bureaus-sep26&utm_content=<slug>`

`utm_content` is per bureau uniek en is de sleutel waarop je kliks aan een bureau koppelt. De 71 bureaus met hun slug staan in `outreach_prospects_seed.csv`. Latere campagnes (coaches, tier B) gebruiken dezelfde structuur met een andere `utm_campaign`.

## Harde regels

1. Logging mag /demo nooit vertragen of blokkeren. Fire-and-forget; als de insert faalt rendert de pagina gewoon.
2. Sla geen ruw IP-adres op. Sla wel user-agent, referer en de utm-velden op. Dit is B2B-outreach onder gerechtvaardigd belang; houd het minimaal.
3. Raak `access_codes`, `SURVEY_TYPE_MAPPING`, de survey-flow en het starter/encore-patroon niet aan.
4. /ops heeft al een tabbladstructuur; voeg daar een tabblad aan toe, geen nieuwe pagina, geen nieuwe layout.
5. Geen em-dashes (—) in UI-tekst. Huisstijl: teal #27A1A1, goud #D4A024, donker #213F4F, creme #FAF5E8. Max font-weight 700.
6. Bouw niets dat hieronder niet staat. Geen pixel voor open-tracking, geen e-mailkoppeling, geen grafieken.

## 1. Tabel `outreach_prospects`

Kolommen: `id` (uuid, pk), `slug` (text, unique, not null), `naam` (text), `tier` (text: A/B/C), `categorie` (text), `to_email` (text), `domain` (text), `alt_domain` (text, nullable), `contactpersoon` (text, nullable), `plaats` (text, nullable), `campaign` (text), `bow_slug` (text), `openingshaak` (text, nullable), `status` (text, default 'nog_niet_benaderd'), `notities` (text, nullable), `created_at`, `updated_at`.

`status` is een enum-achtig tekstveld met deze waarden: `nog_niet_benaderd`, `verzonden`, `opvolging_1`, `opvolging_2`, `gesprek_gepland`, `gesprek_gevoerd`, `pilot_afgesproken`, `pilot_gestart`, `founding_partner`, `afgewezen`, `geen_fit`. Sla het op als text met een check constraint, geen Postgres enum (die is lastig uit te breiden).

Seed de tabel uit `outreach_prospects_seed.csv` via een migratie of een idempotent seed-script (upsert op `slug`). Alle 71 rijen, ook tier B en C.

## 2. Tabel `outreach_clicks`

Kolommen: `id` (uuid, pk), `slug` (text, nullable, geen foreign key: onbekende slugs moeten óók gelogd worden), `campaign` (text), `persona` (text), `p` (text), `utm_source`, `utm_medium` (text), `user_agent` (text), `referer` (text, nullable), `is_bot` (boolean, default false), `created_at` (timestamptz, default now()).

Index op `(slug, created_at)`.

Geen `ip`-kolom. Geen `email`-kolom.

## 3. Logging op /demo

Controleer eerst hoe /demo rendert (client-side, server component, middleware) en kies de plek die een GET met querystring server-side ziet vóór of tijdens de render. Voorkeur: middleware of een route handler, zodat het ook logt als de bezoeker JavaScript blokkeert. Als dat in deze codebase onpraktisch is, een client-side beacon (`navigator.sendBeacon` naar een kleine API-route) bij mount, maar dan expliciet gedocumenteerd waarom.

Log alleen als `utm_content` aanwezig is. Zonder `utm_content` niets loggen (dat zijn gewone bezoekers via de partnerpagina).

Zet `is_bot = true` als de user-agent een van deze patronen bevat, hoofdletterongevoelig: `bot`, `crawler`, `spider`, `preview`, `headless`, `Microsoft Office`, `SafeLinks`, `Outlook`, `Google-Safety`, `GoogleImageProxy`, `curl`, `python-requests`, `Slackbot`, `LinkedInBot`, `WhatsApp`. Dit vangt de link-scanners van Outlook en Gmail die direct na verzending "klikken". Het is geen waterdichte lijst; fase 3 voegt tijdfiltering toe op basis van verzendtijd.

Gebruik de service-role key server-side voor de insert; nooit de anon key vanuit de browser met insert-rechten op deze tabel. Als je een client-side beacon nodig hebt, laat die naar een API-route posten die server-side inserts.

## 4. Afgeleide view `outreach_prospect_stats`

Een Postgres view (of een query in de app, maar view heeft de voorkeur) met per slug:

- `kliks_totaal`: aantal rijen met `is_bot = false`
- `kliks_uniek_dagen`: aantal onderscheiden dagen met een niet-bot-klik (dit is het cijfer dat je toont; drie kliks binnen een minuut zijn één bezoek)
- `eerste_klik`, `laatste_klik`: min/max `created_at` van niet-bot-kliks
- `bot_kliks`: aantal rijen met `is_bot = true`

Joinen op `outreach_prospects.slug`.

## 5. Tabblad "Outreach" in /ops

Bovenaan drie tellers: bureaus in seed, bureaus met minstens één niet-bot-klik, kliks vandaag.

Daaronder één tabel, standaard gesorteerd op: eerst rijen met een klik maar status nog `nog_niet_benaderd` of `verzonden` (dat zijn de warme, die wil Sjoerd bovenaan), dan op `laatste_klik` aflopend, dan op tier.

Kolommen: Naam, Tier, Contactpersoon, Status (dropdown, direct opslaan bij wijzigen, geen aparte opslaan-knop), Eerste klik, Laatste klik, Kliks (uniek per dag), Notities (inline tekstveld, opslaan bij blur).

Filters bovenaan: tier (A/B/C/alle), campaign, en een toggle "alleen met klik".

Onderaan, ingeklapt: de ruwe kliklog, laatste 100 rijen, inclusief bot-kliks met een label, zodat te controleren is of de botfilter goed werkt.

De enige twee bewerkbare velden zijn `status` en `notities`. Al het andere is afgeleid.

## 6. Test

- Open `/demo?p=partners&persona=marcel&utm_content=test-bureau` in een gewone browser: er verschijnt een rij in `outreach_clicks` met `is_bot = false`, en de demo laadt niet merkbaar trager.
- Dezelfde URL via `curl`: rij met `is_bot = true`.
- `/demo` zonder `utm_content`: geen rij.
- In /ops verschijnt `test-bureau` niet in de prospecttabel (staat niet in de seed) maar wél in de ruwe log onderaan.
- Verwijder de testrijen na afloop.

## Wat je NIET bouwt

- Geen Gmail- of IMAP-koppeling, geen "verzonden op" of "gereageerd" kolommen. Die komen in fase 3 en worden dan afgeleid, niet handmatig.
- Geen werklijst met "opvolging verlopen" logica (fase 1).
- Geen open-tracking pixel.
- Geen grafieken, funnels of exports.
- Geen partner-facing statistieken; dit is intern.

Lever op: de migratie(s), de seed, de logging, de view, het tabblad, en een korte lijst van welke bestanden je hebt aangeraakt.

---

## Voor Sjoerd (niet in de prompt)

1. Leg `outreach_prospects_seed.csv` in de repo voordat je de prompt draait; Claude Code verwijst ernaar.
2. De slugs in de csv zijn exact de `utm_content`-waarden uit de 20 concepten in Gmail. Voor tier B en C staan er alvast slugs in; gebruik die als je het sjabloon invult, dan landen die kliks straks vanzelf op de juiste rij.
3. Talenta en Radmer hebben een `alt_domain` (talenta.nl, radmer.nl) omdat hun persoonlijke mail op een ander domein loopt dan hun info@. Dat is voor fase 3, niet voor nu.
4. Test met `utm_content=test-bureau` vóór je de eerste echte mail verstuurt. Als de rij niet verschijnt, is de rest van de campagne blind.
5. De botfilter is een lijst, geen garantie. Verwacht in de eerste dagen een paar bot-kliks in de ruwe log; dat is het bewijs dat de filter nodig is, niet dat hij kapot is.
