# Werkplan – Schoolcup-portaal (werkwijze zonder Claude Code)

Claude (in de chat) schrijft per fase de bestanden. Tom zet ze in GitHub via de browser, voert SQL uit in Supabase en test via de Netlify-link.

Vaste werkwijze per fase:
1. Claude levert een zip met nieuwe of gewijzigde bestanden + eventueel een SQL-bestand.
2. Bestanden: GitHub › repository › *Add file › Upload files* › map-inhoud erin slepen › *Commit changes*. Bestaande bestanden met dezelfde naam worden overschreven.
3. SQL: Supabase › *SQL Editor* › *New query* › inhoud van het SQL-bestand plakken › *Run*. Elke SQL heeft een volgnummer; nooit overslaan of twee keer uitvoeren.
4. Netlify publiceert automatisch binnen een minuut. Testen met de checklist.
5. Resultaat of foutmelding terugmelden in de chat (nooit sleutels of wachtwoorden plakken).

Technische keuze: gewone HTML/CSS/JavaScript zonder build-stap, supabase-js via CDN, Edge Functions via de editor in het Supabase-dashboard.

## Fases
- [x] **0 – Basis**: startpagina in huisstijl, verbinding met Supabase, Netlify gekoppeld.
- [x] **1 – Database en beveiliging**: tabellen, Row Level Security, deadlines in de database, fictieve testdata, controlequery's die bewijzen dat scholen elkaars gegevens niet zien.
- [x] **2 – Aanvraag, goedkeuring, aanmelden** (mails wachten op Resend-domeinverificatie): aanvraagformulier, login, wachtwoord vergeten, beheerder keurt goed, mails via Resend.
- [x] **3 – School** (te testen): overzicht, ploegen, kern, speeldag, schoolgegevens.
- [x] **4 – Beheer** (te testen): scholen, planning per speeldag, aanwezigheid/joker, uitslagen, klassementen.
- [x] **5 – Finale** (te testen): finalisten, vrijgeleide, finaleplanning.
- [x] **6 – Mails, reglement, afwerking** (te testen; mails na Resend-verificatie): herinneringen, reglementpagina, gsm-weergave.
- [ ] **7 – Live** (draaiboek: docs/fase7-live.md): productieproject, clubsubdomein, beveiligingscontrole, back-ups.

## Fase 1 – uitvoeren
SQL-bestanden in de map `supabase/`, telkens in Supabase › SQL Editor › New query › plakken › Run:
1. `001_database_en_beveiliging.sql` – één keer.
2. `002_fictieve_testdata.sql` – één keer, enkel in schoolcup-dev.
3. Drie testgebruikers aanmaken in Authentication › Users (zie bovenaan 003).
4. `003_testgebruikers_en_controle.sql` – mag herhaald worden; alle 19 regels moeten OK zijn.

## Fase 2 – uitvoeren
Zie `docs/fase2-instellingen.md`.

## Fase 3 en 4 – uitvoeren
Zie `docs/fase3-4-testen.md`. Hosting is verhuisd naar Cloudflare (workers.dev).

## Fase 5 en 6 – uitvoeren
Zie `docs/fase5-6-instellen.md`.

## Fase 7
Zie `docs/fase7-live.md`.
