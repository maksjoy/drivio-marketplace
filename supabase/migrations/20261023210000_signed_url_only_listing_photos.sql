-- Listing photos stay private. Anonymous and signed-in clients may create and
-- download short-lived signed URLs only. Direct authenticated-path reads and
-- bucket listing are denied.
--
-- Applied to the live project on 2026-10-23 and recorded in
-- supabase_migrations.schema_migrations. The first draft created
-- storage.allow_only_operation and storage.allow_any_operation. That failed
-- with "permission denied for schema storage". The installed file does not
-- create functions in schema storage and does not grant them. The operation
-- check is inlined in both policies: strip a leading "storage." from
-- storage.operation(), then allow only object.sign, object.sign_many,
-- object.get_signed, and render.image_sign.
--
-- Do not apply this file again on the live project. On a new database it is
-- safe once, after the app is serving photos with createSignedUrls. It does
-- not read listings.user_id, so the later column-grant migration cannot break
-- public photo signing.
--
-- If signed URLs stop working, roll back with the comment at the bottom.
-- That restores the live read policy name, "Read authorized listing photos".

do $$
begin
  if to_regprocedure('storage.operation()') is null then
    raise exception 'storage.operation() is missing; refusing to restrict listing photos to signed URLs';
  end if;
end $$;

drop policy if exists "Public listing photo reads" on storage.objects;
drop policy if exists "Private listing photo reads" on storage.objects;
drop policy if exists "Read authorized listing photos" on storage.objects;
drop policy if exists "Signed URL reads for public listing photos" on storage.objects;
drop policy if exists "Signed URL reads for member listing photos" on storage.objects;

create policy "Signed URL reads for public listing photos"
on storage.objects
for select
to anon
using (
  bucket_id = 'listing-photos'
  and (
    select case
      when raw_operation like 'storage.%' then substr(raw_operation, 9)
      else raw_operation
    end
    from (select storage.operation() as raw_operation) as current_operation
  ) in (
    'object.sign',
    'object.sign_many',
    'object.get_signed',
    'render.image_sign'
  )
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
  and (
    select case
      when raw_operation like 'storage.%' then substr(raw_operation, 9)
      else raw_operation
    end
    from (select storage.operation() as raw_operation) as current_operation
  ) in (
    'object.sign',
    'object.sign_many',
    'object.get_signed',
    'render.image_sign'
  )
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
-- drop policy if exists "Private listing photo reads" on storage.objects;
-- drop policy if exists "Read authorized listing photos" on storage.objects;
-- create policy "Read authorized listing photos"
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
