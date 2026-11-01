-- Additive runtime content and private manpower requests. Existing rows remain intact.
create table public.hm_catalogue_products (
 product_id text primary key, data jsonb not null check(jsonb_typeof(data)='object'),
 updated_by uuid, updated_at timestamptz not null default now()
);
create table public.hm_service_listings (
 service_id text primary key, data jsonb not null check(jsonb_typeof(data)='object'),
 enabled boolean not null default true, updated_by uuid, updated_at timestamptz not null default now()
);
create table public.hm_manpower_categories (
 trade text primary key check(trade in ('Electrician','Plumber','Fire Fitter','Welder','Helper','Civil Labour','Supervisor')),
 description text not null default '', available_count integer not null default 0 check(available_count between 0 and 10000),
 availability text not null default 'on_request' check(availability in ('on_request','available','fully_booked')),
 updated_by uuid, updated_at timestamptz not null default now()
);
insert into public.hm_manpower_categories(trade,description) values
 ('Electrician','Installation, wiring, cable laying and electrical maintenance.'),
 ('Plumber','Water supply, drainage, fixtures and plumbing maintenance.'),
 ('Fire Fitter','Fire-fighting piping, sprinkler and hydrant installation.'),
 ('Welder','Fabrication, welding and site pipe preparation.'),
 ('Helper','Site support, material handling and trade assistance.'),
 ('Civil Labour','Civil site work and labour support for agreed scopes.'),
 ('Supervisor','Trade supervision, site coordination and execution support.');
create table public.hm_manpower_requests (
 id uuid primary key default gen_random_uuid(), request_id uuid not null unique, fingerprint text not null,
 trade text not null references public.hm_manpower_categories(trade), quantity integer not null check(quantity between 1 and 500),
 site_location text not null, duration text not null, contact_name text not null, phone text not null,
 email text not null default '', required_date date not null, details text not null default '', consent boolean not null check(consent),
 status text not null default 'New' check(status in ('New','Contacted','Quoted','Confirmed','Closed')),
 email_status text not null default 'pending' check(email_status in ('pending','accepted')),
 email_provider_id text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index hm_manpower_requests_created_idx on public.hm_manpower_requests(created_at desc,id);
create index hm_manpower_requests_pending_idx on public.hm_manpower_requests(created_at) where email_status='pending';
create table public.hm_audit_log (
 id bigint generated always as identity primary key, actor_user_id uuid,
 action text not null, entity_table text not null, entity_id text,
 changed_fields text[] not null default '{}', created_at timestamptz not null default now()
);
create index hm_audit_created_idx on public.hm_audit_log(created_at desc,id);
create function public.hm_save_manpower(p_request jsonb,p_fingerprint text)
returns setof public.hm_manpower_requests language plpgsql security invoker set search_path='' as $$
begin
 insert into public.hm_manpower_requests(request_id,fingerprint,trade,quantity,site_location,duration,contact_name,phone,email,required_date,details,consent)
 values((p_request->>'request_id')::uuid,p_fingerprint,p_request->>'trade',(p_request->>'quantity')::integer,
 p_request->>'site_location',p_request->>'duration',p_request->>'contact_name',p_request->>'phone',
 coalesce(p_request->>'email',''),(p_request->>'required_date')::date,coalesce(p_request->>'details',''),(p_request->>'consent')::boolean)
 on conflict(request_id) do nothing;
 return query select * from public.hm_manpower_requests where request_id=(p_request->>'request_id')::uuid;
end; $$;
revoke all on function public.hm_save_manpower(jsonb,text) from public,anon,authenticated;
grant execute on function public.hm_save_manpower(jsonb,text) to service_role;

-- Only the authenticated server APIs expose explicitly selected public fields.
do $$ declare t text; begin
 foreach t in array array['hm_catalogue_products','hm_service_listings','hm_manpower_categories','hm_manpower_requests','hm_audit_log'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
 execute format('grant select,insert,update on public.%I to service_role',t);
 end loop;
end $$;
revoke update on public.hm_audit_log from service_role;
grant usage,select on sequence public.hm_audit_log_id_seq to service_role;

create function public.hm_record_audit() returns trigger language plpgsql security invoker set search_path='' as $$
declare row_data jsonb; old_data jsonb; actor text; fields text[];
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 old_data:=case when tg_op='UPDATE' then to_jsonb(old) else '{}'::jsonb end;
 actor:=nullif(coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}'::jsonb)->>'x-hm-actor','');
 select coalesce(array_agg(key order by key),'{}') into fields from jsonb_each(row_data)
 where (tg_op<>'UPDATE' or value is distinct from old_data->key) and key not in ('fingerprint');
 insert into public.hm_audit_log(actor_user_id,action,entity_table,entity_id,changed_fields)
 values(case when actor ~ '^[0-9a-fA-F-]{36}$' then actor::uuid else null end,tg_op,tg_table_name,
 coalesce(row_data->>'id',row_data->>'product_id',row_data->>'service_id',row_data->>'trade'),fields);
 if tg_op='DELETE' then return old; end if;
 return new;
end; $$;
revoke all on function public.hm_record_audit() from public,anon,authenticated;
grant execute on function public.hm_record_audit() to service_role;
do $$ declare t text; begin
 foreach t in array array['hm_catalogue_products','hm_service_listings','hm_manpower_categories','hm_manpower_requests',
 'catalogue_product_metadata','service_technicians','service_bookings','enquiries','inventory_movements','quotations'] loop
 execute format('create trigger hm_audit_changes after insert or update or delete on public.%I for each row execute function public.hm_record_audit()',t);
 end loop;
end $$;
notify pgrst,'reload schema';

-- Public product imagery contains only images explicitly approved by an MFA admin.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('hm-product-photos','hm-product-photos',true,3145728,array['image/jpeg']) on conflict(id) do nothing;
create policy hm_product_photos_no_client_insert on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'hm-product-photos');
create policy hm_product_photos_no_client_update on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'hm-product-photos') with check(bucket_id<>'hm-product-photos');
create policy hm_product_photos_no_client_delete on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'hm-product-photos');
