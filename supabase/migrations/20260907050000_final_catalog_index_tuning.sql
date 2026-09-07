drop index if exists public.idx_listings_city;
drop index if exists public.idx_listings_make;
drop index if exists public.idx_listing_views_viewed_at;
drop index if exists public.idx_listing_views_listing;
drop index if exists public.idx_listing_views_viewer;
drop index if exists public.idx_site_events_event_name;

create index if not exists idx_listings_active_transmission
  on public.listings (transmission, created_at desc, id desc)
  where status='active';

create index if not exists idx_listings_active_drivetrain
  on public.listings (drivetrain, created_at desc, id desc)
  where status='active';

create index if not exists idx_listings_active_engine
  on public.listings (engine, created_at desc, id desc)
  where status='active';
