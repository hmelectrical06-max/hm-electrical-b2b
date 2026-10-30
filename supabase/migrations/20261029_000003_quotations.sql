-- Additive quotation records, revisions, and status history.
-- Existing catalogue, enquiry, customer, and inventory rows are not modified.

create table if not exists public.quotation_counters (
  period text primary key check (period ~ '^[0-9]{6}$'),
  last_value bigint not null check (last_value > 0)
);

create table if not exists public.quotations (
  quotation_id uuid primary key default gen_random_uuid(),
  quotation_number text not null unique,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  source_enquiry_id uuid,
  customer_name text not null,
  company_name text,
  mobile text,
  email text,
  customer_gstin text,
  billing_address text,
  shipping_address text,
  place_of_supply text,
  tax_mode text not null default 'none'
    check (tax_mode in ('none', 'intra_state', 'inter_state')),
  valid_until date,
  payment_terms text,
  delivery_terms text,
  warranty_terms text,
  notes text,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  discount_total numeric(14,2) not null check (discount_total >= 0),
  taxable_total numeric(14,2) not null check (taxable_total >= 0),
  cgst_amount numeric(14,2) not null default 0 check (cgst_amount >= 0),
  sgst_amount numeric(14,2) not null default 0 check (sgst_amount >= 0),
  igst_amount numeric(14,2) not null default 0 check (igst_amount >= 0),
  freight numeric(14,2) not null default 0 check (freight >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  grand_total numeric(14,2) not null check (grand_total >= 0),
  created_by uuid not null,
  updated_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  line_id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (quotation_id) on delete cascade,
  line_no integer not null check (line_no > 0),
  item_type text not null check (item_type in ('product', 'service')),
  product_id text,
  product_code text not null,
  description text not null,
  unit text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  unit_rate numeric(14,2) not null check (unit_rate >= 0),
  discount_amount numeric(14,2) not null default 0 check (discount_amount >= 0),
  tax_rate numeric(5,2) check (tax_rate is null or tax_rate between 0 and 100),
  hsn_sac text,
  tax_source_url text check (tax_source_url is null or tax_source_url ~ '^https://[^[:space:]]+$'),
  tax_verified_at date,
  taxable_amount numeric(14,2) not null check (taxable_amount >= 0),
  tax_amount numeric(14,2) not null check (tax_amount >= 0),
  constraint quotation_item_type_product_match check (
    (item_type = 'product' and product_id is not null)
    or (item_type = 'service' and product_id is null)
  ),
  constraint quotation_item_unique_line unique (quotation_id, line_no)
);

create table if not exists public.quotation_versions (
  quotation_id uuid not null references public.quotations (quotation_id),
  revision integer not null check (revision > 0),
  snapshot jsonb not null,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (quotation_id, revision)
);

create table if not exists public.quotation_status_history (
  event_id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (quotation_id),
  previous_status text not null,
  new_status text not null,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.quotation_counters enable row level security;
alter table public.quotations enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_versions enable row level security;
alter table public.quotation_status_history enable row level security;

revoke all on public.quotation_counters, public.quotations, public.quotation_items,
  public.quotation_versions, public.quotation_status_history
  from public, anon, authenticated;
grant select on public.quotations, public.quotation_items, public.quotation_versions,
  public.quotation_status_history to service_role;

create or replace function public.hm_quotation_reject_history_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Quotation audit history is immutable.';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'quotation_versions_immutable'
      and tgrelid = 'public.quotation_versions'::regclass
      and not tgisinternal
  ) then
    create trigger quotation_versions_immutable
      before update or delete on public.quotation_versions
      for each row execute function public.hm_quotation_reject_history_change();
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'quotation_status_history_immutable'
      and tgrelid = 'public.quotation_status_history'::regclass
      and not tgisinternal
  ) then
    create trigger quotation_status_history_immutable
      before update or delete on public.quotation_status_history
      for each row execute function public.hm_quotation_reject_history_change();
  end if;
end;
$$;

create or replace function public.hm_save_quotation(
  p_quotation_id uuid,
  p_data jsonb,
  p_actor_id uuid,
  p_allow_revision boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotations%rowtype;
  v_period text;
  v_counter bigint;
  v_revision integer;
  v_status text;
  v_snapshot jsonb;
  v_item_count integer;
begin
  if p_data is null or jsonb_typeof(p_data) <> 'object' or p_actor_id is null
    or jsonb_typeof(p_data->'items') <> 'array'
    or jsonb_array_length(p_data->'items') < 1
    or jsonb_array_length(p_data->'items') > 100 then
    raise exception 'Invalid quotation data.';
  end if;

  select count(*) into v_item_count from jsonb_to_recordset(p_data->'items') as x(
    item_type text, product_id text, product_code text, description text, unit text,
    quantity numeric, unit_rate numeric, discount_amount numeric, tax_rate numeric,
    taxable_amount numeric, tax_amount numeric
  );
  if v_item_count <> jsonb_array_length(p_data->'items') then
    raise exception 'Invalid quotation data.';
  end if;

  if p_quotation_id is null then
    v_period := to_char(timezone('Asia/Kolkata', now()), 'YYYYMM');
    insert into public.quotation_counters (period, last_value)
      values (v_period, 1)
      on conflict (period) do update
        set last_value = public.quotation_counters.last_value + 1
      returning last_value into v_counter;
    v_quote.quotation_id := gen_random_uuid();
    v_quote.quotation_number := 'QTN-' || v_period || '-' || lpad(v_counter::text, 6, '0');
    v_revision := 1;
    v_status := 'draft';
  else
    select * into v_quote from public.quotations
      where quotation_id = p_quotation_id for update;
    if not found then
      raise exception 'Quotation was not found.';
    end if;
    if v_quote.status <> 'draft' and not p_allow_revision then
      raise exception 'Create an explicit revision before editing a non-draft quotation.';
    end if;
    v_revision := v_quote.revision + 1;
    v_status := case when p_allow_revision then 'draft' else v_quote.status end;
  end if;

  insert into public.quotations (
    quotation_id, quotation_number, revision, status, source_enquiry_id,
    customer_name, company_name, mobile, email, customer_gstin,
    billing_address, shipping_address, place_of_supply, tax_mode, valid_until,
    payment_terms, delivery_terms, warranty_terms, notes,
    subtotal, discount_total, taxable_total, cgst_amount, sgst_amount, igst_amount,
    freight, other_charges, grand_total, created_by, updated_by, created_at, updated_at
  ) values (
    v_quote.quotation_id, v_quote.quotation_number, v_revision, v_status,
    nullif(p_data->>'source_enquiry_id', '')::uuid,
    p_data->>'customer_name', nullif(p_data->>'company_name', ''),
    nullif(p_data->>'mobile', ''), nullif(p_data->>'email', ''),
    nullif(p_data->>'customer_gstin', ''), nullif(p_data->>'billing_address', ''),
    nullif(p_data->>'shipping_address', ''), nullif(p_data->>'place_of_supply', ''),
    p_data->>'tax_mode', nullif(p_data->>'valid_until', '')::date,
    nullif(p_data->>'payment_terms', ''), nullif(p_data->>'delivery_terms', ''),
    nullif(p_data->>'warranty_terms', ''), nullif(p_data->>'notes', ''),
    (p_data->>'subtotal')::numeric, (p_data->>'discount_total')::numeric,
    (p_data->>'taxable_total')::numeric, (p_data->>'cgst_amount')::numeric,
    (p_data->>'sgst_amount')::numeric, (p_data->>'igst_amount')::numeric,
    (p_data->>'freight')::numeric, (p_data->>'other_charges')::numeric,
    (p_data->>'grand_total')::numeric, p_actor_id, p_actor_id, now(), now()
  )
  on conflict (quotation_id) do update set
    revision = excluded.revision,
    status = excluded.status,
    source_enquiry_id = excluded.source_enquiry_id,
    customer_name = excluded.customer_name,
    company_name = excluded.company_name,
    mobile = excluded.mobile,
    email = excluded.email,
    customer_gstin = excluded.customer_gstin,
    billing_address = excluded.billing_address,
    shipping_address = excluded.shipping_address,
    place_of_supply = excluded.place_of_supply,
    tax_mode = excluded.tax_mode,
    valid_until = excluded.valid_until,
    payment_terms = excluded.payment_terms,
    delivery_terms = excluded.delivery_terms,
    warranty_terms = excluded.warranty_terms,
    notes = excluded.notes,
    subtotal = excluded.subtotal,
    discount_total = excluded.discount_total,
    taxable_total = excluded.taxable_total,
    cgst_amount = excluded.cgst_amount,
    sgst_amount = excluded.sgst_amount,
    igst_amount = excluded.igst_amount,
    freight = excluded.freight,
    other_charges = excluded.other_charges,
    grand_total = excluded.grand_total,
    updated_by = excluded.updated_by,
    updated_at = now()
  returning * into v_quote;

  delete from public.quotation_items where quotation_id = v_quote.quotation_id;
  insert into public.quotation_items (
    quotation_id, line_no, item_type, product_id, product_code, description, unit,
    quantity, unit_rate, discount_amount, tax_rate, hsn_sac, tax_source_url,
    tax_verified_at, taxable_amount, tax_amount
  )
  select v_quote.quotation_id, x.line_no, x.item_type, x.product_id,
    x.product_code, x.description, x.unit, x.quantity, x.unit_rate,
    coalesce(x.discount_amount, 0), x.tax_rate, x.hsn_sac, x.tax_source_url,
    x.tax_verified_at, x.taxable_amount, x.tax_amount
  from jsonb_to_recordset(p_data->'items') as x(
    line_no integer, item_type text, product_id text, product_code text, description text, unit text,
    quantity numeric, unit_rate numeric, discount_amount numeric, tax_rate numeric,
    hsn_sac text, tax_source_url text, tax_verified_at date,
    taxable_amount numeric, tax_amount numeric
  );

  select to_jsonb(v_quote) || jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.line_no)
      from public.quotation_items i where i.quotation_id = v_quote.quotation_id
    ), '[]'::jsonb)
  ) into v_snapshot;
  insert into public.quotation_versions (quotation_id, revision, snapshot, actor_id)
    values (v_quote.quotation_id, v_revision, v_snapshot, p_actor_id);

  return to_jsonb(v_quote);
end;
$$;

create or replace function public.hm_set_quotation_status(
  p_quotation_id uuid,
  p_status text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotations%rowtype;
  v_previous text;
begin
  if p_quotation_id is null or p_actor_id is null
    or p_status not in ('sent', 'accepted', 'rejected', 'expired') then
    raise exception 'Invalid quotation status.';
  end if;

  select * into v_quote from public.quotations
    where quotation_id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation was not found.';
  end if;
  v_previous := v_quote.status;
  if not (
    (v_previous = 'draft' and p_status = 'sent')
    or (v_previous = 'sent' and p_status in ('accepted', 'rejected', 'expired'))
  ) then
    raise exception 'This quotation status transition is not allowed.';
  end if;

  update public.quotations
    set status = p_status, updated_by = p_actor_id, updated_at = now()
    where quotation_id = p_quotation_id
    returning * into v_quote;
  insert into public.quotation_status_history (
    quotation_id, previous_status, new_status, actor_id
  ) values (p_quotation_id, v_previous, p_status, p_actor_id);
  return to_jsonb(v_quote);
end;
$$;

revoke all on function public.hm_save_quotation(uuid, jsonb, uuid, boolean) from public, anon, authenticated;
grant execute on function public.hm_save_quotation(uuid, jsonb, uuid, boolean) to service_role;
revoke all on function public.hm_set_quotation_status(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.hm_set_quotation_status(uuid, text, uuid) to service_role;
revoke all on function public.hm_quotation_reject_history_change() from public, anon, authenticated, service_role;

create index if not exists quotations_status_created_idx
  on public.quotations (status, created_at desc);
create index if not exists quotations_customer_created_idx
  on public.quotations (customer_name, created_at desc);
create index if not exists quotation_items_quotation_idx
  on public.quotation_items (quotation_id, line_no);

notify pgrst, 'reload schema';
