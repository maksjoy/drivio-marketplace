-- AlbertaCars schema for a fresh Supabase project.
-- Safe defaults: new listings are always pending, owners cannot self-approve,
-- and the per-account pending/active listing limit is enforced in Postgres.

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  phone text,
  phone_verified boolean not null default false,
  is_dealer_flagged boolean not null default false,
  dealer_report_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_name text not null,
  seller_phone text,
  seller_email text,
  seller_telegram text,
  make text not null,
  model text not null,
  year int not null check (year between 1980 and 2100),
  price int not null check (price between 500 and 2000000),
  mileage int not null check (mileage between 0 and 2000000),
  body_type text,
  transmission text,
  fuel text not null,
  drivetrain text,
  city text,
  color text,
  engine text,
  description text check (description is null or char_length(description) <= 3000),
  features text[] not null default '{}',
  status text not null default 'pending'
    check (status in ('pending', 'active', 'sold', 'removed', 'rejected')),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  storage_path text not null,
  position int not null default 0
);

create table if not exists favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists dealer_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, reporter_id)
);

create index if not exists idx_listings_status_created on listings (status, created_at desc);
create index if not exists idx_listings_city on listings (city);
create index if not exists idx_listings_make on listings (make);
create index if not exists idx_listings_user on listings (user_id);
create index if not exists idx_listing_images_listing on listing_images (listing_id);
create index if not exists idx_favorites_user_created on favorites (user_id, created_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_listings_updated_at on listings;
create trigger trg_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

-- Create a profile automatically when a Supabase Auth user is created.
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

-- Backfill profiles for accounts that existed before the trigger.
insert into public.profiles (id, display_name)
select
  u.id,
  coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(u.email, ''), '@', 1), 'User')
from auth.users u
on conflict (id) do nothing;

-- Server-side anti-bypass guard. The app also checks this for a friendly error,
-- but this trigger protects direct Supabase calls too.
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

  -- Serialize listing creation per user so concurrent requests cannot race past the limit.
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

drop trigger if exists trg_enforce_private_listing_insert on listings;
create trigger trg_enforce_private_listing_insert
  before insert on listings
  for each row execute function public.enforce_private_listing_insert();

-- Owners may only change status to sold/removed. This trigger also prevents
-- a direct Supabase update from changing hidden fields in the same request.
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

-- Row Level Security -------------------------------------------------------
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_images enable row level security;
alter table favorites enable row level security;
alter table dealer_reports enable row level security;

drop policy if exists "Users manage their own profile" on profiles;
create policy "Users manage their own profile"
  on profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Anyone can read active listings" on listings;
create policy "Anyone can read active listings"
  on listings for select
  using (status = 'active');

drop policy if exists "Owners can read all their own listings" on listings;
create policy "Owners can read all their own listings"
  on listings for select
  using (auth.uid() = user_id);

drop policy if exists "Owners can insert their own listings" on listings;
drop policy if exists "Owners can insert pending listings" on listings;
create policy "Owners can insert pending listings"
  on listings for insert
  with check (auth.uid() = user_id and status = 'pending');

drop policy if exists "Owners can update their own listings" on listings;
drop policy if exists "Owners can mark listings sold or removed" on listings;
create policy "Owners can mark listings sold or removed"
  on listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and status in ('sold', 'removed'));

drop policy if exists "Owners can delete their own listings" on listings;
create policy "Owners can delete their own listings"
  on listings for delete
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read images of active listings" on listing_images;
create policy "Anyone can read images of active listings"
  on listing_images for select
  using (
    exists (select 1 from listings l where l.id = listing_id and l.status = 'active')
  );

drop policy if exists "Owners manage images of their own listings" on listing_images;
create policy "Owners manage images of their own listings"
  on listing_images for all
  using (
    exists (select 1 from listings l where l.id = listing_id and l.user_id = auth.uid())
  )
  with check (
    exists (select 1 from listings l where l.id = listing_id and l.user_id = auth.uid())
  );

drop policy if exists "Users manage their favorites" on favorites;
create policy "Users manage their favorites"
  on favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Signed-in users can file a dealer report" on dealer_reports;
create policy "Signed-in users can file a dealer report"
  on dealer_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users can see their own reports" on dealer_reports;
create policy "Users can see their own reports"
  on dealer_reports for select
  using (auth.uid() = reporter_id);

-- Storage -----------------------------------------------------------------
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
