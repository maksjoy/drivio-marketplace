-- Keep existing assigned nicknames stable. Only future assignments use this curated pool.
truncate table private.nickname_adjectives, private.nickname_nouns;

insert into private.nickname_adjectives (word) values
('Adventurous'),('Agile'),('Amazing'),('Arctic'),('Awesome'),('Balanced'),('Blazing'),('Bold'),('Brave'),('Bright'),
('Brilliant'),('Calm'),('Charming'),('Cheerful'),('Clever'),('Cool'),('Cosmic'),('Courageous'),('Curious'),('Daring'),
('Dashing'),('Dynamic'),('Eager'),('Electric'),('Epic'),('Fearless'),('Fierce'),('Friendly'),('Frosty'),('Gallant'),
('Gentle'),('Golden'),('Grand'),('Happy'),('Heroic'),('Honest'),('Humble'),('Icy'),('Iron'),('Jolly'),
('Joyful'),('Keen'),('Kind'),('Legendary'),('Lively'),('Loyal'),('Lucky'),('Lunar'),('Magic'),('Majestic'),
('Merry'),('Mighty'),('Mystic'),('Neon'),('Nimble'),('Noble'),('Northern'),('Nova'),('Peaceful'),('Playful'),
('Powerful'),('Prime'),('Proud'),('Quick'),('Radiant'),('Rapid'),('Ready'),('Rocky'),('Royal'),('Sharp'),
('Shiny'),('Silent'),('Silver'),('Sleek'),('Smart'),('Smooth'),('Solar'),('Solid'),('Speedy'),('Spirited'),
('Steady'),('Stellar'),('Stormy'),('Strong'),('Sunny'),('Super'),('Swift'),('True'),('Turbo'),('Valiant'),
('Vibrant'),('Wild'),('Wise'),('Witty'),('Zesty'),('Big'),('Free'),('Great'),('Hardy'),('Fearless'),
('Glorious'),('Invincible'),('Jazzy'),('Maverick'),('Mindful'),('Optimistic'),('Radiant'),('Resolute'),('Rising'),('Savvy'),
('Skyward'),('Sparkling'),('Supreme'),('Trailblazing'),('Trusted'),('Unstoppable'),('Vivid'),('Winning'),('Young'),('Zen'),
('Amber'),('Azure'),('Black'),('Blue'),('Crimson'),('Emerald'),('Ruby'),('Sapphire'),('Scarlet'),('Snowy'),
('Copper'),('Crystal'),('Diamond'),('Maple'),('Midnight'),('Moonlit'),('Oceanic'),('Polar'),('Prairie'),('Forest'),
('Mountain'),('River'),('Thunder'),('Lightning'),('Fireborn'),('Starborn'),('Northbound'),('Westbound'),('Openroad'),('Highland')
on conflict do nothing;

insert into private.nickname_nouns (word) values
('Lion'),('Wolf'),('Bear'),('Fox'),('Falcon'),('Eagle'),('Hawk'),('Lynx'),('Tiger'),('Panther'),
('Jaguar'),('Puma'),('Cougar'),('Cheetah'),('Leopard'),('Bison'),('Buffalo'),('Moose'),('Elk'),('Stallion'),
('Mustang'),('Horse'),('Husky'),('Raven'),('Owl'),('Cobra'),('Shark'),('Dolphin'),('Whale'),('Otter'),
('Beaver'),('Badger'),('Wolverine'),('Coyote'),('Bobcat'),('Dragon'),('Phoenix'),('Griffin'),('Swan'),('Crane'),
('Heron'),('Robin'),('Sparrow'),('Finch'),('Parrot'),('Penguin'),('Turtle'),('Gecko'),('Lizard'),('Bull'),
('Ram'),('Yak'),('Zebra'),('Gazelle'),('Deer'),('Hare'),('Rabbit'),('Squirrel'),('Raccoon'),('Panda'),
('Koala'),('Seal'),('Orca'),('Marlin'),('Salmon'),('Trout'),('Rooster'),('Goose'),('Duck'),('Bee'),
('Ranger'),('Scout'),('Maverick'),('Legend'),('Knight'),('Guardian'),('Voyager'),('Pioneer'),('Rider'),('Captain'),
('Chief'),('Ace'),('Bandit'),('Hunter'),('Explorer'),('Traveler'),('Trooper'),('Skipper'),('Pilot'),('Nomad'),
('Runner'),('Driver'),('Builder'),('Maker'),('Dreamer'),('Champion'),('Hero'),('Leader'),('Warrior'),('Adventurer'),
('Rocket'),('Thunder'),('Storm'),('Blaze'),('Summit'),('Glacier'),('Mountain'),('Canyon'),('River'),('Maple'),
('Prairie'),('Forest'),('Trail'),('Peak'),('Horizon'),('Aurora'),('Comet'),('Meteor'),('Galaxy'),('Orbit'),
('Star'),('Moon'),('Sun'),('Sky'),('Cloud'),('Wind'),('Wave'),('Ocean'),('Lake'),('Creek'),
('Valley'),('Meadow'),('Aspen'),('Cedar'),('Pine'),('Birch'),('Willow'),('Stone'),('Flint'),('Frost'),
('Ember'),('Spark'),('Bolt'),('Beacon'),('Compass'),('Anchor'),('Arrow'),('Shield'),('Crown'),('Spirit'),
('Signal'),('Lantern'),('Ridge'),('Timber'),('Harbor'),('Reef'),('Dune'),('Island'),('Everest'),('Avalanche')
on conflict do nothing;
