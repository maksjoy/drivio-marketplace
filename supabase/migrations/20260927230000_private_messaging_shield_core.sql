create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_buyer_seller_different check (buyer_id <> seller_id),
  constraint conversations_listing_buyer_unique unique (listing_id, buyer_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(btrim(body)) between 1 and 1000),
  constraint messages_body_no_links check (
    body !~* '(https?://|www\.|t\.me/|wa\.me/|discord\.gg/|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|ca|net|org|io|co|me|app|xyz|info|biz|dev|ai|ly|gg)(?:[/?#:\s]|$))'
  )
);

create index if not exists idx_conversations_buyer_updated on public.conversations (buyer_id, updated_at desc);
create index if not exists idx_conversations_seller_updated on public.conversations (seller_id, updated_at desc);
create index if not exists idx_messages_conversation_created on public.messages (conversation_id, created_at asc);
create index if not exists idx_messages_sender_created on public.messages (sender_id, created_at desc);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Conversation participants can read" on public.conversations;
create policy "Conversation participants can read"
  on public.conversations for select
  to authenticated
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id);

drop policy if exists "Buyers can start conversations" on public.conversations;
create policy "Buyers can start conversations"
  on public.conversations for insert
  to authenticated
  with check (
    (select auth.uid()) = buyer_id
    and buyer_id <> seller_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.user_id = seller_id
        and l.status = 'active'
    )
  );

drop policy if exists "Conversation participants can read messages" on public.messages;
create policy "Conversation participants can read messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
    )
  );

drop policy if exists "Conversation participants can send messages" on public.messages;
create policy "Conversation participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    (select auth.uid()) = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
    )
  );

grant select, insert on public.conversations to authenticated;
grant select, insert on public.messages to authenticated;

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_after_message() from public;
revoke all on function public.touch_conversation_after_message() from anon;
revoke all on function public.touch_conversation_after_message() from authenticated;

drop trigger if exists trg_touch_conversation_after_message on public.messages;
create trigger trg_touch_conversation_after_message
  after insert on public.messages
  for each row execute function public.touch_conversation_after_message();