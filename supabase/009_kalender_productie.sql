-- =====================================================================
-- PRODUCTIE: kalender en standaardplanning seizoen 2026–2027.
-- Uitvoeren in het productieproject na 001, 004, 005 en 006.
-- (In het testproject deed SQL 002 dit al.)
-- =====================================================================
insert into public.speeldagen (seizoen, code, datum) values
  (2026,'1','2026-11-18'), (2026,'2','2027-01-20'), (2026,'3','2027-03-17'), (2026,'F','2027-05-19')
on conflict (seizoen, code) do nothing;

insert into public.dagplanning (speeldag_id, categorie, minuten_helft, rust)
select s.id, c, case when c <= 9 then 12 else 15 end, case when s.code = 'F' then 5 else 2 end
from public.speeldagen s cross join unnest(array[8,9,10,11,12]::smallint[]) c
where s.seizoen = 2026
on conflict do nothing;

select code, datum from public.speeldagen order by datum;
