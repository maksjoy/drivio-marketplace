-- Listing photos are private objects. Public/owner/admin access is granted by RLS and signed URLs.
update storage.buckets
set public=false
where id='listing-photos';

drop policy if exists "Public listing photo reads" on storage.objects;
drop policy if exists "Private listing photo reads" on storage.objects;

create policy "Private listing photo reads"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id='listing-photos'
  and exists (
    select 1
    from public.listing_images li
    join public.listings l on l.id=li.listing_id
    where (li.storage_path=storage.objects.name or li.thumb_path=storage.objects.name)
      and (
        l.status='active'
        or (l.status='sold' and l.sold_at>now()-interval '14 days')
        or l.user_id=(select auth.uid())
        or exists(select 1 from public.admins a where a.user_id=(select auth.uid()))
      )
  )
);
