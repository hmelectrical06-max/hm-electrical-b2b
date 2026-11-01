create table public.hm_business_documents (
 id uuid primary key, number text not null unique,
 kind text not null check(kind in ('quotation','purchase_order','material_request')),
 party_name text not null, subject text not null, approved boolean not null default false,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'), fingerprint text not null,
 created_by uuid not null, created_at timestamptz not null default now()
);
alter table public.hm_business_documents enable row level security;
revoke all on public.hm_business_documents from public,anon,authenticated,service_role;
grant select,insert on public.hm_business_documents to service_role;
create index hm_business_documents_created_idx on public.hm_business_documents(created_at desc);
create trigger hm_business_documents_audit after insert on public.hm_business_documents for each row execute function public.hm_record_audit();
