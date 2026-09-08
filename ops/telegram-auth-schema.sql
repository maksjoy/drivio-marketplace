-- Additive shared-backend support. Website users and existing admin membership are unchanged.
create table if not exists public.telegram_accounts (
 telegram_id text primary key check (telegram_id ~ '^[0-9]{1,20}$'),
 user_id uuid not null unique references auth.users(id) on delete cascade,
 username text check (username is null or username ~ '^[A-Za-z][A-Za-z0-9_]{3,31}$'),
 display_name text not null,
 last_auth_at timestamptz not null default 'epoch',
 created_at timestamptz not null default now()
);
alter table public.telegram_accounts enable row level security;
revoke all on public.telegram_accounts from public,anon,authenticated;
grant select,insert,update,delete on public.telegram_accounts to service_role;

-- Internal lookup bypasses RLS only on the private identity mapping. Listing RLS still applies.
create or replace function private.enforce_telegram_contact() returns trigger
language plpgsql security definer set search_path='' as $$
declare contact text; linked boolean;
begin
 if auth.uid() is not null and auth.uid()<>new.user_id
    and not exists(select 1 from public.admins where user_id=auth.uid()) then
   raise exception 'You can only change your own listings.';
 end if;
 select true,username into linked,contact from public.telegram_accounts where user_id=new.user_id;
 if linked then
  if (tg_op='INSERT' or new.status in ('pending','active')) and contact is null then
   raise exception 'Set a public Telegram username and reopen the Mini App before posting.';
  end if;
  new.seller_telegram:=contact;
  new.seller_phone:=null;
  new.seller_email:=null;
 end if;
 return new;
end; $$;
revoke all on function private.enforce_telegram_contact() from public,anon,authenticated;
drop trigger if exists a_enforce_telegram_contact on public.listings;
create trigger a_enforce_telegram_contact before insert or update on public.listings
for each row execute function private.enforce_telegram_contact();

-- Inactive listings may lose their contact when a Telegram username is removed.
-- Pending/active listings retain the original mandatory-contact requirement.
alter table public.listings drop constraint if exists listings_contact_required;
alter table public.listings add constraint listings_contact_required check (
 seller_phone is not null or seller_email is not null or seller_telegram is not null
 or status in ('removed','sold','rejected')
);

-- Keep a username change and all associated contact links in the same transaction.
create or replace function private.sync_telegram_contact() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.username is distinct from old.username then
  update public.listings
  set seller_telegram=new.username, seller_phone=null, seller_email=null,
      status=case when new.username is null and status in ('active','pending') then 'removed' else status end,
      updated_at=now()
  where user_id=new.user_id;
 end if;
 return new;
end; $$;
revoke all on function private.sync_telegram_contact() from public,anon,authenticated;
grant execute on function private.sync_telegram_contact() to service_role;
drop trigger if exists sync_telegram_contact on public.telegram_accounts;
create trigger sync_telegram_contact after update of username on public.telegram_accounts
for each row execute function private.sync_telegram_contact();
