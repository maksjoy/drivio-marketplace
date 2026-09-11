alter table public.listings
  add column if not exists sold_at timestamptz;

update public.listings
set sold_at = coalesce(sold_at, updated_at, now())
where status='sold' and sold_at is null;

create index if not exists idx_listings_sold_cleanup
  on public.listings(sold_at)
  where status='sold';

create or replace function private.set_listing_sold_at()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='sold' and old.status is distinct from 'sold' then
    new.sold_at := now();
  elsif new.status<>'sold' then
    new.sold_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists zz_set_listing_sold_at on public.listings;
create trigger zz_set_listing_sold_at
before update of status on public.listings
for each row execute function private.set_listing_sold_at();

create or replace function private.restrict_owner_listing_update()
returns trigger
language plpgsql
set search_path=''
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
    if old.status='sold' then
      raise exception 'Sold listings cannot be edited. Use Delete listing to remove it immediately.';
    end if;

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
         or new.rejection_reason is not null
         or new.sold_at is distinct from old.sold_at then
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
    elsif new.status='sold' then
      if old.status not in ('active','pending') then
        raise exception 'Only active or pending listings can be marked sold';
      end if;
      if (to_jsonb(new)-array['status','updated_at','sold_at'])
         is distinct from
         (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Marking sold can only change listing status';
      end if;
    elsif new.status='removed' then
      if (to_jsonb(new)-array['status','updated_at','sold_at'])
         is distinct from
         (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Remove can only change listing status';
      end if;
    else
      raise exception 'Owners may edit for review, mark sold, or remove listings';
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

drop policy if exists "Anyone can read active listings" on public.listings;
create policy "Anyone can read active and recent sold listings"
on public.listings for select to anon
using (
  status='active'
  or (status='sold' and sold_at > now()-interval '14 days')
);

drop policy if exists "Signed-in users can read active own or admin listings" on public.listings;
create policy "Signed-in users can read public own or admin listings"
on public.listings for select to authenticated
using (
  status='active'
  or (status='sold' and sold_at > now()-interval '14 days')
  or auth.uid()=user_id
  or exists(select 1 from public.admins a where a.user_id=auth.uid())
);

drop policy if exists "Anyone can read images of active listings" on public.listing_images;
create policy "Anyone can read images of public listings"
on public.listing_images for select to anon
using (
  exists(
    select 1 from public.listings l
    where l.id=listing_images.listing_id
      and (
        l.status='active'
        or (l.status='sold' and l.sold_at > now()-interval '14 days')
      )
  )
);

drop policy if exists "Signed-in users can read active or owned images" on public.listing_images;
create policy "Signed-in users can read public owned or admin images"
on public.listing_images for select to authenticated
using (
  exists(
    select 1 from public.listings l
    where l.id=listing_images.listing_id
      and (
        l.status='active'
        or (l.status='sold' and l.sold_at > now()-interval '14 days')
        or l.user_id=auth.uid()
        or exists(select 1 from public.admins a where a.user_id=auth.uid())
      )
  )
);

create or replace function public.record_listing_view(target_listing uuid)
returns void
language plpgsql
security definer
set search_path='pg_catalog','public'
as $$
begin
  if not exists (
    select 1 from public.listings l
    where l.id = target_listing
      and (
        l.status='active'
        or (l.status='sold' and l.sold_at > now()-interval '14 days')
      )
  ) then
    return;
  end if;

  insert into public.listing_view_daily(listing_id, day, view_count)
  values(target_listing, (now() at time zone 'utc')::date, 1)
  on conflict (listing_id, day) do update
    set view_count = public.listing_view_daily.view_count + 1;
end;
$$;

select cron.schedule(
  'p2pcars-delete-old-sold-listings',
  '17 * * * *',
  $$
    delete from public.listings
    where status='sold'
      and sold_at <= now()-interval '14 days';
  $$
);
