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

insert into public.listings(id,user_id,seller_name,seller_email,make,model,year,price,mileage,fuel,status,created_at)
values('20000000-0000-4000-8000-000000000001',auth.uid(),'Test','seller-test@example.invalid','Porsche','911',2020,50000,50000,'Gasoline','pending',now()-interval '2 minutes');
select pg_temp.assert_true(exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001' and status='pending'),'Owner creates and reads pending listing');
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,seller_email,make,model,year,price,mileage,fuel,status) values(auth.uid(),'Test','test@example.invalid','Ford','Focus',2020,5000,50000,'Gasoline','active')$q$,'must be pending','Direct active insert blocked');
select pg_temp.expect_error($q$update public.listings set status='active' where id='20000000-0000-4000-8000-000000000001'$q$,'only mark|Owners may edit','Owner cannot activate own listing');
select pg_temp.expect_error($q$update public.listings set user_id='10000000-0000-4000-8000-000000000002',status='sold' where id='20000000-0000-4000-8000-000000000001'$q$,'only change|cannot be changed','Owner cannot transfer listing');
select pg_temp.expect_error($q$insert into public.listing_images(listing_id,storage_path) values('20000000-0000-4000-8000-000000000001','other/file.jpg')$q$,'must reference','Cannot attach another seller photo');

insert into public.listings(user_id,seller_name,seller_email,make,model,year,price,mileage,fuel,created_at)
select auth.uid(),'Test','test@example.invalid','Ford','Focus',2020,5000,50000,'Gasoline',now()-interval '2 minutes'
from generate_series(1,2);
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,seller_email,make,model,year,price,mileage,fuel) values(auth.uid(),'Test','test@example.invalid','Ford','Focus',2020,5000,50000,'Gasoline')$q$,'limit reached','Fourth listing blocked');

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
select pg_temp.expect_error($q$insert into public.listings(user_id,seller_name,seller_email,make,model,year,price,mileage,fuel) values(auth.uid(),'Test','test@example.invalid','Ford','Focus',2020,5000,50000,'Gasoline')$q$,'blocked','Blocked owner cannot publish via API');

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
select pg_temp.expect_error('select public.admin_dashboard_stats()','permission denied','Anonymous admin RPC denied');
select pg_temp.assert_true(not exists(select 1 from public.listings where id='20000000-0000-4000-8000-000000000001'),'Deleted listing hidden publicly');
reset role;

select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label)) as test_report from test_results;
rollback;
