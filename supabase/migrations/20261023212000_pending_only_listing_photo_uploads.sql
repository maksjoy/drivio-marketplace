-- Owners may upload listing photos only while the listing is pending review.
--
-- 20260907051000_owner_listing_edit_workflow.sql allowed INSERT into
-- storage.objects for pending, active, sold, and removed listings. An owner
-- could fill an approved listing folder with new objects, and could upload
-- bytes at paths already registered in listing_images without returning the
-- listing to moderation.
--
-- Verified against the current app, not only the security note:
-- app/api/listings/route.ts creates the listing as pending, calls
-- createSignedUploadUrl, and only then inserts listing_images. The browser
-- uploadToSignedUrl in components/sell-form.tsx runs after that insert.
-- Supabase Storage's signUploadObjectUrl calls canUpload, which probes
-- INSERT under RLS before it issues the token. Requiring the path to already
-- exist in listing_images would reject that probe and break new listings.
-- A pending listing with fewer than 8 image rows may therefore still receive
-- a new object. That is the sign-time window, and it matches the app limit
-- of 8 photos. Once 8 images are registered, only those exact paths
-- (storage_path or thumb_path) can be uploaded. Owner content edits are
-- forced back to pending by private.restrict_owner_listing_update before a
-- replacement upload is allowed. Active, sold, and removed listings cannot
-- receive new objects. The app itself only marks sold or deletes; it does
-- not upload into an approved listing.
--
-- APPLY AFTER 20261023211000_hide_listing_owner_from_anon.sql.
-- The app keeps working before this file (uploads already target pending
-- listings) and after it.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--     -f supabase/migrations/20261023212000_pending_only_listing_photo_uploads.sql
--
-- Before:
--   select pg_get_expr(polwithcheck, polrelid) like '%sold%' as allows_sold
--   from pg_policy
--   where polrelid = 'storage.objects'::regclass
--     and polname = 'Users upload listing photos to own folder';
--   -- allows_sold = true
--
-- After:
--   select pg_get_expr(polwithcheck, polrelid) as upload_check
--   from pg_policy
--   where polrelid = 'storage.objects'::regclass
--     and polname = 'Users upload listing photos to own folder';
--   -- mentions pending, does not mention sold or active
--
-- Rollback: recreate the previous policy from
-- 20260907051000_owner_listing_edit_workflow.sql (status in
-- pending, active, sold, removed). The statement is at the bottom of this file.

drop policy if exists "Users upload listing photos to own folder" on storage.objects;

create policy "Users upload listing photos to own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1
    from public.listings l
    where l.id::text = (storage.foldername(name))[2]
      and l.user_id = (select auth.uid())
      and l.status = 'pending'
      and (
        exists (
          select 1
          from public.listing_images li
          where li.listing_id = l.id
            and (li.storage_path = name or li.thumb_path = name)
        )
        or (
          select count(*)
          from public.listing_images li
          where li.listing_id = l.id
        ) < 8
      )
  )
  and not exists (
    select 1
    from public.user_moderation m
    where m.user_id = (select auth.uid())
      and m.is_blocked
      and (m.blocked_until is null or m.blocked_until > now())
  )
);

-- Rollback:
-- drop policy if exists "Users upload listing photos to own folder" on storage.objects;
-- create policy "Users upload listing photos to own folder"
-- on storage.objects for insert to authenticated
-- with check (
--   bucket_id = 'listing-photos'
--   and (storage.foldername(name))[1] = (select auth.uid())::text
--   and exists (
--     select 1 from public.listings l
--     where l.id::text = (storage.foldername(name))[2]
--       and l.user_id = (select auth.uid())
--       and l.status in ('pending','active','sold','removed')
--   )
--   and not exists (
--     select 1 from public.user_moderation m
--     where m.user_id = (select auth.uid())
--       and m.is_blocked
--       and (m.blocked_until is null or m.blocked_until > now())
--   )
-- );
