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
- [ ] **0 – Basis**: startpagina in huisstijl, verbinding met Supabase, Netlify gekoppeld.
- [ ] **1 – Database en beveiliging**: tabellen, Row Level Security, deadlines in de database, fictieve testdata, controlequery's die bewijzen dat scholen elkaars gegevens niet zien.
- [ ] **2 – Aanvraag, goedkeuring, aanmelden**: aanvraagformulier, login, wachtwoord vergeten, beheerder keurt goed, mails via Resend.
- [ ] **3 – School**: overzicht, ploegen, kern, speeldag, schoolgegevens.
- [ ] **4 – Beheer**: scholen, planning per speeldag, aanwezigheid/joker, uitslagen, klassementen.
- [ ] **5 – Finale**: finalisten, vrijgeleide, finaleplanning.
- [ ] **6 – Mails, reglement, afwerking**: herinneringen, reglementpagina, gsm-weergave.
- [ ] **7 – Live**: productieproject, clubsubdomein, beveiligingscontrole, back-ups.
