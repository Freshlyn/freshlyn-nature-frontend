-- Reset user + order + payment data to a fresh state, preserving the catalogue.
--
-- FOR THE SUPABASE SQL EDITOR. No begin/commit: the editor runs each statement
-- in its own implicit transaction, so an explicit one is unreliable there.
-- THESE DELETES ARE IMMEDIATE AND NOT UNDOABLE. Take a backup first
-- (Dashboard -> Database -> Backups).
--
-- Run BLOCK 1, then BLOCK 2, then BLOCK 3. Order matters.
--
-- WHAT THIS DELETES
--   auth.users            -> every login (cascades to public.profiles)
--   public.profiles       -> cascades to addresses + account_deletion_requests
--   public.orders         -> cascades to order_items + payment_events
--   public.order_items    -> cascades to subscription_deliveries
--   public.otp_codes      -> pending OTP challenges
--   public.otp_send_log   -> OTP rate-limit history (else a fresh signup on a
--                            recently-used number can hit the throttle)
--
-- WHAT THIS PRESERVES (never referenced by a DELETE below)
--   products, product_variants          -- the catalogue
--   subscription_configs   (7 rows)     -- seed/config
--   subscription_durations (16 rows)    -- seed/config
--   otp_throttle_config    (1 row)      -- seed/config


-- ===========================================================================
-- BLOCK 0 (optional) -- look before you leap. Read-only, changes nothing.
-- ===========================================================================
select
  (select count(*) from auth.users)                     as auth_users,
  (select count(*) from public.profiles)                as profiles,
  (select count(*) from public.addresses)               as addresses,
  (select count(*) from public.orders)                  as orders,
  (select count(*) from public.order_items)             as order_items,
  (select count(*) from public.payment_events)          as payment_events,
  (select count(*) from public.subscription_deliveries) as sub_deliveries,
  (select count(*) from public.products)                as products,
  (select count(*) from public.product_variants)        as variants;


-- ===========================================================================
-- BLOCK 1 -- restore stock, then delete orders.
--
-- Stock MUST be restored before the orders holding it are destroyed: deleting
-- an order does not give stock back, and step 2 reads order_items.
-- Only COD orders and PAID razorpay orders ever decremented stock -- razorpay
-- orders left pending/failed never did (checkout/handler.ts:219 sets
-- `decrementStock: paymentMethod === "cod"`, and the deferred decrement runs
-- only inside confirm_order_payment). Restoring those too would inflate stock.
-- ===========================================================================
update public.product_variants pv
set stock_quantity = pv.stock_quantity + agg.qty
from (
  select oi.variant_id, sum(oi.quantity) as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.delivery_type = 'one_time'
    and (o.payment_method = 'cod' or o.payment_status = 'paid')
  group by oi.variant_id
) agg
where pv.id = agg.variant_id;

-- Cascades to order_items -> subscription_deliveries, and to payment_events.
-- Runs BEFORE the user delete because orders.user_id -> profiles is NO ACTION,
-- not CASCADE: deleting a profile that still owns an order raises an FK error.
delete from public.orders;


-- ===========================================================================
-- BLOCK 2 -- delete users and OTP state.
--
-- Delete from auth.users, NOT public.profiles. profiles.id references
-- auth.users(id) ON DELETE CASCADE, so this clears
-- auth.users -> profiles -> addresses + account_deletion_requests.
-- Deleting only the profile would leave an orphaned auth user who can still
-- log in, which defeats the point of the reset.
--
-- If this errors with a permission problem on the auth schema, skip it and use
-- Dashboard -> Authentication -> Users -> select all -> delete. Same cascade.
-- ===========================================================================
delete from auth.users;

delete from public.otp_codes;
delete from public.otp_send_log;


-- ===========================================================================
-- BLOCK 3 -- verify.
-- Expect zeros across the first block, and the catalogue intact:
-- products 23 / variants 60 / configs 7 / durations 16 / throttle 1.
-- ===========================================================================
select
  (select count(*) from auth.users)                     as auth_users,
  (select count(*) from public.profiles)                as profiles,
  (select count(*) from public.addresses)               as addresses,
  (select count(*) from public.orders)                  as orders,
  (select count(*) from public.order_items)             as order_items,
  (select count(*) from public.payment_events)          as payment_events,
  (select count(*) from public.subscription_deliveries) as sub_deliveries,
  (select count(*) from public.otp_codes)               as otp_codes,
  (select count(*) from public.otp_send_log)            as otp_send_log,
  (select count(*) from public.products)                as products_kept,
  (select count(*) from public.product_variants)        as variants_kept,
  (select count(*) from public.subscription_configs)    as configs_kept,
  (select count(*) from public.subscription_durations)  as durations_kept,
  (select count(*) from public.otp_throttle_config)     as throttle_kept;

-- Spot-check restored stock (both were decremented during testing):
--   Buttermilk 500ml expected 80, Bananas 500g expected 43.
select p.name as product, pv.name as variant, pv.stock_quantity
from public.product_variants pv
join public.products p on p.id = pv.product_id
where pv.id in ('00000000-0000-0001-0000-000000000056',
                '00000000-0000-0001-0000-000000000032');
