-- Listing photos stay private. Anonymous and signed-in clients may create and
-- download short-lived signed URLs only. Direct authenticated-path reads and
-- bucket listing are denied.
--
-- APPLY ORDER
-- 1. Deploy the app commit that serves photos with createSignedUrls.
--    This file is also safe on the previous app, which already signs URLs.
-- 2. Apply THIS file first, in one transaction:
--      psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/migrations/20261023210000_signed_url_only_listing_photos.sql
-- 3. Confirm photos still load, then apply 20261023211000_hide_listing_owner_from_anon.sql.
--
-- The app keeps working before this file (the old SELECT policy still allows
-- sign/sign_many) and after it (only sign, sign_many, get_signed, and
-- image_sign remain). Upload still uses the existing INSERT policy and
-- uploadToSignedUrl, which is not a SELECT.
--
-- If signed URLs stop working, roll this file back immediately with the
-- statement at the bottom of this file. Do not apply the owner-column file
-- until photos load again.
--
-- The anon policy does not read listings.user_id, so the later column-grant
-- migration cannot break public photo signing.

do $$
begin
  if to_regprocedure('storage.operation()') is null then
    raise exception 'storage.operation() is missing; refusing to restrict listing photos to signed URLs';
  end if;
end $$;

create or replace function storage.allow_only_operation(expected_operation text)
returns boolean
language sql
stable
as $$
  with current_operation as (
    select storage.operation() as raw_operation
  ),
  normalized as (
    select
      case
        when raw_operation like 'storage.%' then substr(raw_operation, 9)
        else raw_operation
      end as current_operation,
      case
        when expected_operation like 'storage.%' then substr(expected_operation, 9)
        else expected_operation
      end as requested_operation
    from current_operation
  )
  select case
    when requested_operation is null or requested_operation = '' then false
    else coalesce(current_operation = requested_operation, false)
  end
  from normalized;
$$;

create or replace function storage.allow_any_operation(expected_operations text[])
returns boolean
language sql
stable
as $$
  with current_operation as (
    select storage.operation() as raw_operation
  ),
  normalized as (
    select case
      when raw_operation like 'storage.%' then substr(raw_operation, 9)
      else raw_operation
    end as current_operation
    from current_operation
  )
  select exists (
    select 1
    from normalized n
    cross join lateral unnest(expected_operations) as expected_operation
    where expected_operation is not null
      and expected_operation <> ''
      and n.current_operation = case
        when expected_operation like 'storage.%' then substr(expected_operation, 9)
        else expected_operation
      end
  );
$$;

grant execute on function storage.operation() to anon, authenticated, service_role;
grant execute on function storage.allow_only_operation(text) to anon, authenticated, service_role;
grant execute on function storage.allow_any_operation(text[]) to anon, authenticated, service_role;

drop policy if exists "Public listing photo reads" on storage.objects;
drop policy if exists "Private listing photo reads" on storage.objects;
drop policy if exists "Signed URL reads for public listing photos" on storage.objects;
drop policy if exists "Signed URL reads for member listing photos" on storage.objects;

create policy "Signed URL reads for public listing photos"
on storage.objects
for select
to anon
using (
  bucket_id = 'listing-photos'
  and storage.allow_any_operation(array[
    'storage.object.sign',
    'storage.object.sign_many',
    'storage.object.get_signed',
    'storage.render.image_sign'
  ])
  and exists (
    select 1
    from public.listing_images li
    join public.listings l on l.id = li.listing_id
    where (li.storage_path = storage.objects.name or li.thumb_path = storage.objects.name)
      and (
        l.status = 'active'
        or (l.status = 'sold' and l.sold_at > now() - interval '14 days')
      )
  )
);

create policy "Signed URL reads for member listing photos"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'listing-photos'
  and storage.allow_any_operation(array[
    'storage.object.sign',
    'storage.object.sign_many',
    'storage.object.get_signed',
    'storage.render.image_sign'
  ])
  and exists (
    select 1
    from public.listing_images li
    join public.listings l on l.id = li.listing_id
    where (li.storage_path = storage.objects.name or li.thumb_path = storage.objects.name)
      and (
        l.status = 'active'
        or (l.status = 'sold' and l.sold_at > now() - interval '14 days')
        or l.user_id = (select auth.uid())
        or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
      )
  )
);

-- Rollback (run only if signed photo URLs break after this file):
-- begin;
-- drop policy if exists "Signed URL reads for public listing photos" on storage.objects;
-- drop policy if exists "Signed URL reads for member listing photos" on storage.objects;
-- create policy "Private listing photo reads"
-- on storage.objects for select to anon, authenticated
-- using (
--   bucket_id = 'listing-photos'
--   and exists (
--     select 1
--     from public.listing_images li
--     join public.listings l on l.id = li.listing_id
--     where (li.storage_path = storage.objects.name or li.thumb_path = storage.objects.name)
--       and (
--         l.status = 'active'
--         or (l.status = 'sold' and l.sold_at > now() - interval '14 days')
--         or l.user_id = (select auth.uid())
--         or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
--       )
--   )
-- );
-- commit;
