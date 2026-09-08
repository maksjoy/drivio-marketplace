select cron.unschedule('p2pcars-storage-cleanup');
drop extension if exists pg_net;
create extension pg_net with schema extensions;

select cron.schedule(
  'p2pcars-storage-cleanup',
  '*/10 * * * *',
  $$
    select net.http_post(
      url:='https://rjoipowznfokhvahuozf.supabase.co/functions/v1/storage-cleanup',
      headers:='{"Content-Type":"application/json","apikey":"sb_publishable_J9fxpOkaIxvgEsTJ2IwHrw_7exploAN"}'::jsonb,
      body:='{}'::jsonb,
      timeout_milliseconds:=10000
    ) as request_id;
  $$
);
