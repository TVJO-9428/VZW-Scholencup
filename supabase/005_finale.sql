-- =====================================================================
-- Schoolcup-portaal · SQL 005 · Finale (fase 5)
-- Eén keer uitvoeren in Supabase › SQL Editor.
-- =====================================================================

-- Vanaf seizoen 2027–2028 zijn er vier competitiedagen (september t.e.m. maart)
alter table public.speeldagen drop constraint if exists speeldagen_code_check;
alter table public.speeldagen add constraint speeldagen_code_check check (code in ('1','2','3','4','F'));

-- Finalisten per categorie (nr. 1 en 2; bij vrijgeleide nr. 3 of 4)
create table if not exists public.finalisten (
  seizoen     smallint not null,
  categorie   smallint not null check (categorie between 8 and 12),
  ploeg_id    uuid not null references public.ploegen on delete cascade,
  plaats      smallint not null,
  vrijgeleide boolean not null default false,
  primary key (seizoen, categorie, ploeg_id)
);

-- Winnaar na strafschoppen
alter table public.wedstrijden add column if not exists strafschoppen_winnaar uuid references public.ploegen on delete set null;

-- Titels (wisselbeker) per seizoen
create table if not exists public.titels (
  seizoen   smallint not null,
  categorie smallint not null check (categorie between 8 and 12),
  school_id uuid not null references public.scholen on delete cascade,
  primary key (seizoen, categorie)
);

alter table public.finalisten enable row level security;
alter table public.titels     enable row level security;
drop policy if exists lezen on public.finalisten;  create policy lezen on public.finalisten for select to authenticated using (true);
drop policy if exists beheer on public.finalisten; create policy beheer on public.finalisten for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());
drop policy if exists lezen on public.titels;      create policy lezen on public.titels for select to authenticated using (true);
drop policy if exists beheer on public.titels;     create policy beheer on public.titels for all to authenticated using (public.is_beheerder()) with check (public.is_beheerder());

create or replace function public.is_finalist(p_ploeg uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from finalisten where ploeg_id = p_ploeg) $$;

create or replace function public.school_is_finalist(p_school uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from finalisten f join ploegen p on p.id = f.ploeg_id where p.school_id = p_school) $$;

-- Deadline per speeldag: maandag 12:00; finale: één week vooraf 12:00, bij vrijgeleide maandag 12:00.
create or replace function public.deadline_voor(p_speeldag int, p_ploeg uuid, p_school uuid) returns timestamptz
language sql stable security definer set search_path = public as
$$ select ((s.datum - case
           when s.code <> 'F' then 2
           when exists (select 1 from finalisten f join ploegen p on p.id = f.ploeg_id
                        where f.vrijgeleide and (f.ploeg_id = p_ploeg or p.school_id = p_school)) then 2
           else 7 end)::timestamp + time '12:00') at time zone 'Europe/Brussels'
   from speeldagen s where s.id = p_speeldag $$;

create or replace function public.is_finaledag(p_speeldag int) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from speeldagen where id = p_speeldag and code = 'F') $$;

-- Verantwoordelijke per speeldag
create or replace function public.trg_school_speeldag() returns trigger language plpgsql set search_path = public as $$
begin
  if public.vrije_toegang() then return new; end if;
  if new.aanwezig is distinct from (case when tg_op = 'UPDATE' then old.aanwezig else null end) then
    raise exception 'De aanwezigheid registreert enkel de beheerder.';
  end if;
  if public.is_finaledag(new.speeldag_id) and not public.school_is_finalist(new.school_id) then
    raise exception 'Enkel finalisten vullen de finaledag in.';
  end if;
  if public.nu() >= public.deadline_voor(new.speeldag_id, null, new.school_id) then
    raise exception 'De gegevens voor deze speeldag zijn bevroren sinds %.', to_char(public.deadline_voor(new.speeldag_id, null, new.school_id) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
  end if;
  return new;
end $$;

-- Coaches
create or replace function public.trg_coaches() returns trigger language plpgsql set search_path = public as $$
declare sd int; pl uuid;
begin
  sd := case when tg_op = 'DELETE' then old.speeldag_id else new.speeldag_id end;
  pl := case when tg_op = 'DELETE' then old.ploeg_id else new.ploeg_id end;
  if not public.vrije_toegang() then
    if public.is_finaledag(sd) and not public.is_finalist(pl) then raise exception 'Enkel finalisten vullen de finaledag in.'; end if;
    if public.nu() >= public.deadline_voor(sd, pl, null) then
      raise exception 'De coaches voor deze speeldag zijn bevroren sinds %.', to_char(public.deadline_voor(sd, pl, null) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Selecties
create or replace function public.trg_selecties() returns trigger language plpgsql set search_path = public as $$
declare sd int; pl uuid; cat smallint;
begin
  sd := case when tg_op = 'DELETE' then old.speeldag_id else new.speeldag_id end;
  pl := case when tg_op = 'DELETE' then old.ploeg_id else new.ploeg_id end;
  if not public.vrije_toegang() then
    if public.is_finaledag(sd) and not public.is_finalist(pl) then raise exception 'Enkel finalisten vullen de finaledag in.'; end if;
    if public.nu() >= public.deadline_voor(sd, pl, null) then
      raise exception 'De selectie voor deze speeldag is bevroren sinds %.', to_char(public.deadline_voor(sd, pl, null) at time zone 'Europe/Brussels','DD/MM/YYYY HH24:MI');
    end if;
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

select 'SQL 005 uitgevoerd' as resultaat;
