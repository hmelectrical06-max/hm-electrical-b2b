-- Private, append-only file register. No client database or storage access.
create table public.hm_enquiry_work (
 enquiry_id uuid primary key references public.enquiries(id),
 state jsonb not null check(jsonb_typeof(state)='object'),
 updated_by uuid not null, updated_at timestamptz not null default now()
);
alter table public.hm_enquiry_work enable row level security;
revoke all on public.hm_enquiry_work from public,anon,authenticated,service_role;
grant select,insert,update on public.hm_enquiry_work to service_role;
create trigger hm_enquiry_work_audit after insert or update on public.hm_enquiry_work for each row execute function public.hm_record_audit();
create table public.hm_company_files (
 id uuid primary key, name text not null check(length(name) between 1 and 180),
 object_path text not null unique, sha256 text not null, size_bytes integer not null check(size_bytes between 1 and 3145728),
 created_by uuid not null, created_at timestamptz not null default now()
);
alter table public.hm_company_files enable row level security;
revoke all on public.hm_company_files from public,anon,authenticated,service_role;
grant select,insert on public.hm_company_files to service_role;
create trigger hm_company_files_audit after insert on public.hm_company_files for each row execute function public.hm_record_audit();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hm-company-private','hm-company-private',false,3145728,array['application/pdf']);
create policy hm_company_files_no_clients on storage.objects as restrictive for all to anon,authenticated
using(bucket_id<>'hm-company-private') with check(bucket_id<>'hm-company-private');
notify pgrst,'reload schema';
