-- Fresh isolated Supabase project only. Review before applying.
-- Existing production databases require a schema comparison, not blind execution.
begin;
create table if not exists public.enquiries (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 fingerprint text not null,
 name text not null,
 company_name text,
 phone text not null,
 email text not null default '',
 location text not null,
 required_date date,
 type text not null,
 details text not null default '',
 items jsonb not null default '[]'::jsonb,
 consent boolean not null check(consent),
 status text not null default 'New' check(status in ('New','Contacted','Quotation Sent','Confirmed','Closed')),
 email_status text not null default 'pending' check(email_status in ('pending','accepted')),
 email_provider_id text,
 notification_claimed_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 search_text text generated always as (name || ' ' || coalesce(company_name,'') || ' ' || phone || ' ' || email || ' ' || location || ' ' || details) stored
);
create index if not exists hm_enquiries_created on public.enquiries(created_at desc);
create table if not exists public.hm_rate_limits (
 key text primary key,
 window_started timestamptz not null default now(),
 attempts integer not null default 1
);
alter table public.enquiries enable row level security;
alter table public.hm_rate_limits enable row level security;
revoke all on public.enquiries, public.hm_rate_limits from public,anon,authenticated;
grant select,insert,update,delete on public.enquiries,public.hm_rate_limits to service_role;
create or replace function public.hm_save(p_request jsonb,p_fingerprint text)
returns setof public.enquiries language plpgsql security invoker set search_path=public as $$
begin
 insert into public.enquiries(request_id,fingerprint,name,company_name,phone,email,location,required_date,type,details,items,consent)
 values ((p_request->>'request_id')::uuid,p_fingerprint,p_request->>'name',nullif(p_request->>'company_name',''),p_request->>'phone',
 coalesce(p_request->>'email',''),p_request->>'location',nullif(p_request->>'required_date','')::date,p_request->>'type',coalesce(p_request->>'details',''),
 coalesce(p_request->'items','[]'::jsonb),(p_request->>'consent')::boolean)
 on conflict (request_id) do nothing;
 return query select * from public.enquiries where request_id=(p_request->>'request_id')::uuid;
end; $$;
create or replace function public.hm_rate(p_key text,p_limit integer)
returns boolean language plpgsql security invoker set search_path=public as $$
declare n integer;
begin
 if p_limit < 1 or p_limit > 1000 then return false; end if;
 insert into public.hm_rate_limits(key) values(p_key)
 on conflict(key) do update set
 attempts=case when hm_rate_limits.window_started < now()-interval '15 minutes' then 1 else hm_rate_limits.attempts+1 end,
 window_started=case when hm_rate_limits.window_started < now()-interval '15 minutes' then now() else hm_rate_limits.window_started end
 returning attempts into n;
 return n<=p_limit;
end; $$;
create or replace function public.hm_claim_notifications()
returns setof public.enquiries language sql security invoker set search_path=public as $$
 update public.enquiries set notification_claimed_at=now()
 where id in (select id from public.enquiries where email_status='pending'
 and created_at>now()-interval '23 hours'
 and (notification_claimed_at is null or notification_claimed_at<now()-interval '10 minutes')
 order by created_at limit 25 for update skip locked)
 returning *;
$$;
revoke all on function public.hm_save(jsonb,text),public.hm_rate(text,integer),public.hm_claim_notifications() from public,anon,authenticated;
grant execute on function public.hm_save(jsonb,text),public.hm_rate(text,integer),public.hm_claim_notifications() to service_role;
commit;
