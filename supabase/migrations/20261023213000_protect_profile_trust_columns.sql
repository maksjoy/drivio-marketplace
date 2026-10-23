-- Stop a user from vouching for their own phone, clearing a dealer flag,
-- or rewriting their dealer-report count.
--
-- These three columns are not created by any file in supabase/migrations/.
-- They appear in the outdated supabase/schema.sql, and on the live project
-- PostgREST accepts select=phone_verified, select=is_dealer_flagged, and
-- select=dealer_report_count (HTTP 200). A missing column returns 42703.
-- The app never reads or writes them. It upserts id, display_name, and phone,
-- and it reads phone and system_messages_read_at.
--
-- schema.sql created "Users manage their own profile" as FOR ALL with
-- auth.uid() = id. No later migration replaced that policy. Where that policy
-- is still installed, an authenticated user can update every column of their
-- own profiles row. Column-level UPDATE grants cannot separate an owner from
-- an admin: both use the authenticated role.
--
-- This file is a no-op when any of the three columns is absent, so a database
-- built only from migrations does not gain a trigger that references missing
-- columns. When the columns exist, a BEFORE trigger rejects changes unless
-- the caller is service_role, a row in public.admins, or the database owner
-- running without a user JWT (postgres, supabase_admin, or
-- supabase_auth_admin). The function is security definer so the admin lookup
-- is not hidden by RLS on public.admins. It does not trust current_user:
-- inside a security definer function that is always the function owner.
-- The trigger is installed even if the old FOR ALL policy was renamed, because
-- the columns are the thing that must stay server-owned.
-- Ordinary updates of display_name, phone, and system_messages_read_at stay
-- allowed. Signup still works: handle_new_user inserts only id and display_name.
--
-- APPLY AFTER 20261023212000_pending_only_listing_photo_uploads.sql.
--
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction \
--     -f supabase/migrations/20261023213000_protect_profile_trust_columns.sql
--
-- Before:
--   select column_name, data_type
--   from information_schema.columns
--   where table_schema = 'public' and table_name = 'profiles'
--     and column_name in ('phone_verified', 'is_dealer_flagged', 'dealer_report_count')
--   order by column_name;
--   -- live project: three rows (boolean, integer, boolean)
--   select tgname from pg_trigger
--   where tgrelid = 'public.profiles'::regclass
--     and tgname = 'protect_profile_trust_columns'
--     and not tgisinternal;
--   -- no row
--
-- After, when the three columns exist, as an authenticated non-admin:
--   update public.profiles set phone = '4035550100' where id = auth.uid();
--   -- succeeds
--   update public.profiles set phone_verified = true where id = auth.uid();
--   -- ERROR: Protected profile fields cannot be changed
-- After, when any column is absent:
--   -- the same trigger query returns no row, and the app is unchanged
--
-- Rollback, only if the trigger was created:
--   drop trigger if exists protect_profile_trust_columns on public.profiles;
--   drop function if exists private.protect_profile_trust_columns();

do $migration$
declare
  trust_columns integer;
  own_row_policy boolean;
begin
  select count(*) into trust_columns
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'profiles'
    and (
      (column_name = 'phone_verified' and data_type = 'boolean')
      or (column_name = 'is_dealer_flagged' and data_type = 'boolean')
      or (column_name = 'dealer_report_count' and data_type = 'integer')
    );

  if trust_columns < 3 then
    raise notice 'public.profiles is missing phone_verified, is_dealer_flagged, or dealer_report_count; 20261023213000 is a no-op';
    return;
  end if;

  select exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'profiles'
      and p.polname = 'Users manage their own profile'
      and p.polcmd = '*'
  ) into own_row_policy;

  if not own_row_policy then
    raise notice 'policy "Users manage their own profile" (FOR ALL) is absent; installing the trust-column trigger anyway';
  end if;

  create or replace function private.protect_profile_trust_columns()
  returns trigger
  language plpgsql
  security definer
  set search_path = ''
  as $fn$
  declare
    trusted boolean;
  begin
    trusted :=
      (
        (select auth.uid()) is null
        and session_user in ('postgres', 'supabase_admin', 'supabase_auth_admin')
      )
      or coalesce(auth.role(), '') in ('service_role', 'supabase_admin')
      or exists (
        select 1 from public.admins a
        where a.user_id = (select auth.uid())
      );

    if trusted then
      return new;
    end if;

    if tg_op = 'INSERT' then
      if coalesce(new.phone_verified, false) is distinct from false
         or coalesce(new.is_dealer_flagged, false) is distinct from false
         or coalesce(new.dealer_report_count, 0) is distinct from 0 then
        raise exception 'Protected profile fields cannot be set';
      end if;
      return new;
    end if;

    if new.phone_verified is distinct from old.phone_verified
       or new.is_dealer_flagged is distinct from old.is_dealer_flagged
       or new.dealer_report_count is distinct from old.dealer_report_count then
      raise exception 'Protected profile fields cannot be changed';
    end if;

    return new;
  end;
  $fn$;

  revoke all on function private.protect_profile_trust_columns() from public, anon, authenticated;

  drop trigger if exists protect_profile_trust_columns on public.profiles;
  create trigger protect_profile_trust_columns
  before insert or update on public.profiles
  for each row execute function private.protect_profile_trust_columns();
end
$migration$;
