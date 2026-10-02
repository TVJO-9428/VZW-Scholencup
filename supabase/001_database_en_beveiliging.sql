-- =====================================================================
-- Schoolcup-portaal · SQL 001 · Database en beveiliging
-- Eén keer uitvoeren in Supabase › SQL Editor › New query › Run.
-- Maakt alle tabellen, de toegangsregels (Row Level Security) en de
-- controles op deadlines en limieten. Bevat GEEN persoonsgegevens.
-- =====================================================================

-- ---------- 1. Algemene instellingen en tijd ----------
create table public.instellingen (
  id       boolean primary key default true check (id),
  seizoen  smallint not null default 2026,           -- 2026 = seizoen 2026–2027
  test_nu  timestamptz                                -- enkel om te testen: gesimuleerde datum (leeg = echte tijd)
);
insert into public.instellingen default values;
comment on column public.instellingen.test_nu is 'Enkel in de testomgeving gebruiken. In productie altijd leeg.';

-- Huidige tijd (of de testdatum)
create function public.nu() returns timestamptz
language sql stable security definer set search_path = public as
$$ select coalesce((select test_nu from instellingen), now()) $$;

-- ---------- 2. Scholen en gebruikers ----------
create table public.scholen (
  id                 uuid primary key default gen_random_uuid(),
  naam               text not null check (length(trim(naam)) > 1),
  gemeente           text,
  contact_voornaam   text,
  contact_naam       text,
  email              text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  status             text not null default 'aanvraag' check (status in ('aanvraag','actief','afgewezen')),
  gewenste_ploegen   smallint[] not null default '{}',
  ploegen_bevestigd  boolean not null default false,
  aangevraagd_op     timestamptz not null default now()
);

create table public.beheerders (
  user_id uuid primary key references auth.users on delete cascade
);

create table public.school_gebruikers (
  user_id   uuid primary key references auth.users on delete cascade,
  school_id uuid not null references public.scholen on delete cascade
);

create function public.is_beheerder() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from beheerders where user_id = auth.uid()) $$;

create function public.mijn_school() returns uuid
language sql stable security definer set search_path = public as
$$ select school_id from school_gebruikers where user_id = auth.uid() $$;

-- Volledige toegang voor beheerders en voor het systeem zelf (SQL Editor, Edge Functions),
-- nooit voor gewone bezoekers of scholen.
create function public.vrije_toegang() returns boolean
language sql stable set search_path = public as
$$ select public.is_beheerder() or current_user not in ('anon','authenticated') $$;

-- ---------- 3. Kalender ----------
create table public.speeldagen (
  id       serial primary key,
  seizoen  smallint not null,
  code     text not null check (code in ('1','2','3','F')),   -- F = finaledag
  datum    date not null,
  unique (seizoen, code)
);

create function public.ploeg_deadline(p_seizoen smallint) returns timestamptz
language sql stable security definer set search_path = public as
$$ select ((datum - 14)::timestamp) at time zone 'Europe/Brussels' from speeldagen where seizoen = p_seizoen and code = '1' $$;

create function public.kern_bevriezing(p_seizoen smallint) returns timestamptz
language sql stable security definer set search_path = public as
$$ select ((datum - 7)::timestamp) at time zone 'Europe/Brussels' from speeldagen where seizoen = p_seizoen and code = '1' $$;

-- Selectie, verantwoordelijke en coaches: tot maandag 12:00 (finale: één week vooraf 12:00)
create function public.selectie_deadline(p_speeldag int) returns timestamptz
language sql stable security definer set search_path = public as
$$ select ((datum - case code when 'F' then 7 else 2 end)::timestamp + time '12:00') at time zone 'Europe/Brussels'
   from speeldagen where id = p_speeldag $$;

create function public.max_wedstrijdblad(p_categorie smallint) returns smallint
language sql immutable set search_path = public as $$ select (case when p_categorie <= 9 then 8 else 12 end)::smallint $$;

-- ---------- 4. Ploegen en spelers ----------
create table public.ploegen (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.scholen on delete cascade,
  seizoen     smallint not null,
  categorie   smallint not null check (categorie between 8 and 12),
  aangemaakt_op timestamptz not null default now(),
  unique (school_id, seizoen, categorie)
);

create table public.spelers (
  id            uuid primary key default gen_random_uuid(),
  ploeg_id      uuid not null references public.ploegen on delete cascade,
  voornaam      text not null check (length(trim(voornaam)) > 0),
  naam          text not null check (length(trim(naam)) > 0),
  geboortejaar  smallint not null,
  leerjaar      smallint check (leerjaar between 1 and 6),
  aangevuld_op  date,                       -- ingevuld bij definitieve aanvulling na de bevriezing
  aangemaakt_op timestamptz not null default now()
);
create index on public.spelers (ploeg_id);

-- ---------- 5. Per speeldag ----------
create table public.school_speeldag (
  school_id         uuid not null references public.scholen on delete cascade,
  speeldag_id       int  not null references public.speeldagen on delete cascade,
  verantw_voornaam  text,
  verantw_naam      text,
  verantw_lo        boolean not null default false,
  aanwezig          text check (aanwezig in ('ja','nee')),     -- enkel door de beheerder
  primary key (school_id, speeldag_id)
);

create table public.coaches (
  ploeg_id     uuid not null references public.ploegen on delete cascade,
  speeldag_id  int  not null references public.speeldagen on delete cascade,
  volgnr       smallint not null check (volgnr in (1,2)),
  voornaam     text not null check (length(trim(voornaam)) > 0),
  naam         text not null check (length(trim(naam)) > 0),
  rol          text not null check (rol in ('leerkracht','ouder','familie')),
  primary key (ploeg_id, speeldag_id, volgnr)
);

create table public.selecties (
  ploeg_id     uuid not null references public.ploegen on delete cascade,
  speeldag_id  int  not null references public.speeldagen on delete cascade,
  speler_id    uuid not null references public.spelers on delete cascade,
  primary key (ploeg_id, speeldag_id, speler_id)
);

-- ---------- 6. Planning en wedstrijden (beheerder) ----------
create table public.dagplanning (
  speeldag_id     int not null references public.speeldagen on delete cascade,
  categorie       smallint not null check (categorie between 8 and 12),
  start           time not null default '13:30',
  eind            time not null default '17:00',
  minuten_helft   smallint not null default 12 check (minuten_helft between 5 and 30),
  rust            smallint not null default 2  check (rust between 0 and 15),
  wissel          smallint not null default 5  check (wissel between 0 and 30),
  velden          smallint not null default 1  check (velden between 1 and 4),
  extra_rondes    smallint not null default 0  check (extra_rondes between 0 and 2),
  strafschop_min  smallint not null default 5  check (strafschop_min between 0 and 15),
  gewijzigd_op    timestamptz,
  primary key (speeldag_id, categorie)
);

create table public.wedstrijden (
  id               uuid primary key default gen_random_uuid(),
  speeldag_id      int not null references public.speeldagen on delete cascade,
  categorie        smallint not null check (categorie between 8 and 12),
  thuis_ploeg_id   uuid references public.ploegen on delete cascade,   -- leeg bij klassementswedstrijd tot de stand gekend is
  uit_ploeg_id     uuid references public.ploegen on delete cascade,
  ronde            smallint,                                           -- 1 = heen, 2 = terug
  klassement       boolean not null default false,                     -- extra klassementswedstrijd
  rang_thuis       smallint, rang_uit smallint,                        -- bv. 1 en 2
  aftrap           time, veld text, slot smallint,
  doelpunten_thuis smallint check (doelpunten_thuis >= 0),
  doelpunten_uit   smallint check (doelpunten_uit >= 0)
);
create index on public.wedstrijden (speeldag_id, categorie);

-- ---------- 7. Controles (triggers) ----------
-- Scholen: een school kan enkel haar contactgegevens en bevestiging wijzigen.
create function public.trg_scholen() returns trigger language plpgsql set search_path = public as $$
begin
  if public.vrije_toegang() then return new; end if;
  if tg_op = 'INSERT' then
    new.status := 'aanvraag'; new.ploegen_bevestigd := false; new.aangevraagd_op := now();
    return new;
  end if;
  if new.status is distinct from old.status or new.email is distinct from old.email
     or new.naam is distinct from old.naam or new.gewenste_ploegen is distinct from old.gewenste_ploegen then
    raise exception 'Deze gegevens kan enkel de beheerder wijzigen.';
  end if;
  return new;
end $$;
create trigger scholen_controle before insert or update on public.scholen
  for each row execute function public.trg_scholen();

-- Ploegen: in- en uitschrijven tot twee weken voor speeldag 1, enkel voor actieve scholen.
create function public.trg_ploegen() returns trigger language plpgsql set search_path = public as $$
declare r record;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  if not public.vrije_toegang() then
    if public.nu() >= public.ploeg_deadline(r.seizoen) then
      raise exception 'Ploegen aanpassen kan niet meer: de deadline was %.', to_char(public.ploeg_deadline(r.seizoen) at time zone 'Europe/Brussels','DD/MM/YYYY');
    end if;
    if tg_op = 'INSERT' and not exists (select 1 from scholen where id = new.school_id and status = 'actief') then
      raise exception 'Enkel goedgekeurde scholen kunnen ploegen inschrijven.';
    end if;
    if tg_op = 'UPDATE' then raise exception 'Een ploeg kan niet gewijzigd worden; schrijf uit en opnieuw in.'; end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger ploegen_controle before insert or update or delete on public.ploegen
  for each row execute function public.trg_ploegen();

-- Spelers: speelrecht, max. 25, bevriezing van de kern.
create function public.trg_spelers() returns trigger language plpgsql set search_path = public as $$
declare p record; pc int;
begin
  if tg_op in ('INSERT','UPDATE') then
    select seizoen, categorie into p from ploegen where id = new.ploeg_id;
    pc := (p.seizoen + 1) - new.geboortejaar;
    if pc > 12 then raise exception '% % (°%) is U% en valt buiten de Schoolcup.', new.voornaam, new.naam, new.geboortejaar, pc; end if;
    if pc > p.categorie then raise exception '% % (°%) is U% en mag niet in U% spelen (lager spelen mag niet).', new.voornaam, new.naam, new.geboortejaar, pc, p.categorie; end if;
    if tg_op = 'INSERT' and (select count(*) from spelers where ploeg_id = new.ploeg_id) >= 25 then
      raise exception 'De kern telt al 25 spelers.';
    end if;
  else
    select seizoen, categorie into p from ploegen where id = old.ploeg_id;
  end if;

  if not public.vrije_toegang() and public.nu() >= public.kern_bevriezing(p.seizoen) then
    if tg_op = 'INSERT' then
      new.aangevuld_op := (public.nu() at time zone 'Europe/Brussels')::date;   -- definitieve aanvulling
    else
      raise exception 'De kern is bevroren sinds %; bestaande spelers kunnen niet meer gewijzigd of verwijderd worden.', to_char(public.kern_bevriezing(p.seizoen) at time zone 'Europe/Brussels','DD/MM/YYYY');
    end if;
  elsif tg_op = 'INSERT' and not public.vrije_toegang() then
    new.aangevuld_op := null;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger spelers_controle before insert or update or delete on public.spelers
  for each row execute function public.trg_spelers();

-- Verantwoordelijke per speeldag: tot de deadline; aanwezigheid enkel door de beheerder.
create function public.trg_school_speeldag() returns trigger language plpgsql set search_path = public as $$
begin
  if public.vrije_toegang() then return new; end if;
  if new.aanwezig is distinct from (case when tg_op = 'UPDATE' then old.aanwezig else null end) then
    raise exception 'De aanwezigheid registreert enkel de beheerder.';
  end if;
  if public.nu() >= public.selectie_deadline(new.speeldag_id) then
    raise exception 'De gegevens voor deze speeldag zijn bevroren sinds %.', to_char(public.selectie_deadline(new.speeldag_id) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
  end if;
  return new;
end $$;
create trigger school_speeldag_controle before insert or update on public.school_speeldag
  for each row execute function public.trg_school_speeldag();

-- Coaches: tot de deadline.
create function public.trg_coaches() returns trigger language plpgsql set search_path = public as $$
declare sd int;
begin
  sd := case when tg_op = 'DELETE' then old.speeldag_id else new.speeldag_id end;
  if not public.vrije_toegang() and public.nu() >= public.selectie_deadline(sd) then
    raise exception 'De coaches voor deze speeldag zijn bevroren sinds %.', to_char(public.selectie_deadline(sd) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger coaches_controle before insert or update or delete on public.coaches
  for each row execute function public.trg_coaches();

-- Selectie: tot de deadline, enkel spelers uit de eigen kern, max. 8 of 12.
create function public.trg_selecties() returns trigger language plpgsql set search_path = public as $$
declare sd int; cat smallint;
begin
  sd := case when tg_op = 'DELETE' then old.speeldag_id else new.speeldag_id end;
  if not public.vrije_toegang() and public.nu() >= public.selectie_deadline(sd) then
    raise exception 'De selectie voor deze speeldag is bevroren sinds %.', to_char(public.selectie_deadline(sd) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
  end if;
  if tg_op = 'INSERT' then
    if not exists (select 1 from spelers where id = new.speler_id and ploeg_id = new.ploeg_id) then
      raise exception 'Deze speler zit niet in de kern van deze ploeg.';
    end if;
    select categorie into cat from ploegen where id = new.ploeg_id;
    if (select count(*) from selecties where ploeg_id = new.ploeg_id and speeldag_id = new.speeldag_id) >= public.max_wedstrijdblad(cat) then
      raise exception 'Maximum % spelers op het wedstrijdblad.', public.max_wedstrijdblad(cat);
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
create trigger selecties_controle before insert or update or delete on public.selecties
  for each row execute function public.trg_selecties();

-- ---------- 8. Row Level Security ----------
alter table public.instellingen     enable row level security;
alter table public.scholen          enable row level security;
alter table public.beheerders       enable row level security;
alter table public.school_gebruikers enable row level security;
alter table public.speeldagen       enable row level security;
alter table public.ploegen          enable row level security;
alter table public.spelers          enable row level security;
alter table public.school_speeldag  enable row level security;
alter table public.coaches          enable row level security;
alter table public.selecties        enable row level security;
alter table public.dagplanning      enable row level security;
alter table public.wedstrijden      enable row level security;

-- Instellingen: iedereen aangemeld leest, beheerder wijzigt.
create policy lezen on public.instellingen for select to authenticated using (true);
create policy beheer on public.instellingen for update to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- Beheerders en koppelingen: enkel je eigen rij lezen.
create policy eigen on public.beheerders for select to authenticated using (user_id = auth.uid());
create policy eigen on public.school_gebruikers for select to authenticated using (user_id = auth.uid() or public.is_beheerder());
create policy beheer on public.school_gebruikers for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- Scholen: aanvraag door iedereen; lezen en wijzigen enkel de eigen school; beheerder alles.
create policy aanvraag on public.scholen for insert to anon, authenticated with check (true);
create policy lezen on public.scholen for select to authenticated using (public.is_beheerder() or id = public.mijn_school());
create policy wijzigen on public.scholen for update to authenticated
  using (public.is_beheerder() or id = public.mijn_school()) with check (public.is_beheerder() or id = public.mijn_school());
create policy verwijderen on public.scholen for delete to authenticated using (public.is_beheerder());

-- Kalender: publiek leesbaar.
create policy lezen on public.speeldagen for select to anon, authenticated using (true);
create policy beheer on public.speeldagen for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- Ploegen: alle aangemelde gebruikers zien welke ploegen meedoen (geen persoonsgegevens);
-- een school beheert enkel haar eigen ploegen.
create policy lezen on public.ploegen for select to authenticated using (true);
create policy inschrijven on public.ploegen for insert to authenticated with check (public.is_beheerder() or school_id = public.mijn_school());
create policy uitschrijven on public.ploegen for delete to authenticated using (public.is_beheerder() or school_id = public.mijn_school());
create policy beheer on public.ploegen for update to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- Spelers, coaches, selecties: enkel van de eigen school.
create function public.is_eigen_ploeg(p_ploeg uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_beheerder() or exists (select 1 from ploegen where id = p_ploeg and school_id = public.mijn_school()) $$;

create policy eigen on public.spelers   for all to authenticated using (public.is_eigen_ploeg(ploeg_id)) with check (public.is_eigen_ploeg(ploeg_id));
create policy eigen on public.coaches   for all to authenticated using (public.is_eigen_ploeg(ploeg_id)) with check (public.is_eigen_ploeg(ploeg_id));
create policy eigen on public.selecties for all to authenticated using (public.is_eigen_ploeg(ploeg_id)) with check (public.is_eigen_ploeg(ploeg_id));

-- Verantwoordelijke per speeldag: eigen school.
create policy lezen on public.school_speeldag for select to authenticated using (public.is_beheerder() or school_id = public.mijn_school());
create policy invullen on public.school_speeldag for insert to authenticated with check (public.is_beheerder() or school_id = public.mijn_school());
create policy wijzigen on public.school_speeldag for update to authenticated
  using (public.is_beheerder() or school_id = public.mijn_school()) with check (public.is_beheerder() or school_id = public.mijn_school());
create policy verwijderen on public.school_speeldag for delete to authenticated using (public.is_beheerder());

-- Planning en wedstrijden: iedereen aangemeld leest, enkel de beheerder schrijft.
create policy lezen on public.dagplanning for select to authenticated using (true);
create policy beheer on public.dagplanning for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());
create policy lezen on public.wedstrijden for select to authenticated using (true);
create policy beheer on public.wedstrijden for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

-- Namen van actieve scholen (voor schema en klassement), zonder contactgegevens.
create function public.schoolnamen() returns table (id uuid, naam text)
language sql stable security definer set search_path = public as
$$ select id, naam from scholen where status = 'actief' order by naam $$;

