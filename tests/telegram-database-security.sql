-- Real database checks, with generated fixtures rolled back in the same transaction.
begin;
create temporary table tg_test_ids(seller uuid,buyer uuid,listing uuid);
insert into tg_test_ids values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
grant select on tg_test_ids to anon,authenticated,service_role;
create temporary table tg_test_results(label text);
grant all on tg_test_results to anon,authenticated,service_role;
create function pg_temp.tg_assert(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAILED: %',label;end if;insert into tg_test_results values(label);end;$$;
create function pg_temp.tg_denied(statement text,label text) returns void language plpgsql as $$declare caught boolean:=false;begin begin execute statement;exception when insufficient_privilege then caught:=true;end;if not caught then raise exception 'FAILED: %',label;end if;insert into tg_test_results values(label);end;$$;
insert into auth.users(id,email,raw_user_meta_data)
select seller,seller::text||'@telegram.invalid','{"display_name":"Telegram test seller"}'::jsonb from tg_test_ids
union all select buyer,buyer::text||'@telegram.invalid','{"display_name":"Telegram test buyer"}'::jsonb from tg_test_ids;
insert into public.telegram_accounts(telegram_id,user_id,username,display_name)
select '900000000000001',seller,'signed_seller','Telegram test' from tg_test_ids;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',seller,'role','authenticated')::text,true) from tg_test_ids;
select pg_temp.tg_denied('select * from public.telegram_accounts','Clients cannot read identity mapping');
select pg_temp.tg_denied('update public.telegram_accounts set username=''hijacked''','Clients cannot edit identity mapping');
select pg_temp.tg_denied('insert into public.admins(user_id) values(auth.uid())','Telegram users cannot self-assign admin');
insert into public.listings(id,user_id,seller_name,seller_telegram,seller_email,seller_phone,make,model,year,price,mileage,fuel,status)
select listing,seller,'Test','spoofed_username','wrong@example.invalid','123','Porsche','911',2020,50000,50000,'Gasoline','pending' from tg_test_ids;
select pg_temp.tg_assert(exists(select 1 from public.listings l join tg_test_ids i on l.id=i.listing where seller_telegram='signed_seller' and seller_email is null and seller_phone is null),'Verified username overrides forged seller contact');
select set_config('request.jwt.claims',json_build_object('sub',buyer,'role','authenticated')::text,true) from tg_test_ids;
select pg_temp.tg_assert(not exists(select 1 from public.listings l join tg_test_ids i on l.id=i.listing),'Another user cannot read pending listings');
update public.listings set seller_telegram='hijacked',status='pending' where id=(select listing from tg_test_ids);
reset role;
select pg_temp.tg_assert(exists(select 1 from public.listings l join tg_test_ids i on l.id=i.listing where seller_telegram='signed_seller'),'Another user cannot edit the seller listing');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
update public.telegram_accounts set username='renamed_seller' where user_id=(select seller from tg_test_ids);
select pg_temp.tg_assert(exists(select 1 from public.listings l join tg_test_ids i on l.id=i.listing where seller_telegram='renamed_seller' and user_id=i.seller),'Username change updates contacts and keeps ownership');
update public.telegram_accounts set username=null where user_id=(select seller from tg_test_ids);
select pg_temp.tg_assert(exists(select 1 from public.listings l join tg_test_ids i on l.id=i.listing where seller_telegram is null and status='removed'),'Removing username hides listings and clears stale contact');
reset role;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',seller,'role','authenticated')::text,true) from tg_test_ids;
do $$begin
 begin
  insert into public.listings(user_id,seller_name,seller_telegram,make,model,year,price,mileage,fuel,status)
  select seller,'Test','forged','Porsche','911',2020,50000,50000,'Gasoline','pending' from tg_test_ids;
  raise exception 'FAILED: publishing without a Telegram username succeeded';
 exception when raise_exception then
  if sqlerrm not like 'Set a public Telegram username%' then raise;end if;
 end;
end;$$;
insert into tg_test_results values('Publishing without a username is rejected');
reset role;
select jsonb_build_object('passed',count(*),'checks',jsonb_agg(label)) as report from tg_test_results;
rollback;
