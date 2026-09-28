alter table public.listing_reports
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists resolution text,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references auth.users(id) on delete set null;

alter table public.listing_reports drop constraint if exists listing_reports_status_check;
alter table public.listing_reports
  add constraint listing_reports_status_check
  check (status = any (array['open'::text,'reviewed'::text,'resolved'::text,'dismissed'::text]));

alter table public.listing_reports drop constraint if exists listing_reports_resolution_check;
alter table public.listing_reports
  add constraint listing_reports_resolution_check
  check (resolution is null or char_length(resolution) <= 1000);

create index if not exists idx_listing_reports_status_created
  on public.listing_reports(status, created_at desc);
create index if not exists idx_listings_status_created
  on public.listings(status, created_at desc);

create policy "Admins can delete reports"
  on public.listing_reports for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create policy "Admins can delete system messages"
  on public.system_messages for delete
  to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
