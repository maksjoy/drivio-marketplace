-- Hide the listing owner and private contact columns from the anon role.
--
-- APPLY ONLY AFTER both of these are true:
-- 1. Production is serving the app that does not select listings.user_id,
--    seller_phone, or seller_email for anonymous requests.
-- 2. 20261023210000_signed_url_only_listing_photos.sql is already applied
--    and public photos still load.
--
-- The previous listing page selected user_id as anon. Applying this file
-- while that build is live makes public listing pages fail. This app works
-- before this file (it simply does not ask for user_id) and after it.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20261023211000_hide_listing_owner_from_anon.sql
--
-- Table-level SELECT includes every column, so column privileges are not
-- enough on their own. Revoke the table grant, then grant the public columns.
-- authenticated keeps its table-level SELECT, so owner, admin, account, and
-- messaging queries that filter on user_id keep working.
--
-- Rollback, if a public page starts returning permission errors:
--   grant select on table public.listings to anon;

revoke select on table public.listings from anon;
revoke select on table public.listings from public;

grant select (
  id,
  seller_name,
  make,
  model,
  year,
  price,
  mileage,
  body_type,
  transmission,
  fuel,
  drivetrain,
  city,
  color,
  engine,
  description,
  features,
  status,
  rejection_reason,
  sold_at,
  created_at,
  updated_at
) on table public.listings to anon;

do $$
begin
  execute 'set local role anon';
  begin
    perform user_id from public.listings limit 1;
    execute 'reset role';
    raise exception 'anon can still read listings.user_id';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  execute 'set local role anon';
  begin
    perform seller_phone from public.listings limit 1;
    execute 'reset role';
    raise exception 'anon can still read listings.seller_phone';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  execute 'set local role anon';
  perform id, make, model, status, sold_at from public.listings limit 1;
  execute 'reset role';
end $$;
