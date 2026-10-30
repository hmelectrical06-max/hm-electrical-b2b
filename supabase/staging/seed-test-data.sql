-- OPTIONAL test-only records for the HM ELECTRICAL TEST Supabase project.
-- Confirm the Supabase Dashboard project selector before running this file.
-- Uses an existing catalogue product ID and clearly fake, low-value test data.
-- Inventory ledger entries are append-only and intentionally have no cleanup.

begin;

do $$
declare
  v_actor constant uuid := '00000000-0000-4000-8000-000000000099';
  v_quote_data jsonb;
begin
  if to_regclass('public.inventory_balances') is null
    or to_regclass('public.quotations') is null
    or to_regprocedure('public.hm_inventory_movement(text,text,numeric,text,text,text,uuid,text)') is null
    or to_regprocedure('public.hm_save_quotation(uuid,jsonb,uuid,boolean)') is null then
    raise exception 'Apply the required staging migrations before adding test fixtures.';
  end if;

  perform public.hm_inventory_movement(
    'MAT-8000',
    'opening_stock',
    10,
    'opening',
    'HM-TEST-SEED-MAT-8000',
    'hm-test-seed-opening-MAT-8000-v1',
    v_actor,
    'TEST ONLY fixture; not real stock.'
  );

  if not exists (
    select 1 from public.quotations
    where notes = 'HM_TEST_FIXTURE: quotation-pdf'
  ) then
    v_quote_data := jsonb_build_object(
      'source_enquiry_id', null,
      'customer_name', 'HM TEST ONLY - NOT A CUSTOMER',
      'company_name', 'STAGING FIXTURE - NOT A REAL COMPANY',
      'mobile', null,
      'email', null,
      'customer_gstin', null,
      'billing_address', null,
      'shipping_address', null,
      'place_of_supply', null,
      'tax_mode', 'none',
      'valid_until', null,
      'payment_terms', null,
      'delivery_terms', null,
      'warranty_terms', null,
      'notes', 'HM_TEST_FIXTURE: quotation-pdf',
      'subtotal', 1,
      'discount_total', 0,
      'taxable_total', 1,
      'cgst_amount', 0,
      'sgst_amount', 0,
      'igst_amount', 0,
      'freight', 0,
      'other_charges', 0,
      'grand_total', 1,
      'items', jsonb_build_array(jsonb_build_object(
        'line_no', 1,
        'item_type', 'product',
        'product_id', 'MAT-8000',
        'product_code', 'MAT-0001',
        'description', 'MCB SP 6A - TEST FIXTURE ONLY',
        'unit', 'Nos',
        'quantity', 1,
        'unit_rate', 1,
        'discount_amount', 0,
        'tax_rate', null,
        'hsn_sac', null,
        'tax_source_url', null,
        'tax_verified_at', null,
        'taxable_amount', 1,
        'tax_amount', 0
      ))
    );
    perform public.hm_save_quotation(null, v_quote_data, v_actor, false);
  end if;
end;
$$;

commit;
