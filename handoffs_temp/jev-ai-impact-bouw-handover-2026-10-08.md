# Handover: AI-impact via Jev bouwen

- **Datum:** 2026-10-08
- **Voor:** een nieuwe Claude-sessie in de Cairnly-repo
- **Status:** ontwerp besloten en gemeten; **niets gebouwd**. Begin bij stap 1.

## Lees eerst

1. `docs/jev-cairnly-ontwerp-2026-09-23.md`, vooral **2.3b** (de herziene AI-impact-schaal, de rekenregels, de regel per soort rol, de meting) en 2.2 en 2.4 (wat er uit prompts, parsers en `CareerScoreCard.tsx` kan).
2. De geheugennotitie `project_jev_cairnly_design` (besluiten van 2026-10-05 en 2026-10-08).
3. De Claude Doc "Jev voor AI-impact: meting en advies" (https://claude.ai/code/artifact/7f0378cc-21b3-4f79-81c2-f3c62659a53b) voor de uitleg aan Sjoerd en de blinde beoordeling.
4. `scripts/jev-shared.mjs` en `scripts/jev-ai-impact.mjs --scale work`: daar staan de client, de vragen en de rekenregels al werkend; de edge function hoort hetzelfde te doen.

## Wat besloten is (niet opnieuw bespreken)

- **Eén pill: hoeveel van het werk AI overneemt.** Aanbod en banenverlies blijven buiten het label.
- **Vragen:** `physical_role` (Noul), `orchestrator_role` (Noul) en `ai_impact` (Score, vijf niveaus) letterlijk zoals in 2.3b. Model `jev-1.13.0` vastgezet. State per carrière: `title`, `overview`, `typical_tasks`, `company_size_type`, `path_type`, plus `research` = de nieuwste actieve `ai_research.key_findings`.
- **Rekenregels:**
  - `physical_role > 0,8` → Minimal.
  - `orchestrator_role > 0,8` → hoogstens Moderate (Minimal mag).
  - Verder `round(score)` met vloer Moderate.
  - Severe en Critical alleen als de score minstens dat getal is: 2,5 tot 2,99 wordt High.
  - Resultaat op 642 rollen: 6 Minimal, 316 Moderate, 317 High, 3 Severe, 0 Critical.
- **Soort rol (code):** eigen werk = `path_type` is `founder` of `freelance_fractional`, of `company_size_type` begint met "Own Company". De rest is loondienst, ook rollen zonder `path_type`.
  - **Loondienst:** Severe of Critical komt nooit in de top 3 (code in WF3 `Ranking`). Als runner-up of dream job mag het, met een waarschuwing.
  - **Eigen werk:** geen verbod. Wel de kanttekening dat AI een hefboom is, maar het ook voor concurrenten makkelijker maakt.
  - High is geen alarm.
- **Geen uitzondering voor AI-rollen** (`ai_native_role` is geschrapt).
- **Twee TypeSafe-accounts.** Lokaal staat de Cairnly-sleutel als `TYPESAFE_API_KEY` in `.env.local`. **Lees of print de waarde nooit.**
- AI-impact gaat over een functietitel, niet over een persoon, dus **geen privacybesluit nodig**. Stuur nooit profiel-, cv- of chatdata naar TypeSafe: dat besluit is nog niet genomen.

## De stappen

**Werkwijze (CLAUDE.md):** dit is een grote wijziging. Geef per stap eerst een korte recap (bestanden, kolommen, nodes), wacht op Sjoerds akkoord en voer dan pas uit. Commit direct op `main` en push. Een push die `supabase/functions/` raakt, deployt **alle** edge functions opnieuw; zeg dat erbij.

### Stap 1: schaduw (geen gebruiker ziet verschil)

1. **Migratie** in `supabase/migrations/` (naam `2026MMDDHHMMSS_jev_ai_impact.sql`):
   - Nieuwe kolommen op `enriched_jobs`: `ai_impact_level text` (check op de vijf waarden), `ai_impact_confidence real`, `ai_impact_probabilities jsonb`, `ai_impact_model text` en `ai_impact_at timestamptz`.
   - Pas toe via de Supabase MCP. Gebruik **geen** `supabase db push`: de migratiegeschiedenis loopt niet gelijk, zie geheugen `project_migration_history_mismatch`.
2. **`supabase/functions/_shared/jev.ts`:** port van `scripts/jev-shared.mjs`.
   - De sleutel komt uit `Deno.env` en stopt hard als hij ontbreekt.
   - Retry op 429/529.
   - Log per call de vraag-id's, de kansen, het model en de tokens, maar nooit de sleutel.
3. **Nieuwe edge function `ai-impact`:**
   - Invoer `{report_id}`. De aanroep wordt geauthenticeerd met de service role of een gedeeld geheim, want n8n roept hem straks aan.
   - Leest de `enriched_jobs` van dat rapport en de research, doet één Jev-request per carrière tegelijk, past de rekenregels toe en schrijft de vijf kolommen.
   - Raakt het oude `ai_impact_rating` niet.
   - Voeg het `[functions.ai-impact]`-blok toe aan `supabase/config.toml`.
   - Schrijf vitest-tests voor de rekenregels en de soort-rol-regel. Houd de pure logica in een los `_shared`-bestand, zie `project_vitest_node_env_traps`.
4. **Edge secret:** Sjoerd zet `TYPESAFE_API_KEY` in het Cairnly-Supabase-project (Dashboard → Edge Functions → Secrets). Dat is een andere plek dan `.env.local`; leg het hem stap voor stap uit.
5. **Backfill** van de bestaande rijen. Dat is een schrijfactie op productie, dus **expliciet vragen**. Daarna eerst een proefrun op 1 rapport.
6. **Schaduwfase:** WF2 blijft ongewijzigd, nieuwe rapporten krijgen het Jev-label nog niet automatisch. Optie: een databasetrigger of pg_net-call na de WF2-insert, of handmatig per nieuw rapport. Kies samen met Sjoerd.

### Stap 2: pipeline (n8n, per workflow Sjoerds expliciete ja, eerst exporteren naar `n8n_wfs_cairnly/backups/`)

- **WF2 `vVv0tsnFlBnarMdq`:** na `Supabase Insert1` een HTTP-call naar `ai-impact`.
  - `ai_impact1` (Sonnet) en `Set AI Impact Prompt1` vervallen.
  - `Salary Range1` hoeft geen `ai_impact_rating` meer te maken. Let op: dat label komt nu uit Gemini, niet uit `ai_impact1`.
  - **De export van WF6 loopt achter op live; controleer voor elke workflow eerst of de export gelijk is aan live** (n8n MCP `get_workflow_details`).
- **WF3 `zhgJuiDp60PS5ZKJ` `Ranking`:** een loondienstrol met Severe of Critical komt niet in de top 3 en schuift door naar de runner-ups. `Ranking` heeft nu geen `path_type` of label, dus `Pull enriched` moet die kolommen meenemen.
- **WF4 `seWmQPFQqIe60TkU`:** `T3 Careers Prompt`, `Set Runner Up Prompt`, `Dream Job Feasibility` en WF3 `Set Outside Box Prompt` krijgen het label en de kanttekening als vaste invoer. De vijf niveaubeschrijvingen en de waarschuwing "MUST be exactly one of" gaan eruit. `Split Top3`, `Parse runner up`, `Parse OOB` en `Parse Dream` zetten `metadata.ai_impact` en `metadata.ai_impact_ownership`.
- Wijzigingen zijn pas live na **publiceren**. Controleer `activeVersion.sameAsDraft`, en raak de sonnet-5 `max_tokens` niet aan (`project_sonnet5_max_tokens_trap`).

### Stap 3: dashboard

- `src/components/chat/CareerScoreCard.tsx` en de aanroepers (`ChatMessage.tsx`, het dashboard en de printcomponenten, `ShareCardModal.tsx`) lezen `metadata.ai_impact`. De regex-functies blijven alleen als terugval voor oude secties.
- Nieuwe teksten in het Engels en Nederlands: de vijf niveaubeschrijvingen (werk-versie) en de twee kanttekeningen.
  - **Eerst ter goedkeuring in een tijdelijke Claude Doc in de sidecar**, in de volgorde waarin de bezoeker ze ziet, met echte voorbeelden.
  - Pas na akkoord naar `main`, daarna de Doc verwijderen.
  - Namespace volgens het language contract (`project_language_contract`).
- Controleer in de browser (preview), want `tsc` checkt niets (`project_typecheck_is_a_noop`).

### Stap 4: opruimen (na een paar weken)

- Weg: de regexen en de aliastabel uit `CareerScoreCard.tsx`, en de oude kolom `ai_impact_rating`, zodra niemand hem meer leest.

## Feiten en valkuilen

- **Productiedata, 2026-10-08:** 690 `enriched_jobs`-rijen. 47 hangen aan een verwijderd rapport en worden overgeslagen. Rijen van vóór 16 mei 2026 hebben geen `report_id`. 287 rijen hebben geen `path_type`.
- **`ai_impact_rating` is een JSON-string** `{rating, explanation}` (parse-if-string, zie `project_jsonb_string_house_pattern`) in vier label-tijdperken.
- **Jev in de praktijk:** p50 278 ms, ongeveer 1.100 tokens per carrière, ongeveer $0,0007 per rapport. De confidence schommelt met ongeveer 0,15 bij gelijke invoer, dus bouw geen scherpe drempels op confidence.
- **Ruwe meetdata** stond in de scratchpad van de vorige sessie en is niet bewaard. Opnieuw draaien kost $0,03:

```bash
node scripts/jev-ai-impact.mjs --scale work --out scratchpad_jev
```

  Het script past de regels uit 2.3b volledig toe; de edge function moet hetzelfde `designLabel` krijgen.
