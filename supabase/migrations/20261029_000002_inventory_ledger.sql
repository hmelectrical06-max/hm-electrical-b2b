-- Single-godown quantity ledger. Existing catalogue, enquiries and service data
-- are not modified; product_id references the existing static catalogue.

create table if not exists public.inventory_balances (
  product_id text primary key,
  on_hand numeric(14,3) not null default 0 check (on_hand >= 0),
  reserved numeric(14,3) not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  movement_id uuid primary key default gen_random_uuid(),
  product_id text not null,
  movement_type text not null check (movement_type in (
    'opening_stock', 'goods_receipt', 'customer_dispatch', 'installation_issue',
    'customer_return', 'supplier_return', 'damage', 'adjustment',
    'reservation', 'reservation_release', 'reservation_dispatch'
  )),
  quantity numeric(14,3) not null check (quantity > 0),
  on_hand_delta numeric(14,3) not null,
  reserved_delta numeric(14,3) not null default 0,
  reference_type text not null,
  reference_id text not null,
  idempotency_key text not null unique,
  note text,
  actor_id uuid not null,
  created_at timestamptz not null default now()
);

alter table public.inventory_balances enable row level security;
alter table public.inventory_movements enable row level security;
revoke all on public.inventory_balances, public.inventory_movements from public, anon, authenticated;
grant select on public.inventory_balances, public.inventory_movements to service_role;

create or replace function public.hm_inventory_reject_ledger_change()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  raise exception 'Inventory movement history is immutable.';
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'inventory_movements_immutable'
      and tgrelid = 'public.inventory_movements'::regclass
      and not tgisinternal
  ) then
    create trigger inventory_movements_immutable
      before update or delete on public.inventory_movements
      for each row execute function public.hm_inventory_reject_ledger_change();
  end if;
end;
$$;

create or replace function public.hm_inventory_movement(
  p_product_id text,
  p_movement_type text,
  p_quantity numeric,
  p_reference_type text,
  p_reference_id text,
  p_idempotency_key text,
  p_actor_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_balance public.inventory_balances%rowtype;
  v_existing public.inventory_movements%rowtype;
  v_on_hand_delta numeric(14,3);
  v_reserved_delta numeric(14,3);
  v_quantity numeric(14,3);
  v_next_on_hand numeric(14,3);
  v_next_reserved numeric(14,3);
  v_movement public.inventory_movements%rowtype;
begin
  if p_product_id is null or length(p_product_id) > 120
    or p_movement_type not in (
      'opening_stock', 'goods_receipt', 'customer_dispatch', 'installation_issue',
      'customer_return', 'supplier_return', 'damage', 'adjustment',
      'reservation', 'reservation_release', 'reservation_dispatch'
    )
    or p_quantity is null or p_quantity = 0
    or abs(p_quantity) > 1000000000
    or p_reference_type is null or length(p_reference_type) > 40
    or p_reference_id is null or length(p_reference_id) > 120
    or p_idempotency_key is null or length(p_idempotency_key) < 1
    or length(p_idempotency_key) > 160
    or p_actor_id is null then
    raise exception 'Invalid inventory movement.';
  end if;

  if p_movement_type <> 'adjustment' and p_quantity < 0 then
    raise exception 'Quantity must be positive for this movement type.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));
  select * into v_existing
    from public.inventory_movements
    where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.product_id <> p_product_id
      or v_existing.movement_type <> p_movement_type
      or v_existing.reference_type <> p_reference_type
      or v_existing.reference_id <> p_reference_id
      or v_existing.quantity <> abs(p_quantity)
      or (p_movement_type = 'adjustment' and v_existing.on_hand_delta <> p_quantity)
      or v_existing.note is distinct from p_note
      or v_existing.actor_id <> p_actor_id then
      raise exception 'Idempotency key was already used for a different movement.';
    end if;
    return to_jsonb(v_existing);
  end if;

  insert into public.inventory_balances (product_id)
    values (p_product_id)
    on conflict (product_id) do nothing;
  select * into v_balance
    from public.inventory_balances
    where product_id = p_product_id
    for update;

  v_quantity := abs(p_quantity);
  v_on_hand_delta := 0;
  v_reserved_delta := 0;
  case p_movement_type
    when 'opening_stock' then
      if exists (select 1 from public.inventory_movements
        where product_id = p_product_id and movement_type = 'opening_stock') then
        raise exception 'Opening stock was already recorded; use an adjustment.';
      end if;
      v_on_hand_delta := v_quantity;
    when 'goods_receipt', 'customer_return' then
      v_on_hand_delta := v_quantity;
    when 'customer_dispatch', 'installation_issue', 'supplier_return', 'damage' then
      v_on_hand_delta := -v_quantity;
    when 'adjustment' then
      v_on_hand_delta := p_quantity;
    when 'reservation' then
      v_reserved_delta := v_quantity;
    when 'reservation_release' then
      v_reserved_delta := -v_quantity;
    when 'reservation_dispatch' then
      v_on_hand_delta := -v_quantity;
      v_reserved_delta := -v_quantity;
  end case;

  if p_movement_type in ('reservation_release', 'reservation_dispatch')
    and v_balance.reserved < v_quantity then
    raise exception 'The quantity exceeds currently reserved stock.';
  end if;
  if v_on_hand_delta < 0 and v_balance.on_hand - v_balance.reserved < -v_on_hand_delta
    and p_movement_type <> 'reservation_dispatch' then
    raise exception 'The quantity exceeds available stock.';
  end if;

  v_next_on_hand := v_balance.on_hand + v_on_hand_delta;
  v_next_reserved := v_balance.reserved + v_reserved_delta;
  if v_next_on_hand < 0 or v_next_reserved < 0 or v_next_reserved > v_next_on_hand then
    raise exception 'Movement would create an invalid stock balance.';
  end if;

  update public.inventory_balances
    set on_hand = v_next_on_hand, reserved = v_next_reserved, updated_at = now()
    where product_id = p_product_id;

  insert into public.inventory_movements (
    product_id, movement_type, quantity, on_hand_delta, reserved_delta,
    reference_type, reference_id, idempotency_key, note, actor_id
  ) values (
    p_product_id, p_movement_type, v_quantity, v_on_hand_delta, v_reserved_delta,
    p_reference_type, p_reference_id, p_idempotency_key, p_note, p_actor_id
  ) returning * into v_movement;

  return to_jsonb(v_movement);
end;
$$;

revoke all on function public.hm_inventory_movement(text, text, numeric, text, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.hm_inventory_movement(text, text, numeric, text, text, text, uuid, text) to service_role;
revoke all on function public.hm_inventory_reject_ledger_change() from public, anon, authenticated, service_role;

create index if not exists inventory_movements_product_created_idx
  on public.inventory_movements (product_id, created_at desc);
create index if not exists inventory_movements_created_idx
  on public.inventory_movements (created_at desc);

notify pgrst, 'reload schema';
