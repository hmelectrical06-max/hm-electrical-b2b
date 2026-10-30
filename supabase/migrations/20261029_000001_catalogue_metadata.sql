-- Additive, admin-only metadata overlay for the existing static material catalogue.
-- Does not insert, update, or delete catalogue products, enquiries, or service data.

create table if not exists public.catalogue_product_metadata (
  product_id text primary key,
  brand text,
  manufacturer text,
  manufacturer_sku text,
  manufacturer_source_url text check (
    manufacturer_source_url is null or manufacturer_source_url ~ '^https://[^[:space:]]+$'
  ),
  specifications text,
  hsn text,
  gst_rate numeric(5,2) check (gst_rate is null or gst_rate between 0 and 100),
  tax_source_url text check (
    tax_source_url is null or tax_source_url ~ '^https://[^[:space:]]+$'
  ),
  tax_verified_at date,
  product_photo_url text check (
    product_photo_url is null or product_photo_url ~ '^https://[^[:space:]]+$'
  ),
  photo_rights_source_url text check (
    photo_rights_source_url is null or photo_rights_source_url ~ '^https://[^[:space:]]+$'
  ),
  photo_rights_verified boolean not null default false,
  mrp numeric(14,2) check (mrp is null or mrp >= 0),
  mrp_source_url text check (
    mrp_source_url is null or mrp_source_url ~ '^https://[^[:space:]]+$'
  ),
  mrp_verified_at date,
  purchase_price numeric(14,2) check (purchase_price is null or purchase_price >= 0),
  retail_price numeric(14,2) check (retail_price is null or retail_price >= 0),
  wholesale_price numeric(14,2) check (wholesale_price is null or wholesale_price >= 0),
  minimum_wholesale_quantity numeric(14,3)
    check (minimum_wholesale_quantity is null or minimum_wholesale_quantity >= 0),
  availability text check (availability is null or availability in ('listed', 'on_request', 'discontinued')),
  public_price_mode text not null default 'request'
    check (public_price_mode in ('request', 'mrp', 'retail', 'wholesale')),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  constraint catalogue_metadata_published_price_present check (
    public_price_mode = 'request'
    or (public_price_mode = 'mrp' and mrp is not null)
    or (public_price_mode = 'retail' and retail_price is not null)
    or (public_price_mode = 'wholesale' and wholesale_price is not null
      and minimum_wholesale_quantity is not null and minimum_wholesale_quantity > 0)
  ),
  constraint catalogue_metadata_mrp_source_present check (
    mrp is null or (mrp_source_url is not null and mrp_verified_at is not null)
  ),
  constraint catalogue_metadata_tax_source_present check (
    (hsn is null and gst_rate is null)
    or (tax_source_url is not null and tax_verified_at is not null)
  ),
  constraint catalogue_metadata_verified_photo_present check (
    not photo_rights_verified
    or (product_photo_url is not null and photo_rights_source_url is not null)
  )
);

alter table public.catalogue_product_metadata enable row level security;
revoke all on public.catalogue_product_metadata from public, anon, authenticated;
grant select, insert, update, delete on public.catalogue_product_metadata to service_role;

create index if not exists catalogue_product_metadata_brand_idx
  on public.catalogue_product_metadata (brand);
create index if not exists catalogue_product_metadata_hsn_idx
  on public.catalogue_product_metadata (hsn);

notify pgrst, 'reload schema';
