-- =====================================================================
-- Schoolcup-portaal · SQL 006 · Logboek van automatische mails (fase 6)
-- Eén keer uitvoeren in Supabase › SQL Editor.
-- =====================================================================
create table if not exists public.mail_log (
  id          bigserial primary key,
  school_id   uuid references public.scholen on delete cascade,
  soort       text not null,          -- bv. ploegen, kern, speeldag-1, finale
  sleutel     text not null,          -- uniek per soort, voorkomt dubbele herinneringen
  aan         text,
  verstuurd_op timestamptz not null default now(),
  unique (soort, sleutel)
);
alter table public.mail_log enable row level security;
drop policy if exists beheer on public.mail_log;
create policy beheer on public.mail_log for select to authenticated using (public.is_beheerder());

-- Uitbreidingen voor geplande taken (dagelijkse herinneringen)
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select 'SQL 006 uitgevoerd' as resultaat;
