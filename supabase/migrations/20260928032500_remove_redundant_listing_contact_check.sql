create or replace function private.enforce_private_listing_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or auth.uid() <> new.user_id then
    raise exception 'You can only create your own listings.';
  end if;

  if exists(
    select 1 from public.user_moderation
    where user_id = new.user_id
      and is_blocked
      and (blocked_until is null or blocked_until > now())
  ) then
    raise exception 'Your account is blocked from publishing listings.';
  end if;

  if new.status <> 'pending' then
    raise exception 'New listings must be pending.';
  end if;

  if nullif(btrim(new.make),'') is null
     or nullif(btrim(new.model),'') is null
     or nullif(btrim(new.fuel),'') is null then
    raise exception 'Make, model and fuel are required.';
  end if;

  if char_length(new.make) > 80 or char_length(new.model) > 120 or char_length(new.seller_name) > 160 then
    raise exception 'Listing text is too long.';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  if exists(select 1 from public.listings where user_id = new.user_id and created_at > now() - interval '30 seconds') then
    raise exception 'Please wait before creating another listing.';
  end if;

  if (select count(*) from public.listings where user_id = new.user_id and created_at >= date_trunc('day', now())) >= 6 then
    raise exception 'Daily listing creation limit reached.';
  end if;

  if (select count(*) from public.listings where user_id = new.user_id and status in ('pending','active')) >= 3 then
    raise exception 'Private seller listing limit reached.';
  end if;

  return new;
end;
$$;
