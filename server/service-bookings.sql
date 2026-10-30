-- Additive setup for the optional HM ELECTRICAL home and business service division.
-- Review this script, then apply it manually in the intended Supabase project.
-- It creates new objects only and does not alter existing catalogue/enquiry tables.

create table if not exists public.service_technicians (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  mobile text not null check (length(btrim(mobile)) between 1 and 20),
  trade text not null check (length(btrim(trade)) between 1 and 100),
  availability text not null default 'Available'
    check (availability in ('Available', 'Busy', 'Unavailable')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  customer_name text not null check (length(btrim(customer_name)) between 1 and 120),
  mobile text not null check (length(btrim(mobile)) between 1 and 20),
  category text not null check (category in (
    'Electrical repairs', 'Fan installation', 'Lighting', 'MCB/DB repair',
    'Wiring', 'Plumbing repairs', 'Tap leakage', 'Pipe fitting', 'Shop/office maintenance'
  )),
  description text not null check (length(btrim(description)) between 1 and 2000),
  area text not null check (length(btrim(area)) between 1 and 100),
  address text not null check (length(btrim(address)) between 1 and 300),
  preferred_at timestamptz not null,
  status text not null default 'New'
    check (status in ('New', 'Assigned', 'In Progress', 'Completed', 'Cancelled')),
  technician_id uuid references public.service_technicians(id) on delete restrict,
  quoted_charge numeric(12,2) check (quoted_charge is null or quoted_charge between 0 and 10000000),
  final_charge numeric(12,2) check (final_charge is null or final_charge between 0 and 10000000),
  payment_status text not null default 'Pending'
    check (payment_status in ('Pending', 'Partially paid', 'Paid', 'Not applicable')),
  photo_path text,
  email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'pending', 'accepted')),
  email_provider_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_bookings
  add column if not exists email_status text not null default 'not_requested'
    check (email_status in ('not_requested', 'pending', 'accepted'));
alter table public.service_bookings
  add column if not exists email_provider_id text;

create index if not exists service_bookings_created_at_idx
  on public.service_bookings (created_at desc);
create index if not exists service_bookings_email_pending_idx
  on public.service_bookings (created_at asc)
  where email_status = 'pending';
create index if not exists service_bookings_status_idx
  on public.service_bookings (status, created_at desc);
create index if not exists service_bookings_technician_status_idx
  on public.service_bookings (technician_id, status);

create or replace function public.hm_limit_service_technicians()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(726104225);
  if (select count(*) from public.service_technicians) >= 10 then
    raise exception 'Technician roster is limited to 10 records.';
  end if;
  return new;
end;
$$;

drop trigger if exists service_technicians_max_ten on public.service_technicians;
create trigger service_technicians_max_ten
before insert on public.service_technicians
for each row execute function public.hm_limit_service_technicians();

alter table public.service_bookings enable row level security;
alter table public.service_technicians enable row level security;
revoke all on public.service_bookings, public.service_technicians from anon, authenticated;
grant select, insert, update, delete on public.service_bookings, public.service_technicians to service_role;
revoke all on function public.hm_limit_service_technicians() from public, anon, authenticated;
grant execute on function public.hm_limit_service_technicians() to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hm-service-booking-photos', 'hm-service-booking-photos', false, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

do $$
begin
  if (select public from storage.buckets where id = 'hm-service-booking-photos') is distinct from false then
    raise exception 'The service booking photo bucket must remain private.';
  end if;
end;
$$;

-- Block client-role access to this bucket even if broader Storage policies exist.
-- Other buckets and the backend service_role are not restricted by these policies.
drop policy if exists hm_service_booking_photos_private_select on storage.objects;
create policy hm_service_booking_photos_private_select
  on storage.objects as restrictive for select to anon, authenticated
  using (bucket_id <> 'hm-service-booking-photos');
drop policy if exists hm_service_booking_photos_private_insert on storage.objects;
create policy hm_service_booking_photos_private_insert
  on storage.objects as restrictive for insert to anon, authenticated
  with check (bucket_id <> 'hm-service-booking-photos');
drop policy if exists hm_service_booking_photos_private_update on storage.objects;
create policy hm_service_booking_photos_private_update
  on storage.objects as restrictive for update to anon, authenticated
  using (bucket_id <> 'hm-service-booking-photos')
  with check (bucket_id <> 'hm-service-booking-photos');
drop policy if exists hm_service_booking_photos_private_delete on storage.objects;
create policy hm_service_booking_photos_private_delete
  on storage.objects as restrictive for delete to anon, authenticated
  using (bucket_id <> 'hm-service-booking-photos');

notify pgrst, 'reload schema';
