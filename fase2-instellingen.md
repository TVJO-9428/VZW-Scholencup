# Fase 2 – instellingen stap voor stap

Vervang overal `https://JOUW-SITE.netlify.app` door je eigen Netlify-adres (zonder schuine streep op het einde)
en `schoolcup@CLUBDOMEIN` door het afzenderadres op je geverifieerde Resend-domein.

## A. Bestanden in GitHub
Upload de inhoud van het pakket (Add file › Upload files). `js/config.js` zit er bewust NIET in: jouw ingevulde versie blijft staan.

## B. Resend-sleutel
Resend › API Keys › Create API Key › naam "supabase-schoolcup", permission **Sending access** › kopieer de sleutel.
Je plakt hem op twee plaatsen in Supabase (C3 en D3) en nergens anders. Daarna hoef je hem niet te bewaren.

## C. Supabase › Authentication
1. **Sign In / Providers** (of Settings): Email aan, **Allow new users to sign up: UIT** (enkel uitgenodigde scholen), Confirm email aan, minimum wachtwoordlengte 8.
2. **URL Configuration**: Site URL = `https://JOUW-SITE.netlify.app` · Redirect URLs: voeg `https://JOUW-SITE.netlify.app/**` toe.
3. **Emails › SMTP Settings**: Enable custom SMTP aan
   - Sender email: `schoolcup@CLUBDOMEIN` · Sender name: `Verbroedering Schoolcup`
   - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: de Resend-sleutel
4. **Emails › Templates**
   - *Invite user*: onderwerp "Je account voor de Verbroedering Schoolcup", inhoud = `supabase/email-sjablonen/uitnodiging.html`
   - *Reset password*: onderwerp "Nieuw wachtwoord voor het Schoolcup-portaal", inhoud = `supabase/email-sjablonen/wachtwoord-herstellen.html`

## D. Supabase › Edge Functions
1. **Deploy a new function › Via Editor**, naam `aanvraag`, plak `supabase/functions/aanvraag/index.ts`, Deploy.
2. Idem met naam `beheer` en `supabase/functions/beheer/index.ts`.
3. **Secrets** (Edge Functions › Secrets) – vijf stuks:
   | Naam | Waarde |
   |---|---|
   | RESEND_API_KEY | de Resend-sleutel |
   | MAIL_FROM | `Verbroedering Schoolcup <schoolcup@CLUBDOMEIN>` |
   | MAIL_REPLY_TO | het bestaande clubadres dat jullie lezen |
   | BEHEER_EMAIL | waar jij nieuwe aanvragen wil ontvangen |
   | SITE_URL | `https://JOUW-SITE.netlify.app` |
4. Bij **elke** functie › Details/Settings: **Enforce JWT verification (Verify JWT): UIT**. De functie `beheer` controleert zelf of je beheerder bent.

## E. Testen
1. Open `https://JOUW-SITE.netlify.app/aanvraag.html` en vraag aan met een fictieve school en een e-mailadres dat jij leest
   (tip: `jouwnaam+school1@...` werkt bij de meeste mailboxen als apart adres).
2. Je ontvangt "aanvraag ontvangen"; op BEHEER_EMAIL komt "nieuwe aanvraag".
3. Meld aan op de site met `beheer@schoolcup.test` › Goedkeuren en uitnodigen.
4. Uitnodigingsmail openen › wachtwoord kiezen › je komt in het portaal met de naam van je fictieve school.
5. Afmelden › "Wachtwoord vergeten?" › mail › nieuw wachtwoord › aanmelden.
6. Test ook: Afwijzen (tweede aanvraag), en "Nieuwe aanmeldlink sturen".

Lukt iets niet: Supabase › Edge Functions › (functie) › **Logs** toont de foutmelding. Kopieer die (zonder sleutels) in de chat.
