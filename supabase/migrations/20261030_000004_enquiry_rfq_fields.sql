-- Add optional company and required-date fields to the existing enquiry workflow.
-- Existing enquiry records and access controls are preserved.
begin;

alter table public.enquiries
  add column if not exists company_name text,
  add column if not exists required_date date;

create or replace function public.hm_save(p_request jsonb,p_fingerprint text)
returns setof public.enquiries
language plpgsql
security invoker
set search_path=public
as $$
begin
 insert into public.enquiries(
   request_id,fingerprint,name,company_name,phone,email,location,required_date,type,details,items,consent
 )
 values (
   (p_request->>'request_id')::uuid,
   p_fingerprint,
   p_request->>'name',
   nullif(p_request->>'company_name',''),
   p_request->>'phone',
   coalesce(p_request->>'email',''),
   p_request->>'location',
   nullif(p_request->>'required_date','')::date,
   p_request->>'type',
   coalesce(p_request->>'details',''),
   coalesce(p_request->'items','[]'::jsonb),
   (p_request->>'consent')::boolean
 )
 on conflict (request_id) do nothing;
 return query
   select * from public.enquiries
   where request_id=(p_request->>'request_id')::uuid;
end;
$$;

revoke all on function public.hm_save(jsonb,text) from public,anon,authenticated;
grant execute on function public.hm_save(jsonb,text) to service_role;

commit;
