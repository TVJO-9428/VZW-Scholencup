# Fase 3 en 4 – installeren en testen

## 1. Database (één keer)
Supabase › SQL Editor › New query › plak `supabase/004_fase3_4.sql` › Run → "SQL 004 uitgevoerd".

## 2. Bestanden (één upload = één publicatie)
GitHub › Add file › Upload files › sleep uit de uitgepakte map in één keer:
de mappen `css`, `js`, `supabase`, `docs` en de bestanden `index.html`, `portaal.html`, `reglement.html`.
`js/config.js` zit er niet in en blijft dus staan. Commit changes. Cloudflare publiceert automatisch.

## 3. Testen als beheerder (tvjo-adres)
1. **Planning** › "Volledig speelschema (opnieuw) genereren". Per speeldag zie je per categorie de wedstrijden met uur en veld.
2. Pas bij Speeldag 1 voor U8 bv. het aantal velden aan › Opslaan en herberekenen. De uren veranderen.
3. **Scholen**: klik op een getal om een ploeg uit/in te schrijven; "Bewerken" om naam of contact aan te passen.
4. **Instellingen** › Testklok › zet bv. `18/11/2026 14:00` › Testdatum instellen.
5. **Aanwezigheid** › Speeldag 1 › zet een school op "afwezig" (joker), en op Speeldag 2 nog eens (forfait).
6. **Uitslagen** › vul scores in. **Klassementen** toont de stand met forfaits.
7. Instellingen › **Terug naar echte tijd**.

## 4. Testen als school
Meld af en meld aan met `krinkel@schoolcup.test` (wachtwoord uit fase 1, in de kluis).
1. **Overzicht**: takenlijst, data, volgende speeldag, kernen, klassement, joker.
2. **Ploegen inschrijven**, **Spelerskern** (toevoegen, verwijderen), **Speeldag** (verantwoordelijke, coaches, selectie), **Schema & klassement**, **Schoolgegevens**.
3. Testklok (als beheerder) op `12/11/2026 09:00` → als school: spelers verwijderen lukt niet meer, aanvullen wel (definitief).
4. Testklok op `16/11/2026 13:00` → speeldag 1 is bevroren.
Zet de testklok altijd terug naar echte tijd na het testen.

Foutmelding? Kopieer de rode tekst (zonder sleutels) in de chat.
