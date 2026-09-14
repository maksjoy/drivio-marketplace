-- Direct-upload flow creates listing_images metadata before the browser uploads bytes.
-- Keep ownership/path/limit checks here; Storage RLS protects the actual upload.
create or replace function private.validate_listing_image()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  owner_id uuid;
  listing_status text;
  folder_prefix text;
begin
  select user_id,status into owner_id,listing_status
  from public.listings where id=new.listing_id;

  if auth.uid() is null or owner_id is distinct from auth.uid() or listing_status<>'pending' then
    raise exception 'Photos can only be added to your pending listing';
  end if;

  perform pg_advisory_xact_lock(hashtext(new.listing_id::text));

  if new.position<0 or new.position>7 then
    raise exception 'Choose 1–8 photos';
  end if;

  folder_prefix := owner_id::text||'/'||new.listing_id::text||'/';

  if new.storage_path not like folder_prefix||'%'
     or new.storage_path !~* '\.(jpe?g|png|webp)$'
  then
    raise exception 'Photo path is invalid';
  end if;

  if new.thumb_path is not null and (
       new.thumb_path not like folder_prefix||'%'
       or new.thumb_path !~* '\.(jpe?g|png|webp)$'
  ) then
    raise exception 'Thumbnail path is invalid';
  end if;

  if (select count(*) from public.listing_images
      where listing_id=new.listing_id and id<>new.id) >= 8 then
    raise exception 'Maximum 8 photos';
  end if;

  return new;
end;
$$;
