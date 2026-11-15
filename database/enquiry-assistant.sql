-- Additive private assistant workspace. The service-role API authenticates admins with MFA.
create table if not exists public.hm_ai_external_leads (
 id uuid primary key default gen_random_uuid(), source_key text not null unique,
 source text not null check(source in ('justdial','manual')), name text not null check(length(name) between 1 and 120),
 phone text not null default '',email text not null default '',location text not null default '',
 details text not null check(length(details) between 1 and 2500),status text not null default 'New',
 created_by uuid,created_at timestamptz not null default now()
);
create table if not exists public.hm_ai_drafts (
 id uuid primary key,lead_key text not null,reply text not null check(length(reply) between 1 and 2000),
 staff_note text not null default '',engine text not null,status text not null default 'draft' check(status in ('draft','approved')),
 created_by uuid,approved_by uuid,approved_at timestamptz,created_at timestamptz not null default now()
);
create table if not exists public.hm_ai_budget (
 month date primary key,reserved_inr integer not null default 0 check(reserved_inr between 0 and 500),
 requests integer not null default 0 check(requests between 0 and 100)
);
create table if not exists public.hm_ai_usage (
 request_id uuid primary key,month date not null references public.hm_ai_budget(month),reserved_inr integer not null default 5 check(reserved_inr=5),created_at timestamptz not null default now()
);
create index if not exists hm_ai_external_created_idx on public.hm_ai_external_leads(created_at desc);
create index if not exists hm_ai_drafts_lead_idx on public.hm_ai_drafts(lead_key,created_at desc);
alter table public.hm_ai_external_leads enable row level security;
alter table public.hm_ai_drafts enable row level security;
alter table public.hm_ai_budget enable row level security;
alter table public.hm_ai_usage enable row level security;
revoke all on public.hm_ai_external_leads,public.hm_ai_drafts,public.hm_ai_budget,public.hm_ai_usage from public,anon,authenticated;
grant select,insert,update on public.hm_ai_external_leads,public.hm_ai_drafts,public.hm_ai_budget,public.hm_ai_usage to service_role;
create or replace function public.hm_ai_reserve(p_request uuid) returns boolean language plpgsql security invoker set search_path='' as $$
declare m date := date_trunc('month',now() at time zone 'Asia/Kolkata')::date; used integer;
begin
 insert into public.hm_ai_budget(month) values(m) on conflict do nothing;
 select requests into used from public.hm_ai_budget where month=m for update;
 if exists(select 1 from public.hm_ai_usage where request_id=p_request) or used>=100 then return false; end if;
 insert into public.hm_ai_usage(request_id,month) values(p_request,m);
 update public.hm_ai_budget set requests=requests+1,reserved_inr=reserved_inr+5 where month=m;
 return true;
end $$;
revoke all on function public.hm_ai_reserve(uuid) from public,anon,authenticated;
grant execute on function public.hm_ai_reserve(uuid) to service_role;
-- A background draft has no human creator. Approval still records a real admin.
alter table public.hm_ai_drafts alter column created_by drop not null;
create or replace function public.hm_ai_pending() returns table(lead_key text,name text,details text,location text,items jsonb) language sql stable security invoker set search_path='' as $$
 select q.lead_key,q.name,q.details,q.location,q.items from (
  select 'website:'||e.id::text lead_key,e.name,e.details,e.location,e.items,e.created_at from public.enquiries e
   where e.status<>'Closed' and not exists(select 1 from public.hm_ai_drafts d where d.lead_key='website:'||e.id::text)
  union all
  select 'external:'||e.id::text,e.name,e.details,e.location,'[]'::jsonb,e.created_at from public.hm_ai_external_leads e
   where e.status='New' and not exists(select 1 from public.hm_ai_drafts d where d.lead_key='external:'||e.id::text)
 ) q order by q.created_at limit 3;
$$;
revoke all on function public.hm_ai_pending() from public,anon,authenticated;
grant execute on function public.hm_ai_pending() to service_role;
