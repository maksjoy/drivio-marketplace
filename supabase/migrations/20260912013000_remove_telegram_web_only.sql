-- P2PCars is a web-only marketplace. Remove Telegram-specific auth/contact infrastructure.

-- Listings that only had a Telegram contact cannot remain publicly actionable.
update public.listings
set status='removed', updated_at=now()
where seller_telegram is not null
  and nullif(btrim(seller_phone),'') is null
  and (nullif(btrim(seller_email),'') is null or seller_email like '%@telegram.invalid');

-- Existing synthetic Telegram auth identities are disabled, not cascaded, so marketplace history/listings survive.
update auth.users
set raw_app_meta_data = (coalesce(raw_app_meta_data,'{}'::jsonb) - 'telegram_id' - 'telegram_username' - 'login_provider') || '{"login_provider":"disabled"}'::jsonb,
    banned_until = greatest(coalesce(banned_until, now()), now() + interval '100 years')
where coalesce(raw_app_meta_data->>'login_provider','')='telegram'
   or email like '%@telegram.invalid';

-- Remove Telegram-specific triggers and functions first.
drop trigger if exists a_enforce_telegram_contact on public.listings;
drop trigger if exists sync_telegram_contact on public.telegram_accounts;
drop function if exists private.enforce_telegram_contact();
drop function if exists private.sync_telegram_contact();
drop function if exists public.admin_users_v2();
drop function if exists public.admin_listing_reports_v2();
drop function if exists public.get_telegram_webhook_secret_for_setup();
drop function if exists public.verify_telegram_setup_secret(text);
drop function if exists public.verify_telegram_webhook_secret(text);

-- Web-only insert guard: phone or email is required.
create or replace function private.enforce_private_listing_insert()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if auth.uid() is null or auth.uid()<>new.user_id then
    raise exception 'You can only create your own listings.';
  end if;
  if exists(
    select 1 from public.user_moderation
    where user_id=new.user_id and is_blocked
      and (blocked_until is null or blocked_until>now())
  ) then
    raise exception 'Your account is blocked from publishing listings.';
  end if;
  if new.status<>'pending' then
    raise exception 'New listings must be pending.';
  end if;
  if nullif(btrim(new.make),'') is null
     or nullif(btrim(new.model),'') is null
     or nullif(btrim(new.fuel),'') is null then
    raise exception 'Make, model and fuel are required.';
  end if;
  if coalesce(nullif(btrim(new.seller_phone),''), nullif(btrim(new.seller_email),'')) is null then
    raise exception 'A phone number or email address is required.';
  end if;
  if char_length(new.make)>80 or char_length(new.model)>120 or char_length(new.seller_name)>160 then
    raise exception 'Listing text is too long.';
  end if;
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));
  if exists(select 1 from public.listings where user_id=new.user_id and created_at>now()-interval '30 seconds') then
    raise exception 'Please wait before creating another listing.';
  end if;
  if (select count(*) from public.listings where user_id=new.user_id and created_at>=date_trunc('day',now()))>=6 then
    raise exception 'Daily listing creation limit reached.';
  end if;
  if (select count(*) from public.listings where user_id=new.user_id and status in ('pending','active'))>=3 then
    raise exception 'Private seller listing limit reached.';
  end if;
  return new;
end;
$$;

-- Owner edit guard without Telegram fields.
create or replace function private.restrict_owner_listing_update()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  admin_user boolean;
  owner_edit boolean;
begin
  admin_user := exists(select 1 from public.admins where user_id=auth.uid());
  if new.user_id<>old.user_id then raise exception 'Listing owner cannot be changed'; end if;

  if auth.uid()=old.user_id and not admin_user then
    if old.status='sold' then
      raise exception 'Sold listings cannot be edited. Use Delete listing to remove it immediately.';
    end if;

    owner_edit :=
      new.seller_phone is distinct from old.seller_phone or
      new.seller_email is distinct from old.seller_email or
      new.make is distinct from old.make or new.model is distinct from old.model or
      new.year is distinct from old.year or new.price is distinct from old.price or
      new.mileage is distinct from old.mileage or new.body_type is distinct from old.body_type or
      new.transmission is distinct from old.transmission or new.fuel is distinct from old.fuel or
      new.drivetrain is distinct from old.drivetrain or new.city is distinct from old.city or
      new.color is distinct from old.color or new.engine is distinct from old.engine or
      new.description is distinct from old.description or new.features is distinct from old.features;

    if owner_edit or new.status='pending' then
      if new.status<>'pending' then raise exception 'Edited listings must return to review'; end if;
      if new.seller_name is distinct from old.seller_name
         or new.created_at is distinct from old.created_at
         or new.rejection_reason is not null
         or new.sold_at is distinct from old.sold_at then
        raise exception 'Protected listing fields cannot be edited';
      end if;
      if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then
        raise exception 'Blocked sellers cannot edit listings';
      end if;
      perform pg_advisory_xact_lock(hashtext(new.user_id::text));
      if old.status not in ('pending','active') and
         (select count(*) from public.listings where user_id=new.user_id and id<>new.id and status in ('pending','active'))>=3 then
        raise exception 'listing limit reached';
      end if;
      new.rejection_reason:=null;
    elsif new.status='sold' then
      if old.status not in ('active','pending') then raise exception 'Only active or pending listings can be marked sold'; end if;
      if (to_jsonb(new)-array['status','updated_at','sold_at']) is distinct from (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Marking sold can only change listing status';
      end if;
    elsif new.status='removed' then
      if (to_jsonb(new)-array['status','updated_at','sold_at']) is distinct from (to_jsonb(old)-array['status','updated_at','sold_at']) then
        raise exception 'Remove can only change listing status';
      end if;
    else
      raise exception 'Owners may edit for review, mark sold, or remove listings';
    end if;
  end if;

  if new.status='active' and old.status<>'active' then
    if exists(select 1 from public.user_moderation where user_id=new.user_id and is_blocked and (blocked_until is null or blocked_until>now())) then
      raise exception 'Blocked sellers cannot have active listings';
    end if;
    perform pg_advisory_xact_lock(hashtext(new.user_id::text));
    if (select count(*) from public.listings where user_id=new.user_id and id<>new.id and status in ('pending','active'))>=3 then
      raise exception 'listing limit reached';
    end if;
    if not exists(select 1 from public.listing_images where listing_id=new.id) then
      raise exception 'Upload at least one photo before activation';
    end if;
  end if;
  return new;
end;
$$;

-- Drop Telegram data surfaces from marketplace schema.
drop table if exists public.telegram_accounts;
alter table public.listings drop column if exists seller_telegram;

-- Remove Telegram-only Vault material created by the retired integration.
delete from vault.secrets where name in ('p2pcars_telegram_webhook_secret','p2pcars_telegram_setup_secret');
