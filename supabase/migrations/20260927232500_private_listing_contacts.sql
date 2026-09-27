create or replace function public.clear_public_listing_contacts()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.seller_phone = null;
  new.seller_email = null;
  return new;
end;
$$;

revoke all on function public.clear_public_listing_contacts() from public;
revoke all on function public.clear_public_listing_contacts() from anon;
revoke all on function public.clear_public_listing_contacts() from authenticated;

drop trigger if exists trg_clear_public_listing_contacts on public.listings;
create trigger trg_clear_public_listing_contacts
  before insert or update of seller_phone, seller_email on public.listings
  for each row execute function public.clear_public_listing_contacts();
