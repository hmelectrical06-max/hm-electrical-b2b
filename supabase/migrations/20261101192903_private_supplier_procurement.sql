-- Private purchasing records. No public supplier directory or messaging credentials.
create table public.hm_suppliers (
 id uuid primary key default gen_random_uuid(), source_key text unique,
 source_id text not null default '', company_name text not null check(length(company_name) between 1 and 200),
 trade text not null check(length(trade) between 1 and 100), product_range text not null default '',
 contact_person text not null default '', phone text not null default '', alternate_phone text not null default '',
 email text not null default '', whatsapp text not null default '', whatsapp_confirmed boolean not null default false,
 address text not null default '', source_url text not null default '', source_checked_at date,
 verification_status text not null default 'Unconfirmed' check(verification_status in ('Unconfirmed','Contacted','Contact confirmed')),
 trade_notes text not null default '', call_status text not null default '', rate_notes text not null default '',
 payment_terms text not null default '', delivery_terms text not null default '', notes text not null default '',
 active boolean not null default true, source_data jsonb not null default '{}',
 created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(not whatsapp_confirmed or whatsapp ~ '^[1-9][0-9]{9,14}$')
);
create index hm_suppliers_trade_idx on public.hm_suppliers(trade,company_name);
create table public.hm_supplier_rfqs (
 id uuid primary key, reference text not null unique, source_enquiry_id uuid references public.enquiries(id),
 title text not null, delivery_area text not null default '', required_date date, supplier_note text not null default '',
 items jsonb not null check(jsonb_typeof(items)='array'), fingerprint text not null,
 created_by uuid not null, created_at timestamptz not null default now()
);
create index hm_supplier_rfqs_created_idx on public.hm_supplier_rfqs(created_at desc,id);
create index hm_supplier_rfqs_enquiry_idx on public.hm_supplier_rfqs(source_enquiry_id);
create table public.hm_supplier_rfq_recipients (
 id uuid primary key default gen_random_uuid(), rfq_id uuid not null references public.hm_supplier_rfqs(id),
 supplier_id uuid not null references public.hm_suppliers(id),
 status text not null default 'Draft' check(status in ('Draft','Contacted','Quoted','Selected','Ordered','Received','Closed')),
 contacted_at timestamptz, contacted_via text check(contacted_via in ('email','whatsapp','other')),
 quoted_total numeric(15,2) check(quoted_total is null or quoted_total between 0 and 9999999999999.99),
 quote_reference text not null default '', response_notes text not null default '',
 payment_terms text not null default '', delivery_terms text not null default '', order_reference text not null default '',
 follow_up_date date, updated_by uuid, updated_at timestamptz not null default now(),
 unique(rfq_id,supplier_id)
);
create index hm_supplier_recipients_supplier_idx on public.hm_supplier_rfq_recipients(supplier_id,updated_at desc);
create index hm_supplier_recipients_followup_idx on public.hm_supplier_rfq_recipients(follow_up_date) where status not in ('Closed','Received');
create table public.hm_supplier_activity (
 id bigint generated always as identity primary key, recipient_id uuid not null references public.hm_supplier_rfq_recipients(id),
 actor_user_id uuid not null, action text not null check(action in ('Draft prepared','Contact confirmed','Response saved')),
 details jsonb not null default '{}', created_at timestamptz not null default now()
);
create index hm_supplier_activity_recipient_idx on public.hm_supplier_activity(recipient_id,created_at desc);

create function public.hm_create_supplier_rfq(p_rfq jsonb,p_suppliers uuid[])
returns setof public.hm_supplier_rfqs language plpgsql security invoker set search_path='' as $$
declare inserted uuid; expected integer; actual integer;
begin
 select count(distinct x) into expected from unnest(p_suppliers) x;
 if expected<1 or expected>100 then raise exception 'Choose 1 to 100 suppliers.'; end if;
 insert into public.hm_supplier_rfqs(id,reference,source_enquiry_id,title,delivery_area,required_date,supplier_note,items,fingerprint,created_by)
 values((p_rfq->>'id')::uuid,p_rfq->>'reference',nullif(p_rfq->>'source_enquiry_id','')::uuid,p_rfq->>'title',
 p_rfq->>'delivery_area',nullif(p_rfq->>'required_date','')::date,p_rfq->>'supplier_note',p_rfq->'items',p_rfq->>'fingerprint',(p_rfq->>'created_by')::uuid)
 on conflict(id) do nothing returning id into inserted;
 if inserted is not null then
  insert into public.hm_supplier_rfq_recipients(rfq_id,supplier_id)
  select inserted,id from public.hm_suppliers where id=any(p_suppliers) and active;
  get diagnostics actual=row_count;
  if actual<>expected then raise exception 'A selected supplier is missing or inactive.'; end if;
 end if;
 return query select * from public.hm_supplier_rfqs where id=(p_rfq->>'id')::uuid;
end; $$;

create function public.hm_supplier_recipient_action(p_id uuid,p_action text,p_data jsonb,p_actor uuid)
returns setof public.hm_supplier_rfq_recipients language plpgsql security invoker set search_path='' as $$
declare current_row public.hm_supplier_rfq_recipients; event_action text;
begin
 select * into current_row from public.hm_supplier_rfq_recipients where id=p_id for update;
 if not found then raise exception 'Supplier RFQ recipient not found.'; end if;
 if p_action='draft' then
  event_action:='Draft prepared';
 elsif p_action='contact' then
  update public.hm_supplier_rfq_recipients set contacted_at=now(),contacted_via=p_data->>'channel',
   status=case when status='Draft' then 'Contacted' else status end,updated_by=p_actor,updated_at=now() where id=p_id;
  event_action:='Contact confirmed';
 elsif p_action='response' then
  update public.hm_supplier_rfq_recipients set status=p_data->>'status',
   quoted_total=nullif(p_data->>'quoted_total','')::numeric,quote_reference=p_data->>'quote_reference',
   response_notes=p_data->>'response_notes',payment_terms=p_data->>'payment_terms',delivery_terms=p_data->>'delivery_terms',
   order_reference=p_data->>'order_reference',follow_up_date=nullif(p_data->>'follow_up_date','')::date,
   updated_by=p_actor,updated_at=now() where id=p_id;
  event_action:='Response saved';
 else raise exception 'Invalid supplier activity.';
 end if;
 insert into public.hm_supplier_activity(recipient_id,actor_user_id,action,details) values(p_id,p_actor,event_action,p_data);
 return query select * from public.hm_supplier_rfq_recipients where id=p_id;
end; $$;

do $$ declare t text; begin
 foreach t in array array['hm_suppliers','hm_supplier_rfqs','hm_supplier_rfq_recipients','hm_supplier_activity'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select,insert,update on public.%I to service_role',t);
  execute format('create trigger hm_audit_changes after insert or update or delete on public.%I for each row execute function public.hm_record_audit()',t);
 end loop;
end $$;
revoke update on public.hm_supplier_activity from service_role;
revoke update on public.hm_supplier_rfqs from service_role;
grant usage,select on sequence public.hm_supplier_activity_id_seq to service_role;
revoke all on function public.hm_create_supplier_rfq(jsonb,uuid[]) from public,anon,authenticated;
revoke all on function public.hm_supplier_recipient_action(uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.hm_create_supplier_rfq(jsonb,uuid[]) to service_role;
grant execute on function public.hm_supplier_recipient_action(uuid,text,jsonb,uuid) to service_role;
notify pgrst,'reload schema';
