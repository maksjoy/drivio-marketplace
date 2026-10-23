-- Transaction-only production security regression. Always ROLLBACK.
begin;

create temporary table test_results(label text, passed boolean);
grant all on test_results to authenticated, anon;

create function pg_temp.assert_true(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAILED: %', label; end if;
  insert into test_results values(label, true);
end;
$$;

create function pg_temp.expect_error(statement text, pattern text, label text)
returns void language plpgsql as $$
declare caught boolean := false;
begin
  begin
    execute statement;
  exception when others then
    if sqlerrm !~* pattern then
      raise exception 'Unexpected error in %: %', label, sqlerrm;
    end if;
    caught := true;
  end;
  if not caught then raise exception 'FAILED (accepted): %', label; end if;
  insert into test_results values(label, true);
end;
$$;

insert into auth.users(id,email,raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001','seller-test@example.invalid','{"display_name":"Security test"}'),
 ('10000000-0000-4000-8000-000000000002','buyer-test@example.invalid','{}'),
 ('10000000-0000-4000-8000-000000000003','admin-test@example.invalid','{}');
insert into public.admins(user_id) values('10000000-0000-4000-8000-000000000003');
select pg_temp.assert_true(exists(select 1 from public.profiles where id='10000000-0000-4000-8000-000000000001'),'Signup trigger creates profile');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.expect_error($q$select * from public.admin_users()$q$,'Admin access required','Ordinary user cannot read admin users');
select pg_temp.expect_error($q$select public.admin_dashboard_stats()$q$,'Admin access required','Ordinary user cannot read admin stats');
select pg_temp.expect_error($q$insert into public.admins(user_id) values(auth.uid())$q$,'permission denied|row-level security','Cannot self-assign administrator');

insert into public.listings(id,user_id,seller_name,make,model,year,price,mileage,fuel,status,created_at)
values('20000000-0000-4000-8000-000000000001',auth.uid(),'Test','Porsche','911',2020,50000,50000,'Gasoline','pending',now()-interval '2 minutes');
select pg_temp.assert_true(exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001' and status='pending'),'Owner creates and reads pending listing');
select pg_temp.assert_true(exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001' and seller_phone is null and seller_email is null),'Public listing never stores seller contact fields');
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,make,model,year,price,mileage,fuel,status) values(auth.uid(),'Test','Ford','Focus',2020,5000,50000,'Gasoline','active')$q$,'must be pending','Direct active insert blocked');
select pg_temp.expect_error($q$update public.listings set status='active' where id='20000000-0000-4000-8000-000000000001'$q$,'only mark|Owners may edit','Owner cannot activate own listing');
select pg_temp.expect_error($q$update public.listings set user_id='10000000-0000-4000-8000-000000000002',status='sold' where id='20000000-0000-4000-8000-000000000001'$q$,'only change|cannot be changed','Owner cannot transfer listing');
select pg_temp.expect_error($q$insert into public.listing_images(listing_id,storage_path) values('20000000-0000-4000-8000-000000000001','other/file.jpg')$q$,'must reference|Photo path is invalid','Cannot attach another seller photo');

insert into public.listings(user_id,seller_name,make,model,year,price,mileage,fuel,created_at)
select auth.uid(),'Test','Ford','Focus',2020,5000,50000,'Gasoline',now()-interval '2 minutes'
from generate_series(1,2);
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,make,model,year,price,mileage,fuel) values(auth.uid(),'Test','Ford','Focus',2020,5000,50000,'Gasoline')$q$,'limit reached','Fourth listing blocked');

reset role;
insert into storage.objects(bucket_id,name)
values('listing-photos','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/test.jpg');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.listing_images(listing_id,storage_path,position)
values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000001/test.jpg',0);
select pg_temp.assert_true(exists(select 1 from public.listing_images where listing_id='20000000-0000-4000-8000-000000000001'),'Owner attaches uploaded photo');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true(not exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001'),'Another user cannot see pending listing');
with updated as (update public.listings set status='removed' where id='20000000-0000-4000-8000-000000000001' returning id)
select pg_temp.assert_true((select count(*) from updated)=0,'Another user cannot change listing');
select pg_temp.assert_true(not exists(select 1 from public.profiles where id='10000000-0000-4000-8000-000000000001'),'Another user cannot read private profile');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.assert_true(exists(select 1 from public.listing_images where listing_id='20000000-0000-4000-8000-000000000001'),'Admin can inspect pending photos');
select pg_temp.expect_error($q$update public.listings set status='active' where user_id='10000000-0000-4000-8000-000000000001' and id<>'20000000-0000-4000-8000-000000000001'$q$,'at least one photo','Admin cannot activate photoless listing');
update public.listings set status='active' where id='20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select status='active' from public.listings where id='20000000-0000-4000-8000-000000000001'),'Admin approval works');
select pg_temp.assert_true((public.admin_dashboard_stats()->>'users')::int>=3,'Admin dashboard works');
select pg_temp.assert_true(exists(select 1 from public.admin_users() where user_id='10000000-0000-4000-8000-000000000001'),'Admin user list works');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.favorites(user_id,listing_id) values(auth.uid(),'20000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(exists(select 1 from public.favorites where listing_id='20000000-0000-4000-8000-000000000001'),'Favorite saved');
insert into public.listing_reports(listing_id,reporter_id,reason) values('20000000-0000-4000-8000-000000000001',auth.uid(),'Security test report');
select pg_temp.expect_error($q$insert into public.listing_reports(listing_id,reporter_id,reason) values('20000000-0000-4000-8000-000000000001',auth.uid(),'Duplicate')$q$,'duplicate key|Please wait','Duplicate or rapid report rejected');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
update public.listing_reports set status='reviewed' where listing_id='20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(exists(select 1 from public.listing_reports where listing_id='20000000-0000-4000-8000-000000000001' and status='reviewed'),'Admin reviews report');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
update public.listings set status='sold' where id='20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001' and status='sold'),'Owner marks sold');
delete from public.listings where id='20000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001'),'Owner deletes sold listing');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select public.admin_set_user_block('10000000-0000-4000-8000-000000000001',true,'Test block',null);
select pg_temp.assert_true(not exists(select 1 from public.listings where user_id='10000000-0000-4000-8000-000000000001' and status in ('active','pending')),'Blocking removes seller listings');

select set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,make,model,year,price,mileage,fuel) values(auth.uid(),'Test','Ford','Focus',2020,5000,50000,'Gasoline')$q$,'blocked','Blocked owner cannot publish via API');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.expect_error('select public.admin_dashboard_stats()','permission denied','Anonymous admin RPC denied');
select pg_temp.assert_true(not exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001'),'Deleted listing hidden publicly');
reset role;

-- These checks run only after the 2026-10-23 trust migrations are applied.
-- Before that, the live database still has the wider upload policy and no
-- profile trigger, and this file must keep passing. A WHERE clause cannot
-- skip expect_error: the function would run before the filter.
create function pg_temp.pending_photo_uploads_only()
returns boolean language sql stable as $$
  select exists (
    select 1
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage'
      and c.relname = 'objects'
      and p.polname = 'Users upload listing photos to own folder'
      and pg_get_expr(p.polwithcheck, p.polrelid) like '%pending%'
      and pg_get_expr(p.polwithcheck, p.polrelid) not like '%sold%'
  );
$$;

create function pg_temp.profile_trust_trigger_installed()
returns boolean language sql stable as $$
  select exists (
    select 1 from pg_trigger
    where tgrelid = 'public.profiles'::regclass
      and tgname = 'protect_profile_trust_columns'
      and not tgisinternal
  );
$$;

do $photo$
declare
  seller uuid := '10000000-0000-4000-8000-000000000001';
  target uuid := '20000000-0000-4000-8000-000000000099';
  prefix text;
  inserted integer;
begin
  if not pg_temp.pending_photo_uploads_only() then
    insert into test_results values('Pending-only photo upload checks skipped', true);
    return;
  end if;

  prefix := seller::text || '/' || target::text || '/';

  -- The seller was blocked above. Unblock only for this gated section.
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  set local role authenticated;
  perform public.admin_set_user_block(seller, false, null, null);

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  insert into public.listings(id,user_id,seller_name,make,model,year,price,mileage,fuel,status,created_at)
  values(target, auth.uid(), 'Test', 'Ford', 'Focus', 2020, 5000, 50000, 'Gasoline', 'pending', now() - interval '2 minutes');

  -- Signed upload URLs are created before listing_images rows exist.
  -- Authenticated clients cannot select storage.objects directly, so the
  -- insert's row count is the check.
  insert into storage.objects(bucket_id, name)
  values('listing-photos', prefix || 'fresh.jpg');
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 1, 'Owner can upload into a pending listing before image rows exist');

  insert into public.listing_images(listing_id, storage_path, position)
  select target, prefix || 'p' || g || '.jpg', g
  from generate_series(0, 7) g;
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 8, 'Owner registers eight photo paths on a pending listing');

  perform pg_temp.expect_error(
    format('insert into storage.objects(bucket_id,name) values(''listing-photos'', %L)', prefix || 'ninth.jpg'),
    'row-level security',
    'Unregistered photo is rejected once eight images are registered'
  );

  insert into storage.objects(bucket_id, name)
  values('listing-photos', prefix || 'p0.jpg');
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 1, 'Owner can still upload a registered path on a full pending listing');

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  update public.listings set status = 'active' where id = target;
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 1, 'Admin approves the listing used for the upload check');

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  perform pg_temp.expect_error(
    format('insert into storage.objects(bucket_id,name) values(''listing-photos'', %L)', prefix || 'p1.jpg'),
    'row-level security',
    'Owner cannot upload into an approved listing folder'
  );

  update public.listings set status = 'pending', price = 5100 where id = target;
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 1, 'Owner returns the approved listing to review');
  insert into storage.objects(bucket_id, name)
  values('listing-photos', prefix || 'p1.jpg');
  get diagnostics inserted = row_count;
  perform pg_temp.assert_true(inserted = 1, 'Owner can upload a registered path after returning the listing to review');

  reset role;
end
$photo$;

do $profile$
declare
  seller uuid := '10000000-0000-4000-8000-000000000001';
  admin uuid := '10000000-0000-4000-8000-000000000003';
begin
  if not pg_temp.profile_trust_trigger_installed() then
    insert into test_results values('Profile trust column checks skipped', true);
    return;
  end if;

  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000001","role":"authenticated"}', true);
  set local role authenticated;

  update public.profiles set phone = '4035550199' where id = auth.uid();
  perform pg_temp.assert_true(
    exists(select 1 from public.profiles where id = seller and phone = '4035550199'),
    'Owner can still save a private phone number'
  );
  perform pg_temp.expect_error(
    'update public.profiles set phone_verified=true where id=auth.uid()',
    'Protected profile fields',
    'Owner cannot mark their own phone verified'
  );
  perform pg_temp.expect_error(
    'update public.profiles set is_dealer_flagged=true where id=auth.uid()',
    'Protected profile fields',
    'Owner cannot set the dealer flag'
  );
  perform pg_temp.expect_error(
    'update public.profiles set dealer_report_count=dealer_report_count+1 where id=auth.uid()',
    'Protected profile fields',
    'Owner cannot change dealer report count'
  );
  update public.profiles set system_messages_read_at = now() where id = auth.uid();
  perform pg_temp.assert_true(
    exists(select 1 from public.profiles where id = seller and system_messages_read_at is not null),
    'Owner can still mark system messages read'
  );

  -- Profile RLS is auth.uid() = id, so an admin changes their own row.
  perform set_config('request.jwt.claims','{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}', true);
  update public.profiles set phone_verified = true where id = auth.uid();
  perform pg_temp.assert_true(
    exists(select 1 from public.profiles where id = admin and phone_verified),
    'Admin can set phone verification on their own profile'
  );

  reset role;
end
$profile$;

select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label)) as test_report from test_results;
rollback;
