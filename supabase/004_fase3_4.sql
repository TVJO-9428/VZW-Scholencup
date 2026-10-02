-- =====================================================================
-- Schoolcup-portaal · SQL 004 · Aanvulling voor fase 3 en 4
-- Eén keer uitvoeren in Supabase › SQL Editor.
-- Voegt het forfait-veld toe aan wedstrijden, zodat iedereen het juiste klassement ziet
-- zonder de aanwezigheden van andere scholen te kunnen lezen.
-- =====================================================================
alter table public.wedstrijden
  add column if not exists forfait text check (forfait in ('thuis','uit','beide'));

create index if not exists wedstrijden_ploegen on public.wedstrijden (thuis_ploeg_id, uit_ploeg_id);
create index if not exists coaches_dag on public.coaches (speeldag_id);
create index if not exists selecties_dag on public.selecties (speeldag_id);

select 'SQL 004 uitgevoerd' as resultaat;
