-- Optimize the two public-read RLS policies flagged by Supabase advisor.
-- Wrapping auth.uid() in SELECT lets Postgres evaluate it once per statement
-- instead of once per row, while preserving the existing authorization model.

drop policy if exists "Signed-in users can read public own or admin listings" on public.listings;
create policy "Signed-in users can read public own or admin listings"
on public.listings
for select
to authenticated
using (
  status = 'active'
  or (status = 'sold' and sold_at > now() - interval '14 days')
  or (select auth.uid()) = user_id
  or exists (
    select 1
    from public.admins a
    where a.user_id = (select auth.uid())
  )
);

drop policy if exists "Signed-in users can read public owned or admin images" on public.listing_images;
create policy "Signed-in users can read public owned or admin images"
on public.listing_images
for select
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.status = 'active'
        or (l.status = 'sold' and l.sold_at > now() - interval '14 days')
        or l.user_id = (select auth.uid())
        or exists (
          select 1
          from public.admins a
          where a.user_id = (select auth.uid())
        )
      )
  )
);
