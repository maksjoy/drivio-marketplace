create table if not exists public.public_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  public_id uuid not null default gen_random_uuid() unique,
  nickname text not null unique,
  created_at timestamptz not null default now(),
  constraint public_identities_nickname_length check (char_length(nickname) between 3 and 80)
);

create or replace function private.ensure_public_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
  adjectives text[] := array['Angry','Brave','Bright','Calm','Clever','Cool','Fast','Gentle','Happy','Lucky','Mighty','Quiet','Quick','Sharp','Silent','Smart','Swift','Wild','Bold','Cosmic','Sunny','Nimble','Epic','Kind'];
  nouns text[] := array['Muse','Squirrel','Falcon','Wolf','Otter','Fox','Raven','Panda','Lynx','Tiger','Moose','Bear','Hawk','Bison','Coyote','Beaver','Owl','Comet','Maple','Rocket','Badger','Orca','Gecko','Marmot'];
begin
  if new.public_id is null then
    new.public_id := gen_random_uuid();
  end if;
  if new.nickname is null or btrim(new.nickname) = '' then
    h := md5(new.public_id::text);
    new.nickname := adjectives[1 + (ascii(substr(h, 1, 1)) % array_length(adjectives, 1))]
      || ' ' || nouns[1 + (ascii(substr(h, 2, 1)) % array_length(nouns, 1))]
      || ' ' || upper(substr(replace(new.public_id::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_public_identity on public.public_identities;
create trigger trg_ensure_public_identity before insert on public.public_identities
for each row execute function private.ensure_public_identity();

alter table public.public_identities enable row level security;
drop policy if exists "Signed in users can read public identities" on public.public_identities;
create policy "Signed in users can read public identities" on public.public_identities
for select to authenticated using (true);
grant select on public.public_identities to authenticated;
revoke insert, update, delete on public.public_identities from authenticated, anon;

insert into public.public_identities (user_id, nickname)
select p.id, '' from public.profiles p
on conflict (user_id) do nothing;

alter table public.profiles
  add column if not exists system_messages_read_at timestamptz not null default now();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    )
  )
  on conflict (id) do nothing;

  insert into public.public_identities (user_id, nickname)
  values (new.id, '')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

update public.listings l
set seller_name = i.nickname
from public.public_identities i
where i.user_id = l.user_id
  and l.seller_name is distinct from i.nickname;

alter table public.conversations
  add column if not exists buyer_unread_count integer not null default 0,
  add column if not exists seller_unread_count integer not null default 0,
  add column if not exists last_message_body text,
  add column if not exists last_message_at timestamptz,
  add column if not exists last_sender_id uuid;

alter table public.conversations
  drop constraint if exists conversations_buyer_unread_nonnegative,
  add constraint conversations_buyer_unread_nonnegative check (buyer_unread_count >= 0),
  drop constraint if exists conversations_seller_unread_nonnegative,
  add constraint conversations_seller_unread_nonnegative check (seller_unread_count >= 0);

update public.conversations c
set last_message_body = latest.body,
    last_message_at = latest.created_at,
    last_sender_id = latest.sender_id,
    updated_at = greatest(c.updated_at, latest.created_at)
from (
  select distinct on (conversation_id) conversation_id, body, created_at, sender_id
  from public.messages
  order by conversation_id, created_at desc
) latest
where latest.conversation_id = c.id;

create index if not exists idx_conversations_buyer_unread on public.conversations (buyer_id, buyer_unread_count, last_message_at desc);
create index if not exists idx_conversations_seller_unread on public.conversations (seller_id, seller_unread_count, last_message_at desc);

create or replace function private.enforce_private_message_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  hourly_count integer;
  daily_count integer;
begin
  select count(*) into hourly_count from public.messages
  where sender_id = new.sender_id and created_at >= now() - interval '1 hour';
  if hourly_count >= 20 then raise exception 'MESSAGE_HOURLY_LIMIT'; end if;

  select count(*) into daily_count from public.messages
  where sender_id = new.sender_id and created_at >= now() - interval '24 hours';
  if daily_count >= 100 then raise exception 'MESSAGE_DAILY_LIMIT'; end if;
  return new;
end;
$$;

revoke all on function private.enforce_private_message_rate_limit() from public, anon, authenticated;
drop trigger if exists trg_enforce_private_message_rate_limit on public.messages;
create trigger trg_enforce_private_message_rate_limit before insert on public.messages
for each row execute function private.enforce_private_message_rate_limit();

create or replace function private.after_private_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
  set updated_at = new.created_at,
      last_message_body = new.body,
      last_message_at = new.created_at,
      last_sender_id = new.sender_id,
      buyer_unread_count = case when seller_id = new.sender_id then buyer_unread_count + 1 else buyer_unread_count end,
      seller_unread_count = case when buyer_id = new.sender_id then seller_unread_count + 1 else seller_unread_count end
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function private.after_private_message_insert() from public, anon, authenticated;
drop trigger if exists trg_touch_conversation_after_message on public.messages;
drop trigger if exists trg_after_private_message_insert on public.messages;
create trigger trg_after_private_message_insert after insert on public.messages
for each row execute function private.after_private_message_insert();

drop function if exists public.touch_conversation_after_message();

create or replace function public.mark_conversation_read(target_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.conversations
  set buyer_unread_count = case when buyer_id = me then 0 else buyer_unread_count end,
      seller_unread_count = case when seller_id = me then 0 else seller_unread_count end
  where id = target_conversation and (buyer_id = me or seller_id = me);
end;
$$;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create table if not exists public.system_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  category text not null default 'info',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  is_active boolean not null default true,
  constraint system_messages_title_length check (char_length(btrim(title)) between 1 and 120),
  constraint system_messages_body_length check (char_length(btrim(body)) between 1 and 3000),
  constraint system_messages_category_valid check (category in ('info','news','safety','promo','welcome'))
);
create index if not exists idx_system_messages_active_created on public.system_messages (is_active, created_at desc);
alter table public.system_messages enable row level security;
drop policy if exists "Signed in users can read system messages" on public.system_messages;
create policy "Signed in users can read system messages" on public.system_messages
for select to authenticated using (is_active = true or exists (select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins can create system messages" on public.system_messages;
create policy "Admins can create system messages" on public.system_messages
for insert to authenticated with check (created_by = auth.uid() and exists (select 1 from public.admins a where a.user_id = auth.uid()));
drop policy if exists "Admins can update system messages" on public.system_messages;
create policy "Admins can update system messages" on public.system_messages
for update to authenticated using (exists (select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admins a where a.user_id = auth.uid()));
grant select, insert, update on public.system_messages to authenticated;
