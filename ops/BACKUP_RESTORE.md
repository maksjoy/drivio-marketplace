# P2PCars backup and restore runbook

## Scope
A recoverable P2PCars backup needs two independent parts:

1. PostgreSQL/Auth database state (users, listings, images metadata, reports, favorites, moderation and analytics).
2. `listing-photos` Storage objects. Database backups do **not** replace a backup of the photo bytes.

## Production baseline — 2026-09-11
At the time this runbook was added, the production project contained:

- 9 Auth users
- 14 listings (14 active, 0 sold)
- 28 `listing_images` rows
- 7 objects in `listing-photos`
- approximately 1,592,693 bytes of listing-photo storage

These values are a verification baseline only, not a backup.

## Backup procedure

1. Confirm Supabase dashboard reports a recent successful database backup and note retention for the current plan.
2. Export/copy the `listing-photos` bucket to encrypted, access-restricted backup storage. Preserve exact object paths.
3. Record the backup time, database backup identifier/time, Storage object count, and total Storage bytes in a private operations record. Never commit database dumps, user data, access tokens, service-role keys, or backup credentials to GitHub.
4. Keep at least one backup outside the production Supabase project/account blast radius.

## Restore drill

Always restore into a separate non-production project first.

1. Restore the database backup into the isolated project.
2. Restore `listing-photos` using the original object paths.
3. Verify Auth users exist and RLS is enabled on every exposed table.
4. Verify a representative listing loads its metadata and photos.
5. Verify an ordinary signed-in user cannot read/edit another user's private/pending data.
6. Verify an admin-only RPC denies a non-admin user.
7. Verify Sold → 14-day cleanup behavior and storage cleanup configuration.
8. Compare restored counts against the recorded backup inventory.
9. Delete or securely retain the isolated restore environment according to the test plan.

## Launch gate

Public launch should not call backup/restore "verified" until a complete database + Storage restore drill has succeeded in a separate environment. This repository intentionally does not contain production backup material.
