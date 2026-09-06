-- Run this ONCE in the existing AlbertaCars Supabase project.
-- It upgrades the old schema without deleting listings.

alter table public.listings add column if not exists seller_telegram text;
alter table public.listings alter column body_type drop not null;
alter table public.listings alter column transmission drop not null;
alter table public.listings alter column drivetrain drop not null;
alter table public.listings alter column city drop not null;
alter table public.listings alter column color drop not null;
alter table public.listings alter column description drop not null;

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create index if not exists idx_favorites_user_created on public.favorites (user_id, created_at desc);
alter table public.favorites enable row level security;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1), 'User')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, ''), '@', 1), 'User')
from auth.users u
on conflict (id) do nothing;

create or replace function public.enforce_private_listing_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  open_count integer;
begin
  if new.status <> 'pending' then
    raise exception 'New listings must start as pending';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  select count(*) into open_count
  from public.listings
  where user_id = new.user_id
    and status in ('pending', 'active');

  if open_count >= 3 then
    raise exception 'Private seller listing limit reached';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_private_listing_insert on public.listings;
create trigger trg_enforce_private_listing_insert
  before insert on public.listings
  for each row execute function public.enforce_private_listing_insert();

create or replace function public.restrict_owner_listing_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() = old.user_id then
    if (to_jsonb(new) - array['status', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['status', 'updated_at']) then
      raise exception 'Owners may only change listing status';
    end if;

    if new.status not in ('sold', 'removed') then
      raise exception 'Owners may only mark listings sold or removed';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_restrict_owner_listing_update on public.listings;
create trigger trg_restrict_owner_listing_update
  before update on public.listings
  for each row execute function public.restrict_owner_listing_update();

drop policy if exists "Owners can insert their own listings" on public.listings;
drop policy if exists "Owners can insert pending listings" on public.listings;
create policy "Owners can insert pending listings"
  on public.listings for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Owners can update their own listings" on public.listings;
drop policy if exists "Owners can mark listings sold or removed" on public.listings;
create policy "Owners can mark listings sold or removed"
  on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('sold', 'removed'));

drop policy if exists "Users manage their favorites" on public.favorites;
create policy "Users manage their favorites"
  on public.favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-photos',
  'listing-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public listing photo reads" on storage.objects;
create policy "Public listing photo reads"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "Users upload listing photos to own folder" on storage.objects;
create policy "Users upload listing photos to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete listing photos from own folder" on storage.objects;
create policy "Users delete listing photos from own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
