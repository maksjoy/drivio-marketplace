-- Telegram admin console v2: Telegram-aware user/report context.
create or replace function public.admin_users_v2()
returns table(
  user_id uuid,
  email text,
  display_name text,
  telegram_username text,
  login_provider text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  listings_count bigint,
  active_listings_count bigint,
  reports_received bigint,
  is_blocked boolean,
  block_reason text,
  blocked_until timestamptz
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth'
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    u.id,
    case when ta.user_id is not null then null else u.email::text end,
    coalesce(ta.display_name,p.display_name,u.raw_user_meta_data->>'display_name',split_part(u.email::text,'@',1),'User')::text,
    ta.username::text,
    coalesce(u.raw_app_meta_data->>'login_provider',case when ta.user_id is not null then 'telegram' else 'email' end)::text,
    u.created_at,
    u.last_sign_in_at,
    (select count(*) from public.listings l where l.user_id=u.id),
    (select count(*) from public.listings l where l.user_id=u.id and l.status='active'),
    (select count(*) from public.listing_reports r join public.listings l on l.id=r.listing_id where l.user_id=u.id),
    coalesce(um.is_blocked,false) and (um.blocked_until is null or um.blocked_until > now()),
    um.reason,
    um.blocked_until
  from auth.users u
  left join public.profiles p on p.id=u.id
  left join public.telegram_accounts ta on ta.user_id=u.id
  left join public.user_moderation um on um.user_id=u.id
  order by u.created_at desc;
end;
$$;
revoke all on function public.admin_users_v2() from public,anon;
grant execute on function public.admin_users_v2() to authenticated;

create or replace function public.admin_listing_reports_v2()
returns table(
  report_id bigint,
  listing_id uuid,
  reason text,
  details text,
  report_status text,
  reported_at timestamptz,
  reporter_id uuid,
  reporter_name text,
  reporter_email text,
  reporter_telegram text,
  listing_make text,
  listing_model text,
  listing_year integer,
  listing_price numeric,
  listing_status text,
  seller_name text,
  seller_telegram text,
  image_path text
)
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth'
as $$
begin
  if not exists (select 1 from public.admins a where a.user_id = auth.uid()) then
    raise exception 'Admin access required';
  end if;

  return query
  select
    r.id,
    r.listing_id,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    r.reporter_id,
    coalesce(ta.display_name,p.display_name,u.email,'User')::text,
    case when ta.user_id is not null then null else u.email::text end,
    ta.username::text,
    l.make,
    l.model,
    l.year,
    l.price::numeric,
    l.status,
    l.seller_name,
    l.seller_telegram,
    (
      select coalesce(li.thumb_path,li.storage_path)
      from public.listing_images li
      where li.listing_id=l.id
      order by li.position asc
      limit 1
    )
  from public.listing_reports r
  join public.listings l on l.id=r.listing_id
  left join public.profiles p on p.id=r.reporter_id
  left join auth.users u on u.id=r.reporter_id
  left join public.telegram_accounts ta on ta.user_id=r.reporter_id
  order by case when r.status='open' then 0 else 1 end,r.created_at desc;
end;
$$;
revoke all on function public.admin_listing_reports_v2() from public,anon;
grant execute on function public.admin_listing_reports_v2() to authenticated;
