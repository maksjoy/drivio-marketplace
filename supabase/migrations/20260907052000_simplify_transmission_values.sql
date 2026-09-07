update public.listings
set transmission='Automatic', updated_at=now()
where transmission in ('CVT','DCT');

alter table public.listings
  drop constraint if exists listings_transmission_allowed;

alter table public.listings
  add constraint listings_transmission_allowed
  check (transmission is null or transmission in ('Automatic','Manual'));
