drop policy if exists "No client access to telegram accounts" on public.telegram_accounts;
create policy "No client access to telegram accounts"
on public.telegram_accounts
for all to anon,authenticated
using (false)
with check (false);

drop policy if exists "No client access to cleanup queue" on public.storage_cleanup_queue;
create policy "No client access to cleanup queue"
on public.storage_cleanup_queue
for all to anon,authenticated
using (false)
with check (false);
