revoke execute on function public.admin_recent_activity() from anon;
revoke execute on function public.record_site_event(text,text) from anon;

drop policy if exists "Admins read daily listing views" on public.listing_view_daily;
create policy "Admins read daily listing views"
on public.listing_view_daily for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins read daily site events" on public.site_event_daily;
create policy "Admins read daily site events"
on public.site_event_daily for select
to authenticated
using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
