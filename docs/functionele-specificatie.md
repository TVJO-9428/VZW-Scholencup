# Functionele specificatie – Schoolcup-portaal

Seizoen 2026–2027. Alle datums zijn instelbaar per seizoen; de waarden hieronder zijn de startwaarden.

## 1. Rollen
- **Bezoeker**: kan deelname aanvragen en het reglement lezen.
- **School**: één login per school (het e-mailadres uit de aanvraag). Beheert enkel eigen gegevens.
- **Beheerder**: TVJO en een tweede beheerder van de club. Ziet en beheert alles.

## 2. Kalender
- Speeldagen: derde woensdag van september, november, januari en maart. Dit seizoen: 18/11/2026, 20/01/2027, 17/03/2027 (september is voorbij).
- Finaledag: derde woensdag van mei: 19/05/2027.
- Uitwijkdatum bij onbespeelbaar terrein: vierde woensdag van dezelfde maand.

## 3. Categorieën
| Categorie | Geboortejaar 26–27 | Gewoonlijk | Format | Max. wedstrijdblad | Standaard speelduur |
|---|---|---|---|---|---|
| U8 | 2019 | 2de leerjaar | 5v5 | 8 | 2 × 12' |
| U9 | 2018 | 3de leerjaar | 5v5 | 8 | 2 × 12' |
| U10 | 2017 | 4de leerjaar | 8v8 | 12 | 2 × 15' |
| U11 | 2016 | 5de leerjaar | 8v8 | 12 | 2 × 15' |
| U12 | 2015 | 6de leerjaar | 8v8 | 12 | 2 × 15' |

- Categorie = (eindjaar seizoen) − geboortejaar.
- Een kind mag hoger spelen, nooit lager. U13 (geboren 2014 of vroeger) valt buiten de Schoolcup.
- Gemengde ploegen.

## 4. Aanvraag en account
1. Bezoeker vult aanvraag in: schoolnaam, gemeente, voornaam + naam contactpersoon, e-mail, gewenste ploegen. Tekst: met de inschrijving gaan school en spelers akkoord met de clubregels en de beeldregeling van de club (zie website). **Geen apart vinkje of vraag over beeld.**
2. Mail naar de school (aanvraag ontvangen) en naar de beheerder (nieuwe aanvraag).
3. Beheerder keurt goed of wijst af. Bij goedkeuring: account aanmaken + mail met login-link (wachtwoord zelf kiezen via uitnodiging) en de takenlijst.

## 5. Ploegen
- Per school per categorie maximaal één ploeg.
- Ploegen in- en uitschrijven tot **twee weken voor speeldag 1** (04/11/2026). Daarna enkel via de beheerder.
- Uitschrijven verwijdert de kern van die ploeg (na bevestiging).
- School bevestigt haar ploegen (knop) → bevestigingsmail.

## 6. Spelerskern
- Max. 25 spelers per ploeg: voornaam, naam, geboortejaar, leerjaar.
- Controle speelrecht bij invoer (zie §3).
- **Bevriezing één week voor speeldag 1** (11/11/2026). Daarna: bestaande spelers niet meer wijzigen of verwijderen; aanvullen tot 25 mag nog, maar een aanvulling is definitief (markeren met datum).

## 7. Per speeldag (school)
In te vullen tot **maandag 12:00 voor de speeldag**, daarna bevroren:
- **Verantwoordelijke** van de school (voornaam, naam, vinkje leerkracht LO). Bij voorkeur de leerkracht LO; zorgt voor orde, netheid, discipline.
- **Coaches**: 1 of 2 per ploeg (voornaam, naam, rol: leerkracht/ouder/familie). Oudercomité kan helpen.
  - Heeft **precies één** ploeg die dag geen coach en is de verantwoordelijke ingevuld, dan wordt de verantwoordelijke automatisch coach van die ploeg.
  - Hebben **meerdere** ploegen geen coach, dan krijgt de school een taak per ploeg.
- **Selectie** voor het wedstrijdblad uit de kern: max. 8 (5v5) of 12 (8v8). Enkel speelgerechtigde spelers.

## 8. Aanwezigheid en joker (beheerder registreert op de dag)
- Verantwoordelijke aanwezig of afwezig.
- Elke school heeft **één joker**: eerste afwezigheid op een competitiespeeldag (waarop de school speelt) zonder gevolg.
- Tweede afwezigheid: alle wedstrijden van die school die dag **forfait 0–5**. Beide afwezig: dubbel forfait (beiden verlies, 0–5).
- **Geen joker op de finaledag**: afwezig = finale verloren met forfait.

## 9. Competitie
- Per categorie één reeks met alle ingeschreven scholen; dubbele competitie (elke ploeg 2× tegen elke andere).
- Wedstrijden verdeeld over de speeldagen: zoveel mogelijk 2 per ploeg per dag, nooit 2× dezelfde tegenstander op één dag, zo weinig mogelijk wedstrijden na elkaar (algoritme: zie prototype, functies `verdeelOverDagen` en `ordenDag`).
- **Puntentelling**: winst 3, gelijk 1, verlies 0. Forfait = 0–5.
- **Gelijke punten**, in deze volgorde: 1) meeste overwinningen, 2) doelsaldo, 3) meeste gemaakte doelpunten, 4) onderling resultaat, 5) loting door de TVJO.

## 10. Planning per speeldag (beheerder)
Per speeldag en categorie instelbaar: start, uiterlijk einde, minuten per helft, rust, wisseltijd, aantal velden (1–4), rondes klassementswedstrijden (0–2).
- Herberekenen wijzigt enkel uren en velden van de wedstrijden van die dag.
- **Klassementswedstrijden** enkel op de speeldag waarop de dubbele competitie rond is: nr. 1 – nr. 2, nr. 3 – nr. 4 volgens de stand na de reguliere wedstrijden; ploegen worden ingevuld zodra alle reguliere uitslagen er zijn. Ze tellen mee voor het klassement.
- Scholen zien aanpassingen meteen (melding bij Schema en Speeldag) en krijgen een mail.
- Het reglement toont per speeldag de actuele speelduur.

## 11. Finale
- Na de laatste speeldag zijn de nummers 1 en 2 van elke reeks finalist. **Enkel zij** zien de finalepagina, en enkel voor hun geplaatste ploegen.
- Finalisten vullen selectie, verantwoordelijke en coach in vóór **één week voor de finale, 12:00** (12/05/2027).
- Niet ingevuld → de **nummer 3 krijgt een vrijgeleide** (vallen beide weg, ook de nummer 4). De vervanger vult in tot maandag 12:00 voor de finale.
- Finaleplanning (beheerder): eerste aftrap, velden, rust, tijd voor strafschoppen, wisseltijd, minuten per helft per categorie. Finales in volgorde U8 → U12 over de velden verdeeld. Bevestigen stuurt mails.
- Gelijkspel: 5 strafschoppen, daarna één tegen één.

## 12. Prijzen
- Wisselbeker per reeks; blijft een jaar in de klas; de winnende school is het volgende seizoen automatisch ingeschreven in dezelfde categorie als titelverdediger.
- Aandenken voor elke speler in de kern (beheerder ziet het totaal).

## 13. Mails
| Wanneer | Aan |
|---|---|
| Aanvraag ontvangen | school + beheerder |
| Goedkeuring (uitnodiging + takenlijst) / afwijzing | school |
| Ploegen bevestigd | school |
| Herinnering: één week voor kernbevriezing, vrijdag voor selectiedeadline (enkel als er taken openstaan) | school |
| Planning speeldag of finale aangepast | betrokken scholen |

## 14. Schermen (zie prototype)
- School: Overzicht (takenlijst, data, volgende speeldag, kernen, klassement, joker), Ploegen inschrijven, Spelerskern, Speeldag (incl. Finale voor finalisten), Schema & klassement, Reglement & afspraken, Schoolgegevens.
- Beheerder: Aanvragen, Scholen, Aanwezigheid, Planning per speeldag (incl. Finale), Uitslagen, Klassementen (+ finalestatus), Reglement & afspraken.
- Reglement & afspraken is ook zonder login leesbaar.

## 15. Privacy
- Gegevens van kinderen: enkel wat in §6 staat. Na het seizoen en de verzekeringstermijn verwijderen (beheerdersknop "seizoen afsluiten").
- Supabase-project in de EU; verwerkersovereenkomsten van Supabase en Resend bewaren bij de club.
