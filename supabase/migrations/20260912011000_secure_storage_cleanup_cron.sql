do $$
begin
  if not exists (select 1 from vault.secrets where name='p2pcars_storage_cleanup_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'p2pcars_storage_cleanup_secret',
      'Shared secret for the scheduled P2PCars storage-cleanup Edge Function',
      null
    );
  end if;
end $$;

create or replace function public.verify_storage_cleanup_cron_secret(candidate text)
returns boolean
language sql
security definer
set search_path = 'pg_catalog','vault'
as $$
  select exists(
    select 1
    from vault.decrypted_secrets
    where name='p2pcars_storage_cleanup_secret'
      and decrypted_secret=candidate
  );
$$;

revoke all on function public.verify_storage_cleanup_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_storage_cleanup_cron_secret(text) to service_role;

select cron.unschedule('p2pcars-storage-cleanup');

select cron.schedule(
  'p2pcars-storage-cleanup',
  '*/10 * * * *',
  $$
    select net.http_post(
      url:='https://rjoipowznfokhvahuozf.supabase.co/functions/v1/storage-cleanup',
      headers:=jsonb_build_object(
        'Content-Type','application/json',
        'X-P2PCars-Cron-Secret',(
          select decrypted_secret
          from vault.decrypted_secrets
          where name='p2pcars_storage_cleanup_secret'
          limit 1
        )
      ),
      body:='{}'::jsonb,
      timeout_milliseconds:=10000
    ) as request_id;
  $$
);
