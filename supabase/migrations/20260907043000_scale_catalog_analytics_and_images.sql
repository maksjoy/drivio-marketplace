-- Performance and scale pass for P2PCars.

alter table public.listing_images
  add column if not exists thumb_path text;

create index if not exists idx_listing_images_listing_position
  on public.listing_images (listing_id, position);

create index if not exists idx_listings_active_created_keyset
  on public.listings (created_at, id)
  where status='active';

create index if not exists idx_listings_active_price_keyset
  on public.listings (price, id)
  where status='active';

create index if not exists idx_listings_active_year_keyset
  on public.listings (year, id)
  where status='active';

create index if not exists idx_listings_active_mileage_keyset
  on public.listings (mileage, id)
  where status='active';

create index if not exists idx_listings_active_make_model
  on public.listings (make, model, created_at desc, id desc)
  where status='active';

create index if not exists idx_listings_active_city
  on public.listings (city, created_at desc, id desc)
  where status='active';

create index if not exists idx_listings_active_fuel
  on public.listings (fuel, created_at desc, id desc)
  where status='active';

create table if not exists public.listing_view_daily (
  listing_id uuid not null references public.listings(id) on delete cascade,
  day date not null default ((now() at time zone 'utc')::date),
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (listing_id, day)
);

create table if not exists public.site_event_daily (
  day date not null default ((now() at time zone 'utc')::date),
  event_name text not null,
  path text not null default '/',
  event_count bigint not null default 0 check (event_count >= 0),
  primary key (day, event_name, path)
);

alter table public.listing_view_daily enable row level security;
alter table public.site_event_daily enable row level security;

drop policy if exists "Admins read daily listing views" on public.listing_view_daily;
create policy "Admins read daily listing views"
on public.listing_view_daily for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

drop policy if exists "Admins read daily site events" on public.site_event_daily;
create policy "Admins read daily site events"
on public.site_event_daily for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = auth.uid()));

insert into public.listing_view_daily(listing_id, day, view_count)
select listing_id, (viewed_at at time zone 'utc')::date, count(*)::bigint
from public.listing_views
group by listing_id, (viewed_at at time zone 'utc')::date
on conflict (listing_id, day) do update
set view_count = public.listing_view_daily.view_count + excluded.view_count;

insert into public.site_event_daily(day, event_name, path, event_count)
select (created_at at time zone 'utc')::date, event_name, coalesce(nullif(path,''),'/'), count(*)::bigint
from public.site_events
group by (created_at at time zone 'utc')::date, event_name, coalesce(nullif(path,''),'/')
on conflict (day, event_name, path) do update
set event_count = public.site_event_daily.event_count + excluded.event_count;

truncate table public.listing_views;
truncate table public.site_events;

revoke insert on public.listing_views from anon, authenticated;
revoke insert on public.site_events from anon, authenticated;

create or replace function public.record_listing_view(target_listing uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (
    select 1 from public.listings l
    where l.id = target_listing and l.status = 'active'
  ) then
    return;
  end if;

  insert into public.listing_view_daily(listing_id, day, view_count)
  values(target_listing, (now() at time zone 'utc')::date, 1)
  on conflict (listing_id, day) do update
    set view_count = public.listing_view_daily.view_count + 1;
end;
$$;

revoke all on function public.record_listing_view(uuid) from public;
grant execute on function public.record_listing_view(uuid) to anon, authenticated;

create or replace function public.record_site_event(target_event text, target_path text default '/')
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  clean_path text := left(coalesce(nullif(target_path,''),'/'), 120);
begin
  if auth.uid() is null then
    return;
  end if;

  if target_event not in ('page_view','client_error') then
    return;
  end if;

  insert into public.site_event_daily(day, event_name, path, event_count)
  values((now() at time zone 'utc')::date, target_event, clean_path, 1)
  on conflict (day, event_name, path) do update
    set event_count = public.site_event_daily.event_count + 1;
end;
$$;

revoke all on function public.record_site_event(text,text) from public;
grant execute on function public.record_site_event(text,text) to authenticated;

create or replace function public.admin_recent_activity()
returns table(day date, event_name text, path text, event_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select e.day, e.event_name, e.path, e.event_count
  from public.site_event_daily e
  order by e.day desc, e.event_count desc, e.event_name
  limit 30;
end;
$$;

revoke all on function public.admin_recent_activity() from public;
grant execute on function public.admin_recent_activity() to authenticated;

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare result jsonb;
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'users',(select count(*) from auth.users),
    'listings',(select count(*) from public.listings),
    'activeListings',(select count(*) from public.listings where status='active'),
    'openReports',(select count(*) from public.listing_reports where status='open'),
    'views',(select coalesce(sum(view_count),0) from public.listing_view_daily),
    'events',(select coalesce(sum(event_count),0) from public.site_event_daily),
    'blockedUsers',(select count(*) from public.user_moderation where is_blocked and (blocked_until is null or blocked_until > now()))
  ) into result;
  return result;
end;
$$;

create or replace function private.validate_listing_image()
returns trigger
language plpgsql
set search_path to ''
as $$
declare owner_id uuid; listing_status text;
begin
  select user_id,status into owner_id,listing_status from public.listings where id=new.listing_id;
  if auth.uid() is null or owner_id is distinct from auth.uid() or listing_status<>'pending' then
    raise exception 'Photos can only be added to your pending listing';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.listing_id::text));
  if new.position<0 or new.position>7 then raise exception 'Choose 1–8 photos'; end if;
  if new.storage_path not like owner_id::text||'/'||new.listing_id::text||'/%'
     or not exists(select 1 from storage.objects where bucket_id='listing-photos' and name=new.storage_path)
  then
    raise exception 'Photo must reference your uploaded file';
  end if;
  if new.thumb_path is not null and (
       new.thumb_path not like owner_id::text||'/'||new.listing_id::text||'/%'
       or not exists(select 1 from storage.objects where bucket_id='listing-photos' and name=new.thumb_path)
  ) then
    raise exception 'Thumbnail must reference your uploaded file';
  end if;
  if (select count(*) from public.listing_images where listing_id=new.listing_id and id<>new.id)>=8 then
    raise exception 'Maximum 8 photos';
  end if;
  return new;
end;
$$;
