create or replace function public.admin_listing_reports()
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
  listing_make text,
  listing_model text,
  listing_year integer,
  listing_price numeric,
  listing_status text,
  seller_name text,
  image_path text
)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not exists (
    select 1 from public.admins a where a.user_id = auth.uid()
  ) then
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
    coalesce(p.display_name, u.email, 'User')::text,
    u.email::text,
    l.make,
    l.model,
    l.year,
    l.price,
    l.status,
    l.seller_name,
    (
      select coalesce(li.thumb_path, li.storage_path)
      from public.listing_images li
      where li.listing_id = l.id
      order by li.position asc
      limit 1
    ) as image_path
  from public.listing_reports r
  join public.listings l on l.id = r.listing_id
  left join public.profiles p on p.id = r.reporter_id
  left join auth.users u on u.id = r.reporter_id
  order by
    case when r.status = 'open' then 0 else 1 end,
    r.created_at desc;
end;
$$;

revoke all on function public.admin_listing_reports() from public;
grant execute on function public.admin_listing_reports() to authenticated;
