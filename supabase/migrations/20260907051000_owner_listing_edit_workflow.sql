create or replace function private.restrict_owner_listing_update()
returns trigger
language plpgsql
set search_path to ''
as $$
declare
  admin_user boolean;
  owner_edit boolean;
begin
  admin_user := exists(select 1 from public.admins where user_id = auth.uid());

  if new.user_id <> old.user_id then
    raise exception 'Listing owner cannot be changed';
  end if;

  if auth.uid() = old.user_id and not admin_user then
    owner_edit :=
      new.seller_phone is distinct from old.seller_phone or
      new.seller_email is distinct from old.seller_email or
      new.seller_telegram is distinct from old.seller_telegram or
      new.make is distinct from old.make or
      new.model is distinct from old.model or
      new.year is distinct from old.year or
      new.price is distinct from old.price or
      new.mileage is distinct from old.mileage or
      new.body_type is distinct from old.body_type or
      new.transmission is distinct from old.transmission or
      new.fuel is distinct from old.fuel or
      new.drivetrain is distinct from old.drivetrain or
      new.city is distinct from old.city or
      new.color is distinct from old.color or
      new.engine is distinct from old.engine or
      new.description is distinct from old.description or
      new.features is distinct from old.features;

    if owner_edit or new.status = 'pending' then
      if new.status <> 'pending' then
        raise exception 'Edited listings must return to review';
      end if;
      if new.seller_name is distinct from old.seller_name
         or new.created_at is distinct from old.created_at
         or new.rejection_reason is not null then
        raise exception 'Protected listing fields cannot be edited';
      end if;
      if exists(
        select 1 from public.user_moderation
        where user_id = new.user_id
          and is_blocked
          and (blocked_until is null or blocked_until > now())
      ) then
        raise exception 'Blocked sellers cannot edit listings';
      end if;
      perform pg_advisory_xact_lock(hashtext(new.user_id::text));
      if old.status not in ('pending','active')
         and (select count(*) from public.listings
              where user_id=new.user_id
                and id<>new.id
                and status in ('pending','active')) >= 3 then
        raise exception 'listing limit reached';
      end if;
      new.rejection_reason := null;
    elsif new.status in ('sold','removed') then
      if (to_jsonb(new)-array['status','updated_at'])
         is distinct from
         (to_jsonb(old)-array['status','updated_at']) then
        raise exception 'Sold/remove can only change listing status';
      end if;
    else
      raise exception 'Owners may edit for review or mark listings sold/removed';
    end if;
  end if;

  if new.status='active' and old.status<>'active' then
    if exists(select 1 from public.user_moderation
              where user_id=new.user_id
                and is_blocked
                and (blocked_until is null or blocked_until>now())) then
      raise exception 'Blocked sellers cannot have active listings';
    end if;
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (select count(*) from public.listings
        where user_id=new.user_id
          and id<>new.id
          and status in ('pending','active')) >= 3 then
      raise exception 'listing limit reached';
    end if;
    if not exists(select 1 from public.listing_images where listing_id=new.id) then
      raise exception 'Upload at least one photo before activation';
    end if;
  end if;
  return new;
end;
$$;

drop policy if exists "Owners or admins can update listings" on public.listings;
create policy "Owners or admins can update listings"
on public.listings for update
to authenticated
using (
  (select auth.uid()) = user_id
  or exists(select 1 from public.admins a where a.user_id=(select auth.uid()))
)
with check (
  (
    (select auth.uid()) = user_id
    and status in ('pending','sold','removed')
  )
  or exists(select 1 from public.admins a where a.user_id=(select auth.uid()))
);

drop policy if exists "Users upload listing photos to own folder" on storage.objects;
create policy "Users upload listing photos to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id='listing-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.listings l
    where l.id::text=(storage.foldername(name))[2]
      and l.user_id=(select auth.uid())
      and l.status in ('pending','active','sold','removed')
  )
  and not exists (
    select 1 from public.user_moderation m
    where m.user_id=(select auth.uid())
      and m.is_blocked
      and (m.blocked_until is null or m.blocked_until>now())
  )
);
