-- Scale the public marketplace query, which intentionally includes both active
-- listings and sold listings during their 14-day retention window.
-- These indexes match cursor pagination and the most common catalog filters.

create index if not exists idx_listings_market_created_keyset
  on public.listings (created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_price_keyset
  on public.listings (price, id)
  where status in ('active','sold');

create index if not exists idx_listings_market_year_keyset
  on public.listings (year, id)
  where status in ('active','sold');

create index if not exists idx_listings_market_mileage_keyset
  on public.listings (mileage, id)
  where status in ('active','sold');

create index if not exists idx_listings_market_make_model
  on public.listings (make, model, created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_city
  on public.listings (city, created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_fuel
  on public.listings (fuel, created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_transmission
  on public.listings (transmission, created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_drivetrain
  on public.listings (drivetrain, created_at desc, id desc)
  where status in ('active','sold');

create index if not exists idx_listings_market_body_type
  on public.listings (body_type, created_at desc, id desc)
  where status in ('active','sold');
