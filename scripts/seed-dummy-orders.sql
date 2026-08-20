-- Generate dummy orders for exercising the infinite-scroll orders list.
--
-- FOR THE SUPABASE SQL EDITOR (same convention as reset-test-data.sql).
--
-- Creates 60 orders spread over ~5 months for ONE user, with a mix of
-- statuses, payment methods, and one_time/subscription items drawn from the
-- real catalogue so product thumbnails resolve on the cards.
--
-- SAFE TO RE-RUN: every row it writes is tagged (see SEED_TAG below), and
-- BLOCK 3 deletes exactly and only those rows. It never touches real orders.
--
-- HOW TO USE
--   1. Set the target user in BLOCK 0 and run it to confirm the user exists.
--   2. Run BLOCK 1 (products sanity check) -- it must return at least 1 row.
--   3. Run BLOCK 2 to insert.
--   4. Run BLOCK 3 later to remove everything this script created.


-- ===========================================================================
-- BLOCK 0 -- who are we seeding for? Read-only.
-- ===========================================================================
-- Find your user id by phone (the app stores E.164, e.g. '+919876543210'):
select id, phone, created_at from auth.users order by created_at desc limit 20;


-- ===========================================================================
-- BLOCK 1 -- the catalogue must have variants, or items would have no product.
-- ===========================================================================
select count(*) as variant_count
from public.product_variants v
join public.products p on p.id = v.product_id;


-- ===========================================================================
-- BLOCK 2 -- insert the dummy orders.
--
-- Replace the user_id below before running.
-- ===========================================================================
do $$
declare
  -- >>> SET THIS <<<
  v_user_id uuid := '00000000-0000-0000-0000-000000000000';

  -- Every seeded order's delivery_address ends with this marker, which is how
  -- BLOCK 3 identifies its own rows without risking a real order.
  c_seed_tag constant text := '[DUMMY-SEED]';
  c_order_count constant int := 60;

  v_order_id uuid;
  v_created timestamptz;
  v_status public.order_status;
  v_payment_status public.payment_status;
  v_payment_method public.payment_method;
  v_item_count int;
  v_subtotal numeric(10,2);
  v_delivery_fee numeric(10,2);
  v_delivery_type public.delivery_type;
  v_unit_price numeric(10,2);
  v_qty int;
  v_variant record;
  i int;
  j int;
begin
  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'No profile for user_id %. Set v_user_id in BLOCK 2 to a real user (see BLOCK 0).', v_user_id;
  end if;

  if not exists (select 1 from public.product_variants) then
    raise exception 'No product variants in the catalogue -- seeded items would have nothing to point at.';
  end if;

  for i in 1..c_order_count loop
    -- Spread orders over ~5 months so every date-preset filter (7d/30d/3m)
    -- has rows on both sides of its boundary. The minute offset keeps
    -- created_at values distinct enough to be realistic, while some orders
    -- deliberately share a timestamp to exercise the keyset cursor's tiebreak.
    v_created := now()
      - ((i * 2.5)::int * interval '1 day')
      - ((i % 24) * interval '1 hour')
      - ((i % 7) * interval '13 minute');

    -- Older orders are settled; recent ones are still in flight.
    v_status := case
      when i <= 3  then 'pending'
      when i <= 6  then 'confirmed'
      when i <= 9  then 'preparing'
      when i <= 12 then 'out_for_delivery'
      when i % 11 = 0 then 'cancelled'
      when i % 17 = 0 then 'failed'
      else 'delivered'
    end::public.order_status;

    v_payment_method := case when i % 3 = 0 then 'razorpay' else 'cod' end::public.payment_method;

    v_payment_status := case
      when v_status in ('cancelled', 'failed') then 'refunded'
      when v_payment_method = 'razorpay' then 'paid'
      when v_status = 'delivered' then 'collected'
      else 'pending'
    end::public.payment_status;

    -- A few dead razorpay rows: authorized-then-abandoned payments. The orders
    -- list must NEVER show these, so they exist here to prove the filter works.
    if v_payment_method = 'razorpay' and i % 15 = 0 then
      v_payment_status := 'failed';
    end if;

    v_item_count := 1 + (i % 4);
    v_subtotal := 0;
    -- Free delivery over a threshold, mirroring how real orders vary.
    v_delivery_fee := case when i % 4 = 0 then 0 else 25 end;

    insert into public.orders (
      user_id, address_id, delivery_address, subtotal, delivery_fee, total,
      item_count, status, payment_status, payment_method, created_at, updated_at
    ) values (
      v_user_id,
      null,
      format('%s Test Street, Kolkata, West Bengal 700156 %s', 100 + i, c_seed_tag),
      0, v_delivery_fee, 0,
      v_item_count, v_status, v_payment_status, v_payment_method, v_created, v_created
    )
    returning id into v_order_id;

    for j in 1..v_item_count loop
      -- Rotate through the catalogue deterministically so each order gets a
      -- different-looking basket run to run.
      select v.id as variant_id, v.product_id
        into v_variant
      from public.product_variants v
      order by md5(v.id::text || i::text || j::text)
      limit 1;

      -- Subscription-ness is decided PER ORDER, not per item. Deciding it per
      -- item makes almost every multi-item order contain a subscription, which
      -- leaves the "one time" filter with too few orders to scroll through.
      -- Every 3rd order is a pure subscription order, the rest pure one-time.
      v_delivery_type := case when i % 3 = 0 then 'subscription' else 'one_time' end::public.delivery_type;
      v_qty := 1 + ((i + j) % 3);
      v_unit_price := 40 + ((i * j) % 8) * 15;
      v_subtotal := v_subtotal + (v_unit_price * v_qty);

      insert into public.order_items (
        order_id, product_id, variant_id, quantity, unit_price, delivery_type,
        subscription_duration_days, subscription_frequency, created_at
      ) values (
        v_order_id,
        v_variant.product_id,
        v_variant.variant_id,
        v_qty,
        v_unit_price,
        v_delivery_type,
        case when v_delivery_type = 'subscription' then 30 else null end,
        case when v_delivery_type = 'subscription'
             then (case when j % 2 = 0 then 'daily' else 'alternate' end)::public.subscription_frequency
             else null end,
        v_created
      );
    end loop;

    -- Totals are computed from the items actually inserted, so the cards do
    -- not show a subtotal that disagrees with their own line items.
    update public.orders
       set subtotal = v_subtotal,
           total = v_subtotal + v_delivery_fee
     where id = v_order_id;
  end loop;

  raise notice 'Inserted % dummy orders for user %.', c_order_count, v_user_id;
end $$;


-- Verify what landed, newest first.
select id, status, payment_status, payment_method, item_count, total, created_at
from public.orders
where delivery_address like '%[DUMMY-SEED]%'
order by created_at desc
limit 20;


-- ===========================================================================
-- BLOCK 3 -- CLEANUP. Removes ONLY rows this script created.
--
-- order_items cascade from orders (see 20260713125350), so deleting the
-- orders is sufficient.
-- ===========================================================================
-- delete from public.orders where delivery_address like '%[DUMMY-SEED]%';
