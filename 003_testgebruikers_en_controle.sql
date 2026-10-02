-- =====================================================================
-- Schoolcup-portaal · SQL 003 · Testgebruikers koppelen en beveiliging controleren
-- Enkel in het testproject. Mag meerdere keren uitgevoerd worden.
--
-- VOORAF: maak in Supabase › Authentication › Users › Add user › Create new user
-- drie gebruikers aan (vink "Auto Confirm User" aan, wachtwoord naar keuze in de kluis):
--   beheer@schoolcup.test     (beheerder)
--   krinkel@schoolcup.test    (school De Krinkel)
--   laar@schoolcup.test       (school Het Laar)
-- Voer daarna dit volledige script uit. Onderaan verschijnt een tabel: elke regel moet OK zijn.
-- =====================================================================

insert into public.beheerders (user_id)
select id from auth.users where email = 'beheer@schoolcup.test'
on conflict do nothing;

insert into public.school_gebruikers (user_id, school_id)
select u.id, s.id from auth.users u join public.scholen s on lower(s.email) = lower(u.email)
where u.email in ('krinkel@schoolcup.test','laar@schoolcup.test')
on conflict do nothing;

drop table if exists pg_temp.controle;
create temp table controle (nr int, test text, resultaat text, detail text);
grant all on controle to anon, authenticated;

do $$
declare
  u_beheer uuid; u_k uuid; u_l uuid; s_k uuid; s_l uuid;
  p_k8 uuid; p_l8 uuid; sd1 int; n int; m int; fout text; spid uuid; i int;
begin
  select id into u_beheer from auth.users where email = 'beheer@schoolcup.test';
  select id into u_k from auth.users where email = 'krinkel@schoolcup.test';
  select id into u_l from auth.users where email = 'laar@schoolcup.test';
  if u_beheer is null or u_k is null or u_l is null then
    raise exception 'Maak eerst de drie testgebruikers aan in Authentication › Users (zie bovenaan dit script).';
  end if;
  select id into s_k from scholen where email = 'krinkel@schoolcup.test';
  select id into s_l from scholen where email = 'laar@schoolcup.test';
  select id into p_k8 from ploegen where school_id = s_k and categorie = 8;
  select id into p_l8 from ploegen where school_id = s_l and categorie = 8;
  select id into sd1 from speeldagen where seizoen = 2026 and code = '1';
  update instellingen set test_nu = '2026-10-15 10:00+02';   -- vóór alle deadlines

  -- ===== Als school De Krinkel =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_k, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from spelers;
  select count(*) into m from spelers s join ploegen p on p.id = s.ploeg_id where p.school_id = s_k;
  insert into controle values (1, 'School ziet enkel eigen spelers', case when n = m and n > 0 then 'OK' else 'FOUT' end, n || ' zichtbaar');

  select count(*) into n from scholen;
  insert into controle values (2, 'School ziet enkel eigen schoolgegevens', case when n = 1 then 'OK' else 'FOUT' end, n || ' school(s)');

  update spelers set voornaam = 'Gehackt' where ploeg_id = p_l8;
  get diagnostics n = row_count;
  insert into controle values (3, 'School kan spelers van andere school niet wijzigen', case when n = 0 then 'OK' else 'FOUT' end, n || ' gewijzigd');

  delete from spelers where ploeg_id = p_l8;
  get diagnostics n = row_count;
  insert into controle values (4, 'School kan spelers van andere school niet verwijderen', case when n = 0 then 'OK' else 'FOUT' end, n || ' verwijderd');

  begin
    insert into spelers (ploeg_id, voornaam, naam, geboortejaar, leerjaar) values (p_l8, 'TEST', 'Indringer', 2019, 2);
    insert into controle values (5, 'School kan geen speler bij andere school toevoegen', 'FOUT', 'toegevoegd');
  exception when others then insert into controle values (5, 'School kan geen speler bij andere school toevoegen', 'OK', sqlerrm); end;

  begin
    update scholen set status = 'afgewezen' where id = s_k;
    insert into controle values (6, 'School kan eigen status niet wijzigen', 'FOUT', 'gewijzigd');
  exception when others then insert into controle values (6, 'School kan eigen status niet wijzigen', 'OK', sqlerrm); end;

  begin
    insert into school_speeldag (school_id, speeldag_id, aanwezig) values (s_k, sd1, 'ja');
    insert into controle values (7, 'School kan aanwezigheid niet zelf registreren', 'FOUT', 'gelukt');
  exception when others then insert into controle values (7, 'School kan aanwezigheid niet zelf registreren', 'OK', sqlerrm); end;

  begin
    insert into spelers (ploeg_id, voornaam, naam, geboortejaar, leerjaar) values (p_k8, 'TEST', 'TeOud', 2017, 2);
    insert into controle values (8, 'Te oude speler wordt geweigerd (U10 in U8)', 'FOUT', 'toegevoegd');
  exception when others then insert into controle values (8, 'Te oude speler wordt geweigerd (U10 in U8)', 'OK', sqlerrm); end;

  begin
    select count(*) into n from spelers where ploeg_id = p_k8;
    for i in n + 1 .. 26 loop
      insert into spelers (ploeg_id, voornaam, naam, geboortejaar, leerjaar) values (p_k8, 'TEST', 'Speler' || i, 2019, 2);
    end loop;
    insert into controle values (9, 'Maximum 25 spelers per kern', 'FOUT', '26 spelers toegevoegd');
  exception when others then insert into controle values (9, 'Maximum 25 spelers per kern', 'OK', sqlerrm); end;

  insert into school_speeldag (school_id, speeldag_id, verantw_voornaam, verantw_naam, verantw_lo) values (s_k, sd1, 'TEST', 'Verantwoordelijke', true)
    on conflict (school_id, speeldag_id) do update set verantw_voornaam = 'TEST';
  insert into controle values (10, 'School kan verantwoordelijke invullen vóór de deadline', 'OK', 'ingevuld');

  begin
    for spid in select id from spelers where ploeg_id = p_k8 limit 9 loop
      insert into selecties (ploeg_id, speeldag_id, speler_id) values (p_k8, sd1, spid);
    end loop;
    insert into controle values (11, 'Maximum 8 spelers op het wedstrijdblad (5v5)', 'FOUT', '9 geselecteerd');
  exception when others then insert into controle values (11, 'Maximum 8 spelers op het wedstrijdblad (5v5)', 'OK', sqlerrm); end;

  -- ===== Tijd verzetten (als systeem) =====
  execute 'reset role';
  update instellingen set test_nu = '2026-11-05 09:00+01';  -- na ploegdeadline (4/11)
  execute 'set local role authenticated';
  begin
    delete from ploegen where id = p_k8;
    insert into controle values (12, 'Ploeg uitschrijven geweigerd na ploegdeadline', 'FOUT', 'uitgeschreven');
  exception when others then insert into controle values (12, 'Ploeg uitschrijven geweigerd na ploegdeadline', 'OK', sqlerrm); end;

  execute 'reset role';
  update instellingen set test_nu = '2026-11-12 09:00+01';  -- na kernbevriezing (11/11)
  delete from spelers where ploeg_id = p_k8 and voornaam = 'TEST';  -- opruimen als systeem
  execute 'set local role authenticated';
  begin
    delete from spelers where ploeg_id = p_k8;
    insert into controle values (13, 'Speler verwijderen geweigerd na kernbevriezing', 'FOUT', 'verwijderd');
  exception when others then insert into controle values (13, 'Speler verwijderen geweigerd na kernbevriezing', 'OK', sqlerrm); end;

  insert into spelers (ploeg_id, voornaam, naam, geboortejaar, leerjaar) values (p_k8, 'TEST', 'Aanvulling', 2019, 2) returning id into spid;
  select count(*) into n from spelers where id = spid and aangevuld_op is not null;
  insert into controle values (14, 'Aanvullen na bevriezing kan en wordt gemarkeerd', case when n = 1 then 'OK' else 'FOUT' end, '');

  execute 'reset role';
  update instellingen set test_nu = '2026-11-16 13:00+01';  -- na selectiedeadline speeldag 1 (16/11 12:00)
  execute 'set local role authenticated';
  begin
    update school_speeldag set verantw_naam = 'Te laat' where school_id = s_k and speeldag_id = sd1;
    insert into controle values (15, 'Wijzigen geweigerd na maandag 12:00', 'FOUT', 'gewijzigd');
  exception when others then insert into controle values (15, 'Wijzigen geweigerd na maandag 12:00', 'OK', sqlerrm); end;

  -- ===== Als bezoeker zonder login =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
  select count(*) into n from scholen;
  insert into controle values (16, 'Bezoeker ziet geen scholen', case when n = 0 then 'OK' else 'FOUT' end, n || ' zichtbaar');
  select count(*) into n from spelers;
  insert into controle values (17, 'Bezoeker ziet geen spelers', case when n = 0 then 'OK' else 'FOUT' end, n || ' zichtbaar');
  insert into scholen (naam, email, status) values ('TEST Aanvraagschool', 'test-aanvraag@schoolcup.test', 'actief');
  execute 'reset role';
  select count(*) into n from scholen where email = 'test-aanvraag@schoolcup.test' and status = 'aanvraag';
  insert into controle values (18, 'Aanvraag zonder login kan, maar altijd als "aanvraag"', case when n = 1 then 'OK' else 'FOUT' end, '');

  -- ===== Als beheerder =====
  perform set_config('request.jwt.claims', json_build_object('sub', u_beheer, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from spelers;
  execute 'reset role';
  select count(*) into m from spelers;
  insert into controle values (19, 'Beheerder ziet alle spelers', case when n = m then 'OK' else 'FOUT' end, n || ' van ' || m);

  -- ===== Opruimen =====
  delete from scholen where email = 'test-aanvraag@schoolcup.test';
  delete from selecties where ploeg_id = p_k8 and speeldag_id = sd1;
  delete from school_speeldag where school_id = s_k and speeldag_id = sd1;
  delete from spelers where voornaam = 'TEST';
  update instellingen set test_nu = null;
end $$;

select nr, test, resultaat, detail from controle order by nr;
