-- =====================================================================
-- Schoolcup-portaal · SQL 002 · Kalender en FICTIEVE testdata
-- Enkel in het testproject (schoolcup-dev) uitvoeren, nooit in productie.
-- Alle kindernamen zijn verzonnen.
-- =====================================================================

-- Kalender seizoen 2026–2027
insert into public.speeldagen (seizoen, code, datum) values
  (2026,'1','2026-11-18'), (2026,'2','2027-01-20'), (2026,'3','2027-03-17'), (2026,'F','2027-05-19');

-- Standaardplanning per speeldag en categorie
insert into public.dagplanning (speeldag_id, categorie, minuten_helft, rust)
select s.id, c, case when c <= 9 then 12 else 15 end, case when s.code = 'F' then 5 else 2 end
from public.speeldagen s cross join unnest(array[8,9,10,11,12]::smallint[]) c
where s.seizoen = 2026;

-- Scholen (fictieve contactgegevens)
insert into public.scholen (naam, gemeente, contact_voornaam, contact_naam, email, status, ploegen_bevestigd) values
  ('De Krinkel',       'Zwijndrecht', 'Lotte',  'Peeters',  'krinkel@schoolcup.test',     'actief', true),
  ('Het Laar',         'Zwijndrecht', 'Noah',   'Janssens', 'laar@schoolcup.test',        'actief', true),
  ('Simabu',           'Burcht',      'Emma',   'Maes',     'simabu@schoolcup.test',      'actief', true),
  ('De Dobbelsteen',   'Zwijndrecht', 'Lucas',  'Jacobs',   'dobbelsteen@schoolcup.test', 'actief', false),
  ('Sint-Anna Goethe', 'Zwijndrecht', 'Olivia', 'Mertens',  'annagoethe@schoolcup.test',  'actief', false);
insert into public.scholen (naam, gemeente, contact_voornaam, contact_naam, email, status, gewenste_ploegen) values
  ('De Zonnebloem', 'Burcht', 'Sofie', 'Wuyts', 'zonnebloem@schoolcup.test', 'aanvraag', '{10,11,12}');

-- Ploegen (Sint-Anna Goethe nog zonder ploegen, De Dobbelsteen zonder U12)
insert into public.ploegen (school_id, seizoen, categorie)
select s.id, 2026, c
from public.scholen s cross join unnest(array[8,9,10,11,12]::smallint[]) c
where s.status = 'actief'
  and s.naam not in ('Sint-Anna Goethe')
  and not (s.naam = 'De Dobbelsteen' and c = 12);

-- Spelers: 10 tot 15 per ploeg, verzonnen namen
insert into public.spelers (ploeg_id, voornaam, naam, geboortejaar, leerjaar)
select p.id,
  (array['Lotte','Noah','Emma','Lucas','Olivia','Liam','Louise','Arthur','Mila','Jules','Nora','Finn','Lina','Victor','Ella','Mats','Juliette','Vic','Marie','Lars','Fien','Seppe','Hanne','Wout','Zoë','Kobe','Amber','Milan','Lien','Rayan'])[1 + abs(hashtext(p.id::text || g::text || 'v')) % 30],
  (array['Peeters','Janssens','Maes','Jacobs','Mertens','Willems','Claes','Goossens','Wouters','De Smet','Dubois','Lambert','Dupont','Hermans','Van den Broeck','Aerts','Vermeulen','Pauwels','Smets','Verhoeven'])[1 + abs(hashtext(p.id::text || g::text || 'n')) % 20],
  (p.seizoen + 1 - p.categorie)::smallint,
  (p.categorie - 6)::smallint
from public.ploegen p
cross join lateral generate_series(1, 10 + abs(hashtext(p.id::text)) % 6) g;

select 'Testdata geladen' as resultaat,
  (select count(*) from public.scholen)  as scholen,
  (select count(*) from public.ploegen)  as ploegen,
  (select count(*) from public.spelers)  as spelers;
