begin;
-- Applied only to the inspected, existing P2PCars database. No user rows are deleted.
revoke execute on function public.admin_users() from public, anon;
revoke execute on function public.admin_dashboard_stats() from public, anon;
revoke execute on function public.admin_set_user_block(uuid,boolean,text,timestamptz) from public, anon;
grant execute on function public.admin_users(),public.admin_dashboard_stats(),public.admin_set_user_block(uuid,boolean,text,timestamptz) to authenticated;
-- Existing admin RPCs deliberately retain their server-side admins-table check.
-- Owners must see their own moderation state for SECURITY INVOKER triggers to work.
drop policy if exists "Users read own moderation" on public.user_moderation;
create policy "Users read own moderation" on public.user_moderation for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Owners can insert own listings" on public.listings;
create policy "Owners can insert own listings" on public.listings for insert to authenticated with check (user_id=(select auth.uid()) and status='pending');
create or replace function private.enforce_private_listing_insert() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is null or auth.uid()<>new.user_id then raise exception 'You can only create your own listings.'; end if;
 if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then raise exception 'Your account is blocked from publishing listings.'; end if;
 if new.status<>'pending' then raise exception 'New listings must be pending.'; end if;
 if nullif(btrim(new.make),'') is null or nullif(btrim(new.model),'') is null or nullif(btrim(new.fuel),'') is null then raise exception 'Make, model and fuel are required.'; end if;
 if coalesce(nullif(btrim(new.seller_phone),''),nullif(btrim(new.seller_email),''),nullif(btrim(new.seller_telegram),'')) is null then raise exception 'A seller contact is required.'; end if;
 if char_length(new.make)>80 or char_length(new.model)>120 or char_length(new.seller_name)>160 then raise exception 'Listing text is too long.'; end if;
 perform pg_advisory_xact_lock(hashtext(new.user_id::text));
 if (select count(*) from public.listings where user_id=new.user_id and status in ('pending','active'))>=3 then raise exception 'listing limit reached'; end if;
 return new;
end;$$;
create or replace function private.restrict_owner_listing_update() returns trigger language plpgsql set search_path='' as $$
declare admin_user boolean;
begin
 admin_user:=exists(select 1 from public.admins where user_id=auth.uid());
 if auth.uid()=old.user_id and not admin_user then
  if (to_jsonb(new)-array['status','updated_at']) is distinct from (to_jsonb(old)-array['status','updated_at']) then raise exception 'Owners may only change listing status'; end if;
  if new.status not in ('sold','removed') then raise exception 'Owners may only mark listings sold or removed'; end if;
 end if;
 if new.user_id<>old.user_id then raise exception 'Listing owner cannot be changed'; end if;
 if new.status='active' and old.status<>'active' then
  if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then raise exception 'Blocked sellers cannot have active listings'; end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if (select count(*) from public.listings where user_id=new.user_id and id<>new.id and status in ('pending','active'))>=3 then raise exception 'listing limit reached'; end if;
  if not exists(select 1 from public.listing_images where listing_id=new.id) then raise exception 'Upload at least one photo before activation'; end if;
 end if;
 return new;
end;$$;
-- Admins need to inspect pending photographs before approving them.
drop policy if exists "Signed-in users can read active or owned images" on public.listing_images;
create policy "Signed-in users can read active or owned images" on public.listing_images for select to authenticated using (exists(select 1 from public.listings l where l.id=listing_id and (l.status='active' or l.user_id=(select auth.uid()) or exists(select 1 from public.admins a where a.user_id=(select auth.uid())))));
-- Image references must point to an existing upload owned by this seller.
create or replace function private.validate_listing_image() returns trigger language plpgsql set search_path='' as $$
declare owner_id uuid; listing_status text;
begin
 select user_id,status into owner_id,listing_status from public.listings where id=new.listing_id;
 if auth.uid() is null or owner_id is distinct from auth.uid() or listing_status<>'pending' then raise exception 'Photos can only be added to your pending listing'; end if;
 perform pg_advisory_xact_lock(hashtext(new.listing_id::text));
 if new.position<0 or new.position>7 then raise exception 'Choose 1–8 photos'; end if;
 if new.storage_path not like owner_id::text||'/'||new.listing_id::text||'/%' or not exists(select 1 from storage.objects where bucket_id='listing-photos' and name=new.storage_path) then raise exception 'Photo must reference your uploaded file'; end if;
 if (select count(*) from public.listing_images where listing_id=new.listing_id and id<>new.id)>=8 then raise exception 'Maximum 8 photos'; end if;
 return new;
end;$$;
drop trigger if exists validate_listing_image on public.listing_images;
create trigger validate_listing_image before insert or update on public.listing_images for each row execute function private.validate_listing_image();
drop policy if exists "Owners can update images for own listings" on public.listing_images;
drop policy if exists "Owners can delete images for own listings" on public.listing_images;
create policy "Owners can delete images for own listings" on public.listing_images for delete to authenticated using (exists(select 1 from public.listings l where l.id=listing_id and l.user_id=(select auth.uid()) and l.status<>'active'));
drop policy if exists "Users upload listing photos to own folder" on storage.objects;
create policy "Users upload listing photos to own folder" on storage.objects for insert to authenticated with check (bucket_id='listing-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and exists(select 1 from public.listings l where l.id::text=(storage.foldername(name))[2] and l.user_id=(select auth.uid()) and l.status='pending') and not exists(select 1 from public.user_moderation where user_id=(select auth.uid()) and is_blocked and (blocked_until is null or blocked_until>now())));
drop policy if exists "Users update listing photos in own folder" on storage.objects;
drop policy if exists "Users delete listing photos from own folder" on storage.objects;
create policy "Users delete listing photos from own folder" on storage.objects for delete to authenticated using (bucket_id='listing-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.listings l where l.id::text=(storage.foldername(name))[2] and l.status='active'));
drop policy if exists "Users can create own reports" on public.listing_reports;
create policy "Users can create own reports" on public.listing_reports for insert to authenticated with check (reporter_id=(select auth.uid()) and status='open' and exists(select 1 from public.listings where id=listing_id and status='active'));
-- Avoid publicly writable analytics tables as an unbounded anonymous spam endpoint.
-- Authenticated event capture remains useful, but these counts are not total visitors.
drop policy if exists "Anyone can create site events" on public.site_events;
create policy "Signed-in users create events" on public.site_events for insert to authenticated with check (user_id=(select auth.uid()) and event_name in ('page_view','client_error') and created_at between now()-interval '1 minute' and now()+interval '1 minute');
drop policy if exists "Anyone can insert listing views" on public.listing_views;
create policy "Signed-in users create views" on public.listing_views for insert to authenticated with check (viewer_id=(select auth.uid()) and exists(select 1 from public.listings where id=listing_id and status='active') and viewed_at between now()-interval '1 minute' and now()+interval '1 minute');
create index if not exists idx_user_moderation_updated_by on public.user_moderation(updated_by);
commit;
