revoke execute on function public.record_listing_view(uuid) from anon;
grant execute on function public.record_listing_view(uuid) to authenticated;

drop policy if exists "Admins can manage user moderation" on public.user_moderation;
drop policy if exists "Admins can read user moderation" on public.user_moderation;
drop policy if exists "Users read own moderation" on public.user_moderation;

create policy "Read own moderation or admin"
on public.user_moderation for select
to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
);

create policy "Admins insert user moderation"
on public.user_moderation for insert
to authenticated
with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins update user moderation"
on public.user_moderation for update
to authenticated
using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins delete user moderation"
on public.user_moderation for delete
to authenticated
using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
