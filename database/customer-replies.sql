-- Transactional acknowledgements only. No historic bulk send and no public access.
create table if not exists public.hm_customer_replies (
 id uuid primary key default gen_random_uuid(),lead_key text not null unique,
 recipient text not null check(length(recipient) between 5 and 254),
 payload jsonb not null,status text not null default 'pending' check(status in ('pending','sending','accepted','review','stopped')),
 attempts integer not null default 0 check(attempts between 0 and 6),
 next_attempt_at timestamptz not null default now(),lease_until timestamptz,
 provider_id text,last_error text,created_at timestamptz not null default now(),accepted_at timestamptz,
 expires_at timestamptz not null default (now()+interval '22 hours')
);
alter table public.hm_customer_replies enable row level security;
revoke all on public.hm_customer_replies from public,anon,authenticated;
grant select,insert,update on public.hm_customer_replies to service_role;
create index if not exists hm_customer_replies_pending_idx on public.hm_customer_replies(status,next_attempt_at);
alter table public.service_bookings add column if not exists email text not null default '';
create or replace function public.hm_claim_customer_replies() returns setof public.hm_customer_replies
language plpgsql security invoker set search_path='' as $$
declare r public.hm_customer_replies; n integer:=0;
begin
 perform pg_advisory_xact_lock(hashtextextended('hm-customer-mail',0));
 -- Provider idempotency lasts 24 hours: ambiguous older sends require manual review.
 update public.hm_customer_replies set status='review',last_error='RETRY_WINDOW_EXPIRED'
 where status in ('pending','sending') and (expires_at<=now() or attempts>=6) and (lease_until is null or lease_until<now());
 for r in select * from public.hm_customer_replies
  where (status='pending' and next_attempt_at<=now() or status='sending' and lease_until<now())
   and expires_at>now() and attempts<6 order by created_at for update skip locked
 loop
  exit when n>=5;
  if (select count(*) from public.hm_customer_replies where status in ('sending','accepted') and coalesce(accepted_at,lease_until)>=date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')>=50 then exit; end if;
  if (select count(*) from public.hm_customer_replies where id<>r.id and recipient=r.recipient and status in ('sending','accepted') and created_at>now()-interval '1 day')>=3 then continue; end if;
  update public.hm_customer_replies set status='sending',attempts=attempts+1,lease_until=now()+interval '10 minutes'
   where id=r.id returning * into r;
  n:=n+1; return next r;
 end loop;
end $$;
revoke all on function public.hm_claim_customer_replies() from public,anon,authenticated;
grant execute on function public.hm_claim_customer_replies() to service_role;

-- All three website intake forms must appear in the assistant desk.
create or replace function public.hm_ai_pending() returns table(lead_key text,name text,details text,location text,items jsonb)
language sql stable security invoker set search_path='' as $$
 select q.lead_key,q.name,q.details,q.location,q.items from (
  select 'website:'||e.id::text lead_key,e.name,e.details,e.location,e.items,e.created_at from public.enquiries e
   where e.status<>'Closed'
  union all
  select 'manpower:'||e.id::text,e.contact_name,e.trade||' x '||e.quantity||'. '||e.details||' Required: '||e.required_date||'. Duration: '||e.duration,e.site_location,'[]'::jsonb,e.created_at from public.hm_manpower_requests e
   where e.status<>'Closed' and e.trade in ('Electrician','Plumber')
  union all
  select 'booking:'||e.id::text,e.customer_name,e.category||'. '||e.description||'. Preferred: '||e.preferred_at,e.area,'[]'::jsonb,e.created_at from public.service_bookings e
   where e.status not in ('Completed','Cancelled')
  union all
  select 'external:'||e.id::text,e.name,e.details,e.location,'[]'::jsonb,e.created_at from public.hm_ai_external_leads e where e.status='New'
 )q where not exists(select 1 from public.hm_ai_drafts d where d.lead_key=q.lead_key) order by q.created_at limit 3;
$$;
revoke all on function public.hm_ai_pending() from public,anon,authenticated;
grant execute on function public.hm_ai_pending() to service_role;
