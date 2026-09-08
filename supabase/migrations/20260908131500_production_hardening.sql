-- Production hardening for P2PCars Telegram marketplace.
update storage.buckets
set file_size_limit = 3145728,
    allowed_mime_types = array['image/jpeg','image/png','image/webp']
where id='listing-photos';

alter table public.listing_images drop constraint if exists listing_images_position_check;
alter table public.listing_images
  add constraint listing_images_position_check check ("position" between 0 and 7);

create unique index if not exists uq_listing_images_listing_position
  on public.listing_images(listing_id, "position");

create index if not exists idx_listing_views_listing_id on public.listing_views(listing_id);
create index if not exists idx_listing_views_viewer_id on public.listing_views(viewer_id);

revoke execute on function public.admin_listing_reports() from anon;
revoke execute on function public.admin_listing_reports_v2() from anon;
revoke execute on function public.admin_dashboard_stats() from anon;
revoke execute on function public.admin_recent_activity() from anon;
revoke execute on function public.admin_users() from anon;
revoke execute on function public.admin_users_v2() from anon;
revoke execute on function public.admin_set_user_block(uuid,boolean,text,timestamptz) from anon;

create or replace function private.validate_listing_image()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  owner_id uuid;
  listing_status text;
  folder_prefix text;
begin
  select user_id,status into owner_id,listing_status
  from public.listings where id=new.listing_id;

  if auth.uid() is null or owner_id is distinct from auth.uid() or listing_status<>'pending' then
    raise exception 'Photos can only be added to your pending listing';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.listing_id::text));

  if new.position<0 or new.position>7 then
    raise exception 'Choose 1–8 photos';
  end if;

  folder_prefix := owner_id::text||'/'||new.listing_id::text||'/';

  if new.storage_path not like folder_prefix||'%'
     or new.storage_path !~* '\.(jpe?g|png|webp)$'
     or not exists(
       select 1 from storage.objects
       where bucket_id='listing-photos' and name=new.storage_path
     )
  then
    raise exception 'Photo must reference your uploaded image';
  end if;

  if new.thumb_path is not null and (
       new.thumb_path not like folder_prefix||'%'
       or new.thumb_path !~* '\.(jpe?g|png|webp)$'
       or not exists(
         select 1 from storage.objects
         where bucket_id='listing-photos' and name=new.thumb_path
       )
  ) then
    raise exception 'Thumbnail must reference your uploaded image';
  end if;

  if (select count(*) from public.listing_images
      where listing_id=new.listing_id and id<>new.id) >= 8 then
    raise exception 'Maximum 8 photos';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_private_listing_insert()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if auth.uid() is null or auth.uid()<>new.user_id then
    raise exception 'You can only create your own listings.';
  end if;

  if exists(
    select 1 from public.user_moderation
    where user_id=new.user_id and is_blocked
      and (blocked_until is null or blocked_until>now())
  ) then
    raise exception 'Your account is blocked from publishing listings.';
  end if;

  if new.status<>'pending' then
    raise exception 'New listings must be pending.';
  end if;

  if nullif(btrim(new.make),'') is null
     or nullif(btrim(new.model),'') is null
     or nullif(btrim(new.fuel),'') is null then
    raise exception 'Make, model and fuel are required.';
  end if;

  if coalesce(
      nullif(btrim(new.seller_phone),''),
      nullif(btrim(new.seller_email),''),
      nullif(btrim(new.seller_telegram),'')
  ) is null then
    raise exception 'A seller contact is required.';
  end if;

  if char_length(new.make)>80
     or char_length(new.model)>120
     or char_length(new.seller_name)>160 then
    raise exception 'Listing text is too long.';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  if exists(
    select 1 from public.listings
    where user_id=new.user_id and created_at > now()-interval '30 seconds'
  ) then
    raise exception 'Please wait before creating another listing.';
  end if;

  if (
    select count(*) from public.listings
    where user_id=new.user_id and created_at >= date_trunc('day',now())
  ) >= 6 then
    raise exception 'Daily listing creation limit reached.';
  end if;

  if (
    select count(*) from public.listings
    where user_id=new.user_id and status in ('pending','active')
  ) >= 3 then
    raise exception 'Private seller listing limit reached.';
  end if;

  return new;
end;
$$;

create or replace function private.enforce_listing_report_insert()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if auth.uid() is null or new.reporter_id<>auth.uid() then
    raise exception 'You can only submit your own report.';
  end if;

  if not exists(
    select 1 from public.listings
    where id=new.listing_id and status='active'
  ) then
    raise exception 'Only active listings can be reported.';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.reporter_id::text));

  if exists(
    select 1 from public.listing_reports
    where reporter_id=new.reporter_id
      and created_at > now()-interval '20 seconds'
  ) then
    raise exception 'Please wait before submitting another report.';
  end if;

  if (
    select count(*) from public.listing_reports
    where reporter_id=new.reporter_id
      and created_at > now()-interval '1 hour'
  ) >= 10 then
    raise exception 'Report rate limit reached. Try again later.';
  end if;

  if (
    select count(*) from public.listing_reports
    where reporter_id=new.reporter_id
      and created_at >= date_trunc('day',now())
  ) >= 30 then
    raise exception 'Daily report limit reached.';
  end if;

  new.reason := left(btrim(new.reason),120);
  if char_length(new.reason)<3 then
    raise exception 'Report reason is too short.';
  end if;

  new.details := case when new.details is null then null else left(btrim(new.details),1000) end;
  new.status := 'open';
  return new;
end;
$$;

drop trigger if exists trg_listing_report_rate_limit on public.listing_reports;
create trigger trg_listing_report_rate_limit
before insert on public.listing_reports
for each row execute function private.enforce_listing_report_insert();

create table if not exists public.storage_cleanup_queue(
  id bigint generated by default as identity primary key,
  bucket_id text not null default 'listing-photos',
  object_path text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  attempts int not null default 0,
  last_error text,
  unique(bucket_id,object_path)
);

alter table public.storage_cleanup_queue enable row level security;
revoke all on public.storage_cleanup_queue from public,anon,authenticated;
grant select,insert,update,delete on public.storage_cleanup_queue to service_role;

create index if not exists idx_storage_cleanup_pending
  on public.storage_cleanup_queue(processed_at,created_at)
  where processed_at is null;

create or replace function private.queue_listing_image_cleanup()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if tg_op='DELETE' or new.storage_path is distinct from old.storage_path then
    if old.storage_path is not null and old.storage_path !~* '^https?://' then
      insert into public.storage_cleanup_queue(bucket_id,object_path)
      values('listing-photos',old.storage_path)
      on conflict(bucket_id,object_path) do update
        set processed_at=null,last_error=null;
    end if;
  end if;

  if tg_op='DELETE' or new.thumb_path is distinct from old.thumb_path then
    if old.thumb_path is not null and old.thumb_path !~* '^https?://' then
      insert into public.storage_cleanup_queue(bucket_id,object_path)
      values('listing-photos',old.thumb_path)
      on conflict(bucket_id,object_path) do update
        set processed_at=null,last_error=null;
    end if;
  end if;

  return coalesce(new,old);
end;
$$;

drop trigger if exists trg_listing_image_cleanup on public.listing_images;
create trigger trg_listing_image_cleanup
after delete or update of storage_path,thumb_path on public.listing_images
for each row execute function private.queue_listing_image_cleanup();

create or replace function public.admin_health_stats()
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
declare result jsonb;
begin
  if not exists(select 1 from public.admins where user_id=auth.uid()) then
    raise exception 'Admin access required';
  end if;

  select jsonb_build_object(
    'pending_storage_cleanup',(select count(*) from public.storage_cleanup_queue where processed_at is null),
    'failed_storage_cleanup',(select count(*) from public.storage_cleanup_queue where processed_at is null and attempts>=3),
    'client_errors_today',coalesce((select sum(event_count) from public.site_event_daily where day=(now() at time zone 'utc')::date and event_name='client_error'),0),
    'page_views_today',coalesce((select sum(event_count) from public.site_event_daily where day=(now() at time zone 'utc')::date and event_name='page_view'),0),
    'listings_created_24h',(select count(*) from public.listings where created_at>now()-interval '24 hours'),
    'reports_created_24h',(select count(*) from public.listing_reports where created_at>now()-interval '24 hours')
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_health_stats() from public,anon;
grant execute on function public.admin_health_stats() to authenticated;
