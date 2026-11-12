create table public.hm_material_master (
 id uuid primary key default gen_random_uuid(),
 item_key text not null unique check(length(item_key) between 1 and 700),
 name text not null check(length(name) between 1 and 250),
 specification text not null default '' check(length(specification)<=500),
 unit text not null check(unit in ('Nos','Mtr','Ltr','Kg','Box','Set','Roll','Bag')),
 public_product_id text references public.hm_catalogue_products(product_id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.hm_supplier_discount_rules (
 id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.hm_suppliers(id),
 brand text not null check(length(brand) between 1 and 80),scope text not null check(length(scope) between 1 and 200),
 discount_percent numeric(5,2) not null check(discount_percent between 0 and 100),
 basis text not null default 'MRP' check(basis='MRP'),notes text not null default '' check(length(notes)<=2000),
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now(),
 unique(supplier_id,brand,scope)
);
create table public.hm_supplier_price_rows (
 id uuid primary key default gen_random_uuid(),material_id uuid not null references public.hm_material_master(id),
 supplier_id uuid not null references public.hm_suppliers(id),brand text not null check(length(brand) between 1 and 80),
 source_key text not null unique check(length(source_key)<=700),manufacturer_sku text not null default '' check(length(manufacturer_sku)<=100),
 printed_mrp numeric(14,2) not null check(printed_mrp>0 and printed_mrp<100000000000),
 discount_rule_id uuid references public.hm_supplier_discount_rules(id),source_file text not null default '' check(length(source_file)<=250),
 source_page integer check(source_page between 1 and 5000),effective_date date,
 tax_basis text not null default 'MRP reference; confirm invoice GST and freight' check(length(tax_basis)<=500),
 review_status text not null default 'Needs review' check(review_status in ('Verified reference','Needs review')),
 source_details jsonb not null default '{}'::jsonb check(pg_column_size(source_details)<16000),
 updated_by uuid references auth.users(id),updated_at timestamptz not null default now()
);
create index hm_price_rows_material on public.hm_supplier_price_rows(material_id);
create index hm_price_rows_supplier on public.hm_supplier_price_rows(supplier_id);
create index hm_price_rows_rule on public.hm_supplier_price_rows(discount_rule_id);
create index hm_material_public_product on public.hm_material_master(public_product_id);
alter table public.hm_material_master enable row level security;
alter table public.hm_supplier_discount_rules enable row level security;
alter table public.hm_supplier_price_rows enable row level security;
revoke all on public.hm_material_master,public.hm_supplier_discount_rules,public.hm_supplier_price_rows from public,anon,authenticated;
grant select,insert,update on public.hm_material_master,public.hm_supplier_discount_rules,public.hm_supplier_price_rows to service_role;
create trigger hm_audit_material_master after insert or update or delete on public.hm_material_master for each row execute function public.hm_record_audit();
create trigger hm_audit_supplier_discount after insert or update or delete on public.hm_supplier_discount_rules for each row execute function public.hm_record_audit();
create trigger hm_audit_supplier_price after insert or update or delete on public.hm_supplier_price_rows for each row execute function public.hm_record_audit();
