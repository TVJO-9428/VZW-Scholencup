-- =====================================================================
-- Schoolcup-portaal · SQL 007 · Dagelijkse herinneringen inplannen (fase 6)
-- VOOR je dit uitvoert: vervang de twee waarden hieronder.
--   PROJECTREF   = het stuk vóór .supabase.co in je Project URL (bv. qewdmgdkczgcnullvcba)
--   CRON_GEHEIM  = dezelfde willekeurige tekst als het secret CRON_SECRET bij Edge Functions
-- Elke dag om 06:00 UTC (07:00 of 08:00 Belgische tijd) controleert de functie "meldingen"
-- of er herinneringen te versturen zijn. Een herinnering gaat maar één keer per school.
-- =====================================================================
select cron.unschedule('schoolcup-meldingen') where exists (select 1 from cron.job where jobname = 'schoolcup-meldingen');

select cron.schedule('schoolcup-meldingen', '0 6 * * *', $$
  select net.http_post(
    url     := 'https://PROJECTREF.supabase.co/functions/v1/meldingen',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'CRON_GEHEIM'),
    body    := '{"actie":"cron"}'::jsonb
  );
$$);

select jobname, schedule, active from cron.job where jobname = 'schoolcup-meldingen';
