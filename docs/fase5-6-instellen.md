# Fase 5 (finale) en fase 6 (mails en afwerking) – instellen en testen

## 1. Database
SQL Editor › New query, telkens plakken en Run:
1. `supabase/005_finale.sql` → "SQL 005 uitgevoerd"
2. `supabase/006_meldingen.sql` → "SQL 006 uitgevoerd"
   (Melding over pg_cron? Ga naar Database › Extensions, zet **pg_cron** en **pg_net** aan, en voer 006 opnieuw uit.)

## 2. Edge Functions
1. **beheer bijwerken**: Edge Functions › `beheer` › tabblad **Code** › alles vervangen door `supabase/functions/beheer/index.ts` › **Deploy**.
2. **meldingen aanmaken**: Deploy a new function › Via Editor › naam `meldingen` › plak `supabase/functions/meldingen/index.ts` › Deploy.
3. Bij `meldingen` › Details: **Enforce JWT Verification UIT** › Save.
4. Edge Functions › Secrets › nieuw secret **CRON_SECRET** = een lange willekeurige tekst (laat je wachtwoordkluis er één maken, bv. 32 tekens, enkel letters en cijfers).

## 3. Dagelijkse herinneringen inplannen
Open `supabase/007_dagelijkse_herinneringen.sql`, vervang:
- `PROJECTREF` door het stuk vóór `.supabase.co` in je Project URL
- `CRON_GEHEIM` door exact dezelfde tekst als CRON_SECRET
Plak in SQL Editor › Run. Onderaan zie je `schoolcup-meldingen | 0 6 * * * | true`.

## 4. Website
GitHub › Upload files › sleep in één keer de volledige inhoud van het pakket (mappen `css`, `js`, `supabase`, `docs` en alle `.html`-bestanden, plus `.assetsignore`). Commit changes.
Op Windows/Mac kan `.assetsignore` verborgen zijn; maak het dan via Add file › Create new file met de inhoud uit het pakket.

## 5. Testen (testproject)
**Beheerders** – Beheer › Beheerders › voeg een tweede beheerder toe.
**Herinneringen** – Beheer › Instellingen:
- Testklok `01/11/2026 09:00` → "Proef" → herinnering *ploegen*
- Testklok `04/11/2026 09:00` → "Proef" → herinnering *kern*
- Testklok `13/11/2026 09:00` → "Proef" → herinnering *speeldag 1*
"Proef" verstuurt niets; "nu versturen" wel (pas na Resend-verificatie).
**Finale**
1. Beheer › Planning › speelschema genereren (als dat nog niet gebeurde).
2. SQL Editor: `supabase/008_testuitslagen_enkel_test.sql` (willekeurige uitslagen).
3. Testklok `18/03/2027 09:00` › Beheer › **Finale** › Finalisten vastleggen › finaleplanning opslaan.
4. Meld aan als een finalist-school (bv. de testgebruiker van een school in de top 2) › Speeldag › tabblad **Finale** › invullen.
5. Testklok `12/05/2027 13:00` › Beheer › Finale: een finalist die niet alles invulde krijgt een knop **Vrijgeleide**.
6. Testklok `19/05/2027 15:00` › vul de finale-uitslag in (bij gelijkspel: winnaar strafschoppen).
7. Zet de testklok terug op echte tijd.

**Seizoen afsluiten** niet testen in het testproject tenzij je daarna opnieuw wil beginnen: het maakt het volgende seizoen aan.
