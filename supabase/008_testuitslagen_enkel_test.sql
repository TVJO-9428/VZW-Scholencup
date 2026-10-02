-- =====================================================================
-- ENKEL IN HET TESTPROJECT: vult willekeurige uitslagen in voor alle
-- competitiewedstrijden, zodat je klassementen en de finale kan testen.
-- Nooit uitvoeren in productie.
-- =====================================================================
update public.wedstrijden
set doelpunten_thuis = floor(random() * 5), doelpunten_uit = floor(random() * 5)
where klassement = false
  and speeldag_id in (select id from public.speeldagen where code <> 'F');
select count(*) as wedstrijden_ingevuld from public.wedstrijden where doelpunten_thuis is not null;
