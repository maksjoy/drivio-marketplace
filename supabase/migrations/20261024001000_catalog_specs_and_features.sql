-- Catalog specs and feature codes for Alberta-Cars search.
--
-- Apply after 20261023213000_protect_profile_trust_columns.sql and before the
-- app that selects engine_l / power_hp. Do not apply this from CI. Run it
-- yourself. The file opens and commits its own transaction (begin ... commit),
-- so do not add --single-transaction:
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
--     -f supabase/migrations/20261024001000_catalog_specs_and_features.sql
--
-- Live anon statement_timeout is already 3s (confirmed 2026-10-23). This file
-- does not change role timeouts. After it commits, review the worst filter
-- with the anon role, for example:
--
--   set role anon;
--   explain (costs off)
--   select id from public.listings
--   where status in ('active', 'sold')
--     and features @> array['leather_seats','panoramic_roof']
--     and color in ('Black','White')
--     and engine_l between 1.5 and 3.5
--     and power_hp between 150 and 400
--     and price between 5000 and 80000;
--   reset role;
--
-- Backfill notes:
--   * restrict_owner_listing_update does not treat the row as an owner edit
--     when auth.uid() is null, so this backfill does not return listings to
--     pending or unpublish them.
--   * trg_listings_updated_at is disabled only around the backfill statements
--     so updated_at (and newest-first sort) does not move.
--   * Original free-text colours are copied to color_legacy first. That column
--     is not granted to anon.
--   * Engine text is parsed from both '3.6 L' and bare '3.6'.
--   * Feature labels are rewritten to stable codes, including the 11 labels
--     present in the live database on 2026-10-23.
--   * Body value 'Pickup' is renamed to 'Truck/Pickup'. Transmission regains
--     'CVT' (a 2026-09 migration had folded CVT into Automatic).
--
-- Rollback is commented at the bottom. Colour can be restored from
-- color_legacy. Feature labels can be mapped back only for the codes that
-- came from the old labels; take a snapshot before applying if you need a
-- byte-for-byte undo.

begin;
set local lock_timeout = '5s';
set local statement_timeout = '120s';
lock table public.listings in access exclusive mode;

alter table public.listings
  add column if not exists color_legacy text,
  add column if not exists engine_l numeric(3,1),
  add column if not exists power_hp smallint;

create temporary table catalog_feature_slug (slug text primary key);
insert into catalog_feature_slug (slug) values
  ('leather_seats'),
  ('heated_seats'),
  ('heated_rear_seats'),
  ('ventilated_seats'),
  ('heated_steering_wheel'),
  ('panoramic_roof'),
  ('sunroof'),
  ('keyless_entry'),
  ('push_button_start'),
  ('power_liftgate'),
  ('third_row'),
  ('remote_start'),
  ('block_heater'),
  ('winter_tires'),
  ('tow_package'),
  ('navigation'),
  ('carplay_android_auto'),
  ('bluetooth'),
  ('premium_audio'),
  ('head_up_display'),
  ('backup_camera'),
  ('camera_360'),
  ('parking_sensors'),
  ('blind_spot'),
  ('lane_keep_assist'),
  ('cruise_control'),
  ('adaptive_cruise'),
  ('carfax_available');

do $$
declare
  slug_count integer;
begin
  select count(*) into slug_count from catalog_feature_slug;
  if slug_count <> 28 then
    raise exception 'pre-check failed: feature allowlist has % slugs, expected 28', slug_count;
  end if;
end $$;

alter table public.listings disable trigger trg_listings_updated_at;

update public.listings
set color_legacy = color
where color_legacy is null
  and color is not null;

update public.listings
set color = case
  when color is null or btrim(color) = '' then null
  else case lower(btrim(color))
    when 'black' then 'Black'
    when 'white' then 'White'
    when 'silver' then 'Silver'
    when 'grey' then 'Grey'
    when 'gray' then 'Grey'
    when 'blue' then 'Blue'
    when 'red' then 'Red'
    when 'green' then 'Green'
    when 'brown' then 'Brown'
    when 'beige' then 'Beige'
    when 'gold' then 'Gold'
    when 'orange' then 'Orange'
    when 'yellow' then 'Yellow'
    when 'purple' then 'Purple'
    else 'Other'
  end
end
where color is not null;

update public.listings
set body_type = 'Truck/Pickup'
where lower(btrim(body_type)) = 'pickup';

update public.listings
set engine_l = (
  select case
    when parsed >= 0.6 and parsed <= 8.5 then parsed::numeric(3,1)
    else null
  end
  from (
    select nullif(substring(engine from '(\d{1,2}(?:\.\d)?)'), '')::numeric as parsed
  ) parsed_engine
)
where engine_l is null
  and engine ~ '^\s*\d{1,2}(\.\d)?\s*(l|L|litre|liter)?\s*$';

update public.listings as listing
set features = coalesce((
  select array_agg(slug order by first_ord)
  from (
    select slug, min(ord) as first_ord
    from (
      select
        case item.feature
          when 'Leather seats' then 'leather_seats'
          when 'Heated seats' then 'heated_seats'
          when 'Ventilated seats' then 'ventilated_seats'
          when 'Heated steering wheel' then 'heated_steering_wheel'
          when 'Remote start' then 'remote_start'
          when 'Navigation' then 'navigation'
          when 'Apple CarPlay / Android Auto' then 'carplay_android_auto'
          when 'Backup camera' then 'backup_camera'
          when U&'360\00B0 camera' then 'camera_360'
          when 'Blind spot monitoring' then 'blind_spot'
          when 'Adaptive cruise control' then 'adaptive_cruise'
          when 'Tow package' then 'tow_package'
          when 'Winter tires included' then 'winter_tires'
          when 'CARFAX / CarProof available' then 'carfax_available'
          when 'Bluetooth' then 'bluetooth'
          when 'Cruise control' then 'cruise_control'
          else item.feature
        end as slug,
        item.ord
      from unnest(listing.features) with ordinality as item(feature, ord)
    ) mapped
    where slug in (select catalog_feature_slug.slug from catalog_feature_slug)
    group by slug
  ) deduped
), '{}'::text[])
where listing.features is not null;

alter table public.listings enable trigger trg_listings_updated_at;

-- Pre-check: existing rows must already satisfy every constraint below.
-- VALIDATE will scan them again; failing here leaves the transaction uncommitted.
do $$
begin
  if exists (select 1 from public.listings where price is null or price < 500 or price > 2000000) then
    raise exception 'pre-check failed: price must be between 500 and 2000000';
  end if;
  if exists (select 1 from public.listings where mileage is null or mileage < 0 or mileage > 2000000) then
    raise exception 'pre-check failed: mileage must be between 0 and 2000000';
  end if;
  if exists (
    select 1 from public.listings
    where year is null
      or year < 1980
      or year > extract(year from now())::integer + 1
  ) then
    raise exception 'pre-check failed: year must be from 1980 through the current year + 1';
  end if;
  if exists (select 1 from public.listings where description is not null and char_length(description) > 3000) then
    raise exception 'pre-check failed: description is longer than 3000 characters';
  end if;
  if exists (select 1 from public.listings where city is not null and char_length(city) > 80) then
    raise exception 'pre-check failed: city is longer than 80 characters';
  end if;
  if exists (
    select 1 from public.listings
    where color is not null
      and color not in ('Black','White','Silver','Grey','Blue','Red','Green','Brown','Beige','Gold','Orange','Yellow','Purple','Other')
  ) then
    raise exception 'pre-check failed: color is outside the allowlist';
  end if;
  if exists (select 1 from public.listings where engine_l is not null and (engine_l < 0.6 or engine_l > 8.5)) then
    raise exception 'pre-check failed: engine_l is outside 0.6 to 8.5';
  end if;
  if exists (
    select 1 from public.listings
    where engine ~ '^\s*\d{1,2}(\.\d)?\s*(l|L|litre|liter)?\s*$'
      and substring(engine from '(\d{1,2}(?:\.\d)?)')::numeric between 0.6 and 8.5
      and engine_l is null
  ) then
    raise exception 'pre-check failed: engine text was not parsed into engine_l';
  end if;
  if exists (select 1 from public.listings where power_hp is not null and (power_hp < 40 or power_hp > 1500)) then
    raise exception 'pre-check failed: power_hp is outside 40 to 1500';
  end if;
  if exists (
    select 1 from public.listings
    where body_type is not null
      and body_type not in ('Sedan','SUV','Truck/Pickup','Hatchback','Coupe','Wagon','Van/Minivan','Convertible')
  ) then
    raise exception 'pre-check failed: body_type is outside the allowlist';
  end if;
  if exists (
    select 1 from public.listings
    where drivetrain is not null
      and drivetrain not in ('FWD','RWD','AWD','4WD')
  ) then
    raise exception 'pre-check failed: drivetrain is outside the allowlist';
  end if;
  if exists (
    select 1 from public.listings
    where fuel is null
      or fuel not in ('Gasoline','Diesel','Hybrid','Plug-in Hybrid','Electric')
  ) then
    raise exception 'pre-check failed: fuel is outside the allowlist';
  end if;
  if exists (
    select 1 from public.listings
    where transmission is not null
      and transmission not in ('Automatic','Manual','CVT')
  ) then
    raise exception 'pre-check failed: transmission is outside Automatic, Manual, CVT';
  end if;
  if exists (
    select 1
    from public.listings listing
    where features is not null
      and (
        cardinality(features) > (select count(*) from catalog_feature_slug)
        or exists (
          select 1
          from unnest(features) as feature
          where feature not in (select catalog_feature_slug.slug from catalog_feature_slug)
        )
      )
  ) then
    raise exception 'pre-check failed: features are outside the allowlist or over the cardinality cap';
  end if;
end $$;

alter table public.listings
  add constraint listings_price_range
  check (price is not null and price >= 500 and price <= 2000000)
  not valid;

alter table public.listings
  add constraint listings_mileage_range
  check (mileage is not null and mileage >= 0 and mileage <= 2000000)
  not valid;

alter table public.listings
  add constraint listings_year_min
  check (year is not null and year >= 1980)
  not valid;

alter table public.listings
  add constraint listings_description_length
  check (description is null or char_length(description) <= 3000)
  not valid;

alter table public.listings
  add constraint listings_city_length
  check (city is null or char_length(city) <= 80)
  not valid;

alter table public.listings
  add constraint listings_color_allowed
  check (color is null or color in (
    'Black','White','Silver','Grey','Blue','Red','Green','Brown','Beige','Gold','Orange','Yellow','Purple','Other'
  ))
  not valid;

alter table public.listings
  add constraint listings_engine_l_range
  check (engine_l is null or (engine_l >= 0.6 and engine_l <= 8.5))
  not valid;

alter table public.listings
  add constraint listings_power_hp_range
  check (power_hp is null or (power_hp >= 40 and power_hp <= 1500))
  not valid;

alter table public.listings
  add constraint listings_body_allowed
  check (body_type is null or body_type in (
    'Sedan','SUV','Truck/Pickup','Hatchback','Coupe','Wagon','Van/Minivan','Convertible'
  ))
  not valid;

alter table public.listings
  add constraint listings_drive_allowed
  check (drivetrain is null or drivetrain in ('FWD','RWD','AWD','4WD'))
  not valid;

alter table public.listings
  add constraint listings_fuel_allowed
  check (fuel in ('Gasoline','Diesel','Hybrid','Plug-in Hybrid','Electric'))
  not valid;

alter table public.listings
  add constraint listings_color_legacy_length
  check (color_legacy is null or char_length(color_legacy) <= 80)
  not valid;

do $$
declare
  allowlist text;
  cap integer;
begin
  select count(*) into cap from catalog_feature_slug;
  select string_agg(quote_literal(slug), ',' order by slug) into allowlist from catalog_feature_slug;
  execute format(
    'alter table public.listings add constraint listings_features_allowed check (features is null or (cardinality(features) <= %s and features <@ array[%s]::text[])) not valid',
    cap,
    allowlist
  );
end $$;

alter table public.listings drop constraint if exists listings_transmission_allowed;
alter table public.listings drop constraint if exists listings_transmission_check;

alter table public.listings
  add constraint listings_transmission_allowed
  check (transmission is null or transmission in ('Automatic','Manual','CVT'))
  not valid;

alter table public.listings validate constraint listings_price_range;
alter table public.listings validate constraint listings_mileage_range;
alter table public.listings validate constraint listings_year_min;
alter table public.listings validate constraint listings_description_length;
alter table public.listings validate constraint listings_city_length;
alter table public.listings validate constraint listings_color_allowed;
alter table public.listings validate constraint listings_engine_l_range;
alter table public.listings validate constraint listings_power_hp_range;
alter table public.listings validate constraint listings_body_allowed;
alter table public.listings validate constraint listings_drive_allowed;
alter table public.listings validate constraint listings_fuel_allowed;
alter table public.listings validate constraint listings_features_allowed;
alter table public.listings validate constraint listings_transmission_allowed;
alter table public.listings validate constraint listings_color_legacy_length;

-- Clients must not write color_legacy on insert; it only holds pre-migration colour text.
create or replace function private.enforce_private_listing_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- color_legacy is migration-only provenance; clients may never set it.
  new.color_legacy := null;

  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'You can only create your own listings.';
  end if;

  if exists(
    select 1 from public.user_moderation
    where user_id = new.user_id
      and is_blocked
      and (blocked_until is null or blocked_until > now())
  ) then
    raise exception 'Your account is blocked from publishing listings.';
  end if;

  if new.status <> 'pending' then
    raise exception 'New listings must be pending.';
  end if;

  if nullif(btrim(new.make),'') is null
     or nullif(btrim(new.model),'') is null
     or nullif(btrim(new.fuel),'') is null then
    raise exception 'Make, model and fuel are required.';
  end if;

  if char_length(new.make) > 80 or char_length(new.model) > 120 or char_length(new.seller_name) > 160 then
    raise exception 'Listing text is too long.';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  if exists(select 1 from public.listings where user_id = new.user_id and created_at > now() - interval '30 seconds') then
    raise exception 'Please wait before creating another listing.';
  end if;

  if (select count(*) from public.listings where user_id = new.user_id and created_at >= date_trunc('day', now())) >= 6 then
    raise exception 'Daily listing creation limit reached.';
  end if;

  if (select count(*) from public.listings where user_id = new.user_id and status in ('pending','active')) >= 3 then
    raise exception 'Private seller listing limit reached.';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_listing_year_upper_bound()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.year > extract(year from now())::integer + 1 then
    raise exception 'Listing year is not allowed';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_listing_year_upper_bound() from public, anon, authenticated;

drop trigger if exists trg_listings_year_upper_bound on public.listings;
create trigger trg_listings_year_upper_bound
  before insert or update of year on public.listings
  for each row execute function private.enforce_listing_year_upper_bound();

-- Owner edits of the new public columns must return the listing to review.
-- color_legacy stays owner-immutable. auth.uid() null still skips this branch.
create or replace function private.restrict_owner_listing_update()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  admin_user boolean;
  owner_edit boolean;
begin
  admin_user := exists(select 1 from public.admins where user_id=auth.uid());
  if new.user_id<>old.user_id then raise exception 'Listing owner cannot be changed'; end if;

  if auth.uid()=old.user_id and not admin_user then
    if old.status='sold' then
      raise exception 'Sold listings cannot be edited. Use Delete listing to remove it immediately.';
    end if;

    owner_edit :=
      new.seller_phone is distinct from old.seller_phone or
      new.seller_email is distinct from old.seller_email or
      new.make is distinct from old.make or new.model is distinct from old.model or
      new.year is distinct from old.year or new.price is distinct from old.price or
      new.mileage is distinct from old.mileage or new.body_type is distinct from old.body_type or
      new.transmission is distinct from old.transmission or new.fuel is distinct from old.fuel or
      new.drivetrain is distinct from old.drivetrain or new.city is distinct from old.city or
      new.color is distinct from old.color or new.engine is distinct from old.engine or
      new.engine_l is distinct from old.engine_l or
      new.power_hp is distinct from old.power_hp or
      new.description is distinct from old.description or new.features is distinct from old.features;

    if owner_edit or new.status='pending' then
      if new.status<>'pending' then raise exception 'Edited listings must return to review'; end if;
      if new.seller_name is distinct from old.seller_name
         or new.created_at is distinct from old.created_at
         or new.rejection_reason is not null
         or new.sold_at is distinct from old.sold_at
         or new.color_legacy is distinct from old.color_legacy then
        raise exception 'Protected listing fields cannot be edited';
      end if;
      if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then
        raise exception 'Blocked sellers cannot edit listings';
      end if;
      perform pg_advisory_xact_lock(hashtext(new.user_id::text));
      if old.status not in ('pending','active') and
         (select count(*) from public.listings where user_id=new.user_id and id<>new.id and status in ('pending','active'))>=3 then
        raise exception 'listing limit reached';
      end if;
      new.rejection_reason:=null;
    elsif new.status='sold' then
      if old.status not in ('active','pending') then raise exception 'Only active or pending listings can be marked sold'; end if;
      if (to_jsonb(new)-array['status','updated_at','sold_at']) is distinct from (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Marking sold can only change listing status';
      end if;
    elsif new.status='removed' then
      if (to_jsonb(new)-array['status','updated_at','sold_at']) is distinct from (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Remove can only change listing status';
      end if;
    else
      raise exception 'Owners may edit for review, mark sold, or remove listings';
    end if;
  end if;

  if new.status='active' and old.status<>'active' then
    if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then
      raise exception 'Blocked sellers cannot have active listings';
    end if;
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (select count(*) from public.listings where user_id=new.user_id and id<>new.id and status in ('pending','active'))>=3 then
      raise exception 'listing limit reached';
    end if;
    if not exists(select 1 from public.listing_images where listing_id=new.id) then
      raise exception 'Upload at least one photo before activation';
    end if;
  end if;
  return new;
end;
$$;

create index if not exists idx_listings_market_features_gin
  on public.listings using gin (features)
  where status in ('active', 'sold');

create index if not exists idx_listings_market_color
  on public.listings (color, created_at desc, id desc)
  where status in ('active', 'sold');

create index if not exists idx_listings_market_engine_l
  on public.listings (engine_l)
  where status in ('active', 'sold');

create index if not exists idx_listings_market_power
  on public.listings (power_hp)
  where status in ('active', 'sold');

grant select (engine_l, power_hp) on table public.listings to anon;

do $$
declare
  missing text;
  unvalidated text;
begin
  select string_agg(expected.name, ', ' order by expected.name) into missing
  from (
    values
      ('listings_price_range'),
      ('listings_mileage_range'),
      ('listings_year_min'),
      ('listings_description_length'),
      ('listings_city_length'),
      ('listings_color_allowed'),
      ('listings_engine_l_range'),
      ('listings_power_hp_range'),
      ('listings_body_allowed'),
      ('listings_drive_allowed'),
      ('listings_fuel_allowed'),
      ('listings_features_allowed'),
      ('listings_transmission_allowed'),
      ('listings_color_legacy_length')
  ) as expected(name)
  where not exists (
    select 1 from pg_constraint
    where conrelid = 'public.listings'::regclass
      and conname = expected.name
  );
  if missing is not null then
    raise exception 'post-check failed: missing constraints %', missing;
  end if;

  select string_agg(conname, ', ' order by conname) into unvalidated
  from pg_constraint
  where conrelid = 'public.listings'::regclass
    and conname in (
      'listings_price_range','listings_mileage_range','listings_year_min',
      'listings_description_length','listings_city_length','listings_color_allowed',
      'listings_engine_l_range','listings_power_hp_range','listings_body_allowed',
      'listings_drive_allowed','listings_fuel_allowed','listings_features_allowed',
      'listings_transmission_allowed','listings_color_legacy_length'
    )
    and not convalidated;
  if unvalidated is not null then
    raise exception 'post-check failed: constraints still not validated: %', unvalidated;
  end if;
end $$;

do $$
begin
  execute 'set local role anon';
  begin
    perform color_legacy from public.listings limit 1;
    execute 'reset role';
    raise exception 'post-check failed: anon can read listings.color_legacy';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  execute 'set local role anon';
  begin
    perform user_id from public.listings limit 1;
    execute 'reset role';
    raise exception 'post-check failed: anon can read listings.user_id';
  exception
    when insufficient_privilege then
      execute 'reset role';
  end;

  execute 'set local role anon';
  perform id, engine_l, power_hp, color, features from public.listings limit 1;
  execute 'reset role';
end $$;

drop table catalog_feature_slug;

commit;

-- Rollback (do not run as part of this migration):
--
-- begin;
-- drop index if exists idx_listings_market_features_gin;
-- drop index if exists idx_listings_market_color;
-- drop index if exists idx_listings_market_engine_l;
-- drop index if exists idx_listings_market_power;
-- drop trigger if exists trg_listings_year_upper_bound on public.listings;
-- drop function if exists private.enforce_listing_year_upper_bound();
-- alter table public.listings drop constraint if exists listings_price_range;
-- alter table public.listings drop constraint if exists listings_mileage_range;
-- alter table public.listings drop constraint if exists listings_year_min;
-- alter table public.listings drop constraint if exists listings_description_length;
-- alter table public.listings drop constraint if exists listings_city_length;
-- alter table public.listings drop constraint if exists listings_color_allowed;
-- alter table public.listings drop constraint if exists listings_engine_l_range;
-- alter table public.listings drop constraint if exists listings_power_hp_range;
-- alter table public.listings drop constraint if exists listings_body_allowed;
-- alter table public.listings drop constraint if exists listings_drive_allowed;
-- alter table public.listings drop constraint if exists listings_fuel_allowed;
-- alter table public.listings drop constraint if exists listings_features_allowed;
-- alter table public.listings drop constraint if exists listings_transmission_allowed;
-- alter table public.listings drop constraint if exists listings_color_legacy_length;
-- alter table public.listings
--   add constraint listings_transmission_allowed
--   check (transmission is null or transmission in ('Automatic','Manual'));
-- update public.listings set color = color_legacy where color_legacy is not null;
-- update public.listings set body_type = 'Pickup' where body_type = 'Truck/Pickup';
-- update public.listings set features = (
--   select coalesce(array_agg(
--     case feature
--       when 'leather_seats' then 'Leather seats'
--       when 'heated_seats' then 'Heated seats'
--       when 'ventilated_seats' then 'Ventilated seats'
--       when 'heated_steering_wheel' then 'Heated steering wheel'
--       when 'remote_start' then 'Remote start'
--       when 'navigation' then 'Navigation'
--       when 'carplay_android_auto' then 'Apple CarPlay / Android Auto'
--       when 'backup_camera' then 'Backup camera'
--       when 'camera_360' then U&'360\00B0 camera'
--       when 'blind_spot' then 'Blind spot monitoring'
--       when 'adaptive_cruise' then 'Adaptive cruise control'
--       when 'tow_package' then 'Tow package'
--       when 'winter_tires' then 'Winter tires included'
--       when 'carfax_available' then 'CARFAX / CarProof available'
--       else feature
--     end
--   ), '{}')
--   from unnest(features) feature
-- );
-- revoke select (engine_l, power_hp) on table public.listings from anon;
-- alter table public.listings drop column if exists power_hp;
-- alter table public.listings drop column if exists engine_l;
-- alter table public.listings drop column if exists color_legacy;
-- -- Then restore private.restrict_owner_listing_update() from
-- -- 20260912013000_remove_telegram_web_only.sql.
-- -- Restore private.enforce_private_listing_insert() from
-- -- 20260928032500_remove_redundant_listing_contact_check.sql before dropping color_legacy.
-- commit;
