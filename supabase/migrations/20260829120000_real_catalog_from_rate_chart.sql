-- Replaces the seeded placeholder catalog with Freshlyn Nature's real product
-- list, priced from the company rate chart (MRP column).
--
-- The seed catalog was US-style grocery dummy data at dollar prices (Bread,
-- Bananas, Peanut Butter...). Everything the company actually sells is dairy:
-- three milk grades, paneer, lassi, two curds and ghee -- 8 products across 18
-- pack sizes.
--
-- Test orders are cleared first. order_items references products with NO
-- ACTION, so the products delete below cannot run while any order row survives.
-- product_variants, subscription_configs and subscription_durations all cascade
-- from products and need no explicit delete.

-- 1. Clear test transaction data, children before parents.
delete from public.payment_events;
delete from public.subscription_deliveries;
delete from public.order_items;
delete from public.orders;

-- 2. Clear the placeholder catalog.
delete from public.products;

-- 3. Real products. Descriptions carry the rate chart's shelf life.
--    Every item Freshlyn sells is dairy, so they all share the 'dairy'
--    category and the storefront shows one category chip. The trailing comment
--    on each row keeps the finer type for when the catalog is worth splitting.
insert into public.products (id, name, description, category, image_url, unit, is_available) values
('00000000-0000-0000-0000-000000001001','Standard Milk','Fresh full-cream standard milk. Shelf life 2 days.','dairy',null,'bottle',true), -- milk
('00000000-0000-0000-0000-000000001002','Toned Milk','Fresh toned milk. Shelf life 2 days.','dairy',null,'bottle',true), -- milk
('00000000-0000-0000-0000-000000001003','Double Toned Milk','Fresh double toned milk (DTM). Shelf life 2 days.','dairy',null,'bottle',true), -- milk
('00000000-0000-0000-0000-000000001004','Paneer','Fresh cottage cheese. Shelf life 7 days.','dairy',null,'pack',true), -- paneer
('00000000-0000-0000-0000-000000001005','Lassi','Sweet churned lassi. Shelf life 7 days.','dairy',null,'cup',true), -- lassi
('00000000-0000-0000-0000-000000001006','Tok Doi','Traditional plain sour curd. Shelf life 7 days.','dairy',null,'pot',true), -- curd
('00000000-0000-0000-0000-000000001007','Misti Doi','Bengali sweet curd. Shelf life 7 days.','dairy',null,'pot',true), -- curd
('00000000-0000-0000-0000-000000001008','Ghee','Pure cow ghee. Shelf life 6 months.','dairy',null,'jar',true); -- ghee

-- 4. Variants. price is the MRP column of the rate chart.
insert into public.product_variants (id, product_id, name, quantity_value, quantity_unit, price, stock_quantity, max_quantity_per_order, is_default) values
-- Standard Milk
('00000000-0000-0002-0000-000000001001','00000000-0000-0000-0000-000000001001','500 ml',500,'ml',32.00,100,100,false),
('00000000-0000-0002-0000-000000001002','00000000-0000-0000-0000-000000001001','1 L',1000,'ml',64.00,100,100,true),
-- Toned Milk
('00000000-0000-0002-0000-000000001003','00000000-0000-0000-0000-000000001002','500 ml',500,'ml',28.00,100,100,true),
-- Double Toned Milk
('00000000-0000-0002-0000-000000001004','00000000-0000-0000-0000-000000001003','500 ml',500,'ml',25.00,100,100,true),
-- Paneer
('00000000-0000-0002-0000-000000001005','00000000-0000-0000-0000-000000001004','200 g',200,'g',85.00,100,100,false),
('00000000-0000-0002-0000-000000001006','00000000-0000-0000-0000-000000001004','500 g',500,'g',210.00,100,100,true),
-- Lassi
('00000000-0000-0002-0000-000000001007','00000000-0000-0000-0000-000000001005','200 g',200,'g',20.00,100,100,true),
-- Tok Doi
('00000000-0000-0002-0000-000000001008','00000000-0000-0000-0000-000000001006','200 g',200,'g',18.00,100,100,false),
('00000000-0000-0002-0000-000000001009','00000000-0000-0000-0000-000000001006','400 g',400,'g',35.00,100,100,true),
('00000000-0000-0002-0000-000000001010','00000000-0000-0000-0000-000000001006','1 kg',1000,'g',80.00,100,100,false),
-- Misti Doi
('00000000-0000-0002-0000-000000001011','00000000-0000-0000-0000-000000001007','80 g',80,'g',15.00,100,100,false),
('00000000-0000-0002-0000-000000001012','00000000-0000-0000-0000-000000001007','200 g',200,'g',32.00,100,100,true),
('00000000-0000-0002-0000-000000001013','00000000-0000-0000-0000-000000001007','400 g',400,'g',60.00,100,100,false),
('00000000-0000-0002-0000-000000001014','00000000-0000-0000-0000-000000001007','1 kg',1000,'g',140.00,100,100,false),
-- Ghee
('00000000-0000-0002-0000-000000001015','00000000-0000-0000-0000-000000001008','100 g',100,'g',90.00,100,100,false),
('00000000-0000-0002-0000-000000001016','00000000-0000-0000-0000-000000001008','200 g',200,'g',175.00,100,100,false),
('00000000-0000-0002-0000-000000001017','00000000-0000-0000-0000-000000001008','500 g',500,'g',380.00,100,100,true),
('00000000-0000-0002-0000-000000001018','00000000-0000-0000-0000-000000001008','1 kg',1000,'g',750.00,100,100,false);

-- 5. Subscriptions on the daily-delivery products only: the three milks and the
--    two curds. Paneer, lassi and ghee stay one-time purchases.
insert into public.subscription_configs (product_id, enabled, frequencies) values
('00000000-0000-0000-0000-000000001001', true, array['daily','alternate']),
('00000000-0000-0000-0000-000000001002', true, array['daily','alternate']),
('00000000-0000-0000-0000-000000001003', true, array['daily','alternate']),
('00000000-0000-0000-0000-000000001006', true, array['daily','alternate']),
('00000000-0000-0000-0000-000000001007', true, array['daily','alternate']);

-- 6. The 15/30/60/90 delivery ladder, at 0% by default.
insert into public.subscription_durations (product_id, duration_days, label, discount_percent)
select c.product_id, d.duration_days, d.label, d.discount_percent
from public.subscription_configs c
cross join (values
  (15, '15 Deliveries', 0.00),
  (30, '30 Deliveries', 0.00),
  (60, '60 Deliveries', 0.00),
  (90, '90 Deliveries', 0.00)
) as d(duration_days, label, discount_percent);

-- 7. "Buy 25 Days, Get 30 Days" on milk -- the offer the home banner already
--    advertises. The customer pays for 5 of every 6 delivery days, so the
--    discount is 100/6 = 16.6667%, which numeric(5,2) holds as 16.67. That
--    lands a few paise UNDER each "pay N days" figure (a 30-day Standard Milk
--    plan bills 1599.94 rather than 1600.00) -- never above, so the rounding
--    can only favour the customer. No 2dp percent reaches a whole rupee here:
--    the nearest that does is 17.5%, which would give away a further 16 rupees.
--
--    Only plans of 30 days and up qualify. 15 days stays at full price, and
--    the two doi products carry no discount on any plan.
--
--    duration_days is deliberately untouched: create_order schedules exactly
--    duration_days deliveries, so the 30/60/90 rows are what make the customer
--    actually RECEIVE 30/60/90 days. The discount only moves the money.
update public.subscription_durations d
set discount_percent = 16.67
from public.products p
where p.id = d.product_id
  and p.name in ('Standard Milk', 'Toned Milk', 'Double Toned Milk')
  and d.duration_days >= 30;
