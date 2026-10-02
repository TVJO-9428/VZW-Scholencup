# Fase 7 – Live gaan: draaiboek

Doel: een **apart productieproject** zonder testgegevens. Het testproject blijft bestaan om later wijzigingen te proberen.

## A. Vooraf beslissen (bestuur)
- [ ] Akkoord bestuur en privacyverantwoordelijke (namen en geboortejaren van kinderen, clubregels, beeldregeling).
- [ ] Supabase-abonnement voor productie: **Pro** aanbevolen (geen pauze, dagelijkse back-ups).
- [ ] Wie zijn de beheerders (minstens twee, met clubadressen)?
- [ ] Verwerkersovereenkomsten (DPA) van Supabase, Resend en Cloudflare downloaden en bewaren bij de club.

## B. Domein en mail
- [ ] Domein geverifieerd in Resend (DNS-records bij de registrar).
- [ ] Optioneel: subdomein `schoolcup.verbroederingzwijndrecht.be`. Een eigen domein op een Cloudflare Worker vraagt dat de DNS van het clubdomein bij Cloudflare beheerd wordt; bespreek dat met de DNS-beheerder. Anders blijft het workers.dev-adres.

## C. Productieproject in Supabase
- [ ] Nieuw project `schoolcup-prod`, regio EU, sterk databasewachtwoord in de kluis.
- [ ] SQL Editor, in deze volgorde: `001`, `004`, `005`, `006`, `009_kalender_productie`. **Niet** 002, 003 of 008.
- [ ] Authentication › Users: de beheerders aanmaken (Auto Confirm), daarna:
  `insert into public.beheerders (user_id) select id from auth.users where email in ('tvjo@…','…');`
- [ ] Authentication-instellingen zoals in fase 2: sign-ups uit, URL Configuration, SMTP via Resend, beide mailsjablonen.
- [ ] Edge Functions `aanvraag`, `beheer`, `meldingen` (Verify JWT uit bij alle drie) en 6 secrets:
  RESEND_API_KEY, MAIL_FROM, MAIL_REPLY_TO, BEHEER_EMAIL, SITE_URL, CRON_SECRET.
- [ ] `007_dagelijkse_herinneringen.sql` met de PROJECTREF van **productie**.
- [ ] Security Advisor bekijken (Advisors): enkel de bewuste waarschuwing over het aanvraagformulier mag overblijven.

## D. Website omschakelen
- [ ] `js/config.js` in GitHub: URL en publishable key van **productie**. Commit.
- [ ] `.github/workflows/supabase-actief.yml`: verwijderen bij Pro, of de URL/sleutel aanpassen naar productie.
- [ ] Bij Cloudflare › het Worker-project: controleer dat de nieuwe versie gepubliceerd is.

## E. Generale repetitie
- [ ] Met één bevriende school (of een eigen adres): aanvraag → goedkeuring → wachtwoord → ploegen → kern met **fictieve** kinderen → speeldag invullen.
- [ ] Beheer › Instellingen › Proef herinneringen.
- [ ] Die testschool daarna verwijderen: Table Editor › scholen › rij verwijderen (ploegen en spelers verdwijnen mee).
- [ ] Testklok staat op **echte tijd**.

## F. Lancering
- [ ] Link `…/aanvraag.html` en het reglement `…/reglement.html` naar de directies, samen met het draaiboek.
- [ ] Opvolgen: Beheer › Aanvragen (goedkeuren), Beheer › Scholen.
- [ ] Twee weken voor speeldag 1: ploegen liggen vast → Beheer › Planning › speelschema genereren.

## G. Tijdens en na het seizoen
- Speeldag: Aanwezigheid registreren, uitslagen invullen.
- Na speeldag 3: Finale › finalisten vastleggen en mailen.
- Na de finale: Instellingen › **Seizoen afsluiten** (titelverdedigers, nieuwe kalender, spelerslijsten wissen).
- Jaarlijks: beheerders en toegang nakijken, wachtwoorden in de kluis bijwerken.
