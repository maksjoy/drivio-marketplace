create table if not exists private.nickname_adjectives (
  word text primary key
);

create table if not exists private.nickname_nouns (
  word text primary key
);

insert into private.nickname_adjectives (word) values
('Agile'),('Amber'),('Angry'),('Arctic'),('Awake'),('Azure'),('Big'),('Bold'),('Brave'),('Bright'),
('Brisk'),('Calm'),('Clever'),('Cloudy'),('Cool'),('Copper'),('Cosmic'),('Crimson'),('Curious'),('Daring'),
('Deep'),('Electric'),('Epic'),('Fast'),('Fearless'),('Fierce'),('Flash'),('Flying'),('Forest'),('Free'),
('Fresh'),('Frosty'),('Gentle'),('Giant'),('Golden'),('Grand'),('Green'),('Happy'),('Hidden'),('Honest'),
('Humble'),('Icy'),('Iron'),('Jolly'),('Kind'),('Light'),('Little'),('Lucky'),('Lunar'),('Magic'),
('Mellow'),('Midnight'),('Mighty'),('Mint'),('Misty'),('Modern'),('Moonlit'),('Neon'),('Nimble'),('Noble'),
('Northern'),('Nova'),('Ocean'),('Orange'),('Pacific'),('Patient'),('Peaceful'),('Polar'),('Proud'),('Purple'),
('Quick'),('Quiet'),('Rapid'),('Red'),('Royal'),('Rusty'),('Sandy'),('Sharp'),('Shiny'),('Silent'),
('Silver'),('Sky'),('Smart'),('Snowy'),('Solar'),('Solid'),('Speedy'),('Steel'),('Stormy'),('Strong'),
('Sunny'),('Super'),('Swift'),('Tiny'),('True'),('Turbo'),('Velvet'),('Warm'),('White'),('Wild'),
('Wise'),('Yellow'),('Young'),('Zesty'),('Blue'),('Black'),('Coral'),('Crystal'),('Dusty'),('Emerald'),
('Friendly'),('Glowing'),('Great'),('Jade'),('Lively'),('Maple'),('Rapid'),('Rocky'),('Smooth'),('Soft'),
('Steady'),('Sweet'),('Vivid'),('Witty'),('Wooden'),('Zen'),('Breezy'),('Chill'),('Dreamy'),('Eager'),
('Fancy'),('Gleaming'),('Groovy'),('Hardy'),('Joyful'),('Keen'),('Lofty'),('Merry'),('Playful'),('Prime'),
('Rare'),('Ready'),('Sleek'),('Spicy'),('Stellar'),('Sunny'),('Tender'),('Urban'),('Vast'),('Wavy')
on conflict do nothing;

insert into private.nickname_nouns (word) values
('Alpaca'),('Badger'),('Bear'),('Beaver'),('Bee'),('Bison'),('Bobcat'),('Buffalo'),('Bull'),('Bunny'),
('Caribou'),('Cat'),('Cheetah'),('Cobra'),('Comet'),('Cougar'),('Coyote'),('Crane'),('Crow'),('Deer'),
('Dog'),('Dolphin'),('Dragon'),('Duck'),('Eagle'),('Falcon'),('Ferret'),('Finch'),('Fox'),('Frog'),
('Gazelle'),('Gecko'),('Goat'),('Goose'),('Griffin'),('Hare'),('Hawk'),('Heron'),('Horse'),('Husky'),
('Jaguar'),('Koala'),('Leopard'),('Lion'),('Lizard'),('Lynx'),('Marmot'),('Moose'),('Mouse'),('Mustang'),
('Otter'),('Owl'),('Panda'),('Panther'),('Parrot'),('Penguin'),('Phoenix'),('Pony'),('Puma'),('Rabbit'),
('Raccoon'),('Raven'),('Robin'),('Salmon'),('Seal'),('Shark'),('Sparrow'),('Squirrel'),('Stallion'),('Swan'),
('Tiger'),('Turtle'),('Walrus'),('Whale'),('Wolf'),('Wolverine'),('Wombat'),('Yak'),('Zebra'),('Acorn'),
('Anchor'),('Arrow'),('Aspen'),('Aurora'),('Avalanche'),('Beacon'),('Birch'),('Blaze'),('Breeze'),('Brook'),
('Canyon'),('Cedar'),('Cloud'),('Creek'),('Dawn'),('Delta'),('Dune'),('Echo'),('Ember'),('Everest'),
('Flame'),('Flint'),('Forest'),('Frost'),('Galaxy'),('Glacier'),('Grove'),('Harbor'),('Horizon'),('Iceberg'),
('Island'),('Lake'),('Leaf'),('Maple'),('Meadow'),('Meteor'),('Moon'),('Mountain'),('Nebula'),('Ocean'),
('Orbit'),('Peak'),('Pine'),('Prairie'),('Quartz'),('Rain'),('Reef'),('River'),('Rock'),('Sand'),
('Shadow'),('Sky'),('Snow'),('Spark'),('Star'),('Stone'),('Storm'),('Summit'),('Sun'),('Thunder'),
('Timber'),('Trail'),('Valley'),('Wave'),('Willow'),('Wind'),('Aurora'),('Bolt'),('Compass'),('Crown'),
('Drift'),('Engine'),('Gear'),('Hammer'),('Lantern'),('Muse'),('Pilot'),('Ranger'),('Rocket'),('Scout'),
('Shield'),('Signal'),('Spirit'),('Voyager'),('Wheel'),('Ace'),('Bandit'),('Captain'),('Chief'),('Dreamer'),
('Driver'),('Explorer'),('Guardian'),('Hunter'),('Knight'),('Legend'),('Maverick'),('Nomad'),('Pioneer'),('Rider'),
('Runner'),('Sailor'),('Skipper'),('Traveler'),('Trooper'),('Wizard'),('Artist'),('Builder'),('Chef'),('Coder'),
('Dancer'),('Farmer'),('Maker'),('Miner'),('Painter'),('Poet'),('Singer'),('Smith'),('Walker'),('Watcher')
on conflict do nothing;

create or replace function private.pick_unique_nickname(exclude_user uuid default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
  adjective_count integer;
  noun_count integer;
  attempt integer := 0;
begin
  select count(*) into adjective_count from private.nickname_adjectives;
  select count(*) into noun_count from private.nickname_nouns;

  if adjective_count = 0 or noun_count = 0 then
    raise exception 'NICKNAME_WORD_BANK_EMPTY';
  end if;

  while attempt < 250 loop
    select a.word || ' ' || n.word into candidate
    from (select word from private.nickname_adjectives offset floor(random() * adjective_count)::int limit 1) a
    cross join (select word from private.nickname_nouns offset floor(random() * noun_count)::int limit 1) n;

    if not exists (
      select 1 from public.public_identities p
      where lower(p.nickname) = lower(candidate)
        and (exclude_user is null or p.user_id <> exclude_user)
    ) then
      return candidate;
    end if;
    attempt := attempt + 1;
  end loop;

  raise exception 'NICKNAME_POOL_BUSY';
end;
$$;

revoke all on function private.pick_unique_nickname(uuid) from public, anon, authenticated;

create or replace function private.ensure_public_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.nickname is null or btrim(new.nickname) = '' then
    new.nickname := private.pick_unique_nickname(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ensure_public_identity on public.public_identities;
create trigger trg_ensure_public_identity
before insert on public.public_identities
for each row execute function private.ensure_public_identity();

-- Re-issue the small set of existing launch nicknames into the final two-word format.
update public.public_identities
set nickname = '__TEMP__' || replace(user_id::text, '-', '');

do $$
declare
  r record;
begin
  for r in select user_id from public.public_identities order by created_at, user_id loop
    update public.public_identities
    set nickname = private.pick_unique_nickname(r.user_id)
    where user_id = r.user_id;
  end loop;
end;
$$;

create unique index if not exists public_identities_nickname_ci_unique
on public.public_identities (lower(nickname));

alter table public.public_identities drop column if exists public_id;

create or replace function private.force_listing_public_nickname()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_nickname text;
begin
  select nickname into safe_nickname
  from public.public_identities
  where user_id = new.user_id;

  if safe_nickname is null then
    insert into public.public_identities (user_id, nickname)
    values (new.user_id, '')
    on conflict (user_id) do nothing;
    select nickname into safe_nickname from public.public_identities where user_id = new.user_id;
  end if;

  new.seller_name := coalesce(safe_nickname, 'Anonymous Seller');
  return new;
end;
$$;

revoke all on function private.force_listing_public_nickname() from public, anon, authenticated;
drop trigger if exists trg_force_listing_public_nickname on public.listings;
create trigger trg_force_listing_public_nickname
before insert or update of user_id, seller_name on public.listings
for each row execute function private.force_listing_public_nickname();

update public.listings l
set seller_name = i.nickname
from public.public_identities i
where i.user_id = l.user_id
  and l.seller_name is distinct from i.nickname;
