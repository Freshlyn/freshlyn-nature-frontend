-- Convert the fixed-option status columns from `text` + CHECK to real Postgres
-- enum types. The CHECK constraints enforced the same values, but the Supabase
-- Table Editor can only render a dropdown for a column whose type is an enum --
-- it cannot derive a list of choices from arbitrary boolean SQL.
--
-- Two deliberate semantic changes come along with the conversion:
--
--   1. payment_status drops its COD-specific values. `cod_pending` /
--      `cod_collected` encoded the payment *method* into the *status*, which
--      left a razorpay order with no valid unpaid state. Method already has its
--      own column, so status now describes only the status.
--
--   2. order_status and subscription_delivery_status gain `failed`, a terminal
--      state for a delivery that was attempted but did not happen (nobody home,
--      refused, bad address). Previously those orders could only be marked
--      `cancelled`, which conflated "customer cancelled" with "we could not
--      deliver".
--
-- Values are declared in lifecycle order: Postgres sorts enums by declaration
-- order, so `ORDER BY status` follows the delivery flow instead of the alphabet.
--
-- subscription_configs.frequencies is intentionally left as text[] with its
-- existing CHECK -- the Table Editor does not render a multi-select for array
-- columns, so converting it would add no dropdown.

create type public.order_status as enum (
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'delivered',
  'failed',
  'cancelled'
);

create type public.payment_status as enum (
  'pending',
  'paid',
  'collected',
  'refunded'
);

create type public.payment_method as enum (
  'cod',
  'razorpay'
);

create type public.delivery_type as enum (
  'one_time',
  'subscription'
);

create type public.subscription_frequency as enum (
  'daily',
  'alternate',
  'every_3rd'
);

create type public.subscription_delivery_status as enum (
  'scheduled',
  'delivered',
  'skipped',
  'failed',
  'cancelled'
);

create type public.account_deletion_status as enum (
  'pending',
  'cancelled',
  'flagged',
  'completed'
);

-- orders.status
alter table public.orders drop constraint orders_status_check;
alter table public.orders alter column status drop default;
alter table public.orders
  alter column status type public.order_status
  using status::public.order_status;
alter table public.orders alter column status set default 'pending';

-- orders.payment_status: renames the two COD values on the way across.
alter table public.orders drop constraint orders_payment_status_check;
alter table public.orders alter column payment_status drop default;
alter table public.orders
  alter column payment_status type public.payment_status
  using case payment_status
    when 'cod_pending' then 'pending'
    when 'cod_collected' then 'collected'
    else payment_status
  end::public.payment_status;
alter table public.orders alter column payment_status set default 'pending';

-- orders.payment_method
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders alter column payment_method drop default;
alter table public.orders
  alter column payment_method type public.payment_method
  using payment_method::public.payment_method;
alter table public.orders alter column payment_method set default 'cod';

-- order_items.delivery_type (no default)
alter table public.order_items drop constraint order_items_delivery_type_check;
alter table public.order_items
  alter column delivery_type type public.delivery_type
  using delivery_type::public.delivery_type;

-- order_items.subscription_frequency (nullable, no default)
alter table public.order_items drop constraint order_items_subscription_frequency_check;
alter table public.order_items
  alter column subscription_frequency type public.subscription_frequency
  using subscription_frequency::public.subscription_frequency;

-- subscription_deliveries.status
--
-- Three triggers have WHEN clauses that reference this column with a hardcoded
-- ::text cast, and Postgres refuses to alter the type of a column a trigger
-- definition depends on. They have to be dropped and recreated around the
-- conversion. The trigger *functions* need no change -- they compare against
-- bare literals, which resolve against the enum -- only the WHEN clauses do.
drop trigger trg_append_makeup_delivery on public.subscription_deliveries;
drop trigger trg_decrement_stock_on_delivery on public.subscription_deliveries;
drop trigger trg_maybe_complete_order on public.subscription_deliveries;

alter table public.subscription_deliveries drop constraint subscription_deliveries_status_check;
alter table public.subscription_deliveries alter column status drop default;
alter table public.subscription_deliveries
  alter column status type public.subscription_delivery_status
  using status::public.subscription_delivery_status;
alter table public.subscription_deliveries alter column status set default 'scheduled';

create trigger trg_append_makeup_delivery
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'skipped' and old.status is distinct from 'skipped')
  execute function public.fn_append_makeup_delivery();

create trigger trg_decrement_stock_on_delivery
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'delivered' and old.status is distinct from 'delivered')
  execute function public.fn_decrement_stock_on_delivery();

create trigger trg_maybe_complete_order
  after update of status on public.subscription_deliveries
  for each row
  when (new.status = 'delivered')
  execute function public.fn_maybe_complete_order();

-- account_deletion_requests.status
--
-- A partial unique index (one active request per user) has a WHERE predicate
-- referencing status with a hardcoded ::text cast, so it blocks the type change
-- and has to be dropped and recreated alongside it.
drop index public.account_deletion_requests_one_active_per_user;

alter table public.account_deletion_requests drop constraint account_deletion_requests_status_check;
alter table public.account_deletion_requests alter column status drop default;
alter table public.account_deletion_requests
  alter column status type public.account_deletion_status
  using status::public.account_deletion_status;
alter table public.account_deletion_requests alter column status set default 'pending';

create unique index account_deletion_requests_one_active_per_user
  on public.account_deletion_requests (user_id)
  where status in ('pending', 'flagged');

-- cancel_account_deletion works unchanged after the conversion -- its literals
-- resolve against the enum like any other. The explicit casts here are simply
-- defensive, making the intended type obvious at the call site.
create or replace function public.cancel_account_deletion()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.account_deletion_requests
  set status = 'cancelled'::public.account_deletion_status, cancelled_at = now()
  where user_id = auth.uid()
    and status in (
      'pending'::public.account_deletion_status,
      'flagged'::public.account_deletion_status
    );
end;
$$;

-- create_order pulls delivery_type and subscription_frequency out of a jsonb
-- payload with ->>, which yields text. Postgres implicitly casts a string
-- *literal* to an enum but not a text *value*, so these two inserts need
-- explicit casts or the RPC starts raising a type error. Everything else in the
-- function (and in the trigger functions) compares against literals and is
-- unaffected.
create or replace function public.create_order(
  p_user_id uuid,
  p_address_id uuid,
  p_delivery_address text,
  p_items jsonb,
  p_subtotal numeric,
  p_delivery_fee numeric,
  p_total numeric
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_item jsonb;
  v_order_item_id uuid;
  v_item_count int;
  v_seq int;
  v_start_date date;
  v_interval int;
begin
  v_item_count := jsonb_array_length(p_items);

  insert into public.orders (
    user_id, address_id, delivery_address, subtotal, delivery_fee, total, item_count
  ) values (
    p_user_id, p_address_id, p_delivery_address, p_subtotal, p_delivery_fee, p_total, v_item_count
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, quantity, unit_price, delivery_type,
      subscription_duration_days, subscription_frequency, discount_percent
    ) values (
      v_order_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity')::int,
      (v_item->>'unit_price')::numeric,
      (v_item->>'delivery_type')::public.delivery_type,
      nullif(v_item->>'subscription_duration_days', '')::int,
      nullif(v_item->>'subscription_frequency', '')::public.subscription_frequency,
      nullif(v_item->>'discount_percent', '')::numeric
    )
    returning id into v_order_item_id;

    if v_item->>'delivery_type' = 'one_time' then
      update public.product_variants
      set stock_quantity = stock_quantity - (v_item->>'quantity')::int
      where id = (v_item->>'variant_id')::uuid;
    else
      v_interval := case v_item->>'subscription_frequency'
        when 'daily' then 1
        when 'alternate' then 2
        when 'every_3rd' then 3
        else 1
      end;

      v_start_date := coalesce(
        nullif(v_item->>'subscription_start_date', '')::date,
        current_date
      );

      for v_seq in 1..(v_item->>'subscription_duration_days')::int loop
        insert into public.subscription_deliveries (
          order_item_id, sequence_number, scheduled_date, status
        ) values (
          v_order_item_id,
          v_seq,
          v_start_date + ((v_seq - 1) * v_interval),
          'scheduled'
        );
      end loop;
    end if;
  end loop;

  return v_order_id;
end;
$$;
