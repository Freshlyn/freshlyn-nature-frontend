-- Correlation and authority columns for online payments.
--
-- A webhook arrives knowing only Razorpay's identifiers, so razorpay_order_id
-- is the only thread back to a local order. payment_authority records *who last
-- decided* the payment state; it is what lets the database evaluate "has the
-- webhook already spoken?" atomically inside an UPDATE, rather than in a
-- read-then-write that a concurrent webhook could slip between.
alter table public.orders
  add column razorpay_order_id   text,
  add column razorpay_payment_id text,
  add column payment_authority   text
    check (payment_authority in ('client', 'webhook'));

-- Partial, because every COD order leaves these null and nulls must not collide.
create unique index orders_razorpay_order_id_key
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

create index orders_razorpay_payment_id_idx
  on public.orders (razorpay_payment_id)
  where razorpay_payment_id is not null;
