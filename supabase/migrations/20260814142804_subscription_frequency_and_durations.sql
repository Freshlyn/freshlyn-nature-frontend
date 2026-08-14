-- Removes the 'every_3rd' subscription frequency outright and gives every
-- subscription-enabled product the same 15/30/60/90 delivery ladder.
--
-- 'every_3rd' is dropped from the enum itself, not just from the offered
-- frequencies. Postgres has no ALTER TYPE ... DROP VALUE, so the type is
-- recreated below. Any order_items row still on 'every_3rd' is migrated to
-- 'alternate' first so the cast cannot fail.

-- 1. Stop offering 'every_3rd' on any product.
update public.subscription_configs
set frequencies = array_remove(frequencies, 'every_3rd');

alter table public.subscription_configs
  drop constraint subscription_configs_frequencies_check;

alter table public.subscription_configs
  add constraint subscription_configs_frequencies_check
  check (frequencies <@ array['daily','alternate']::text[]);

-- 2. Drop 'every_3rd' from the enum by recreating the type.
update public.order_items
set subscription_frequency = 'alternate'
where subscription_frequency = 'every_3rd';

alter type public.subscription_frequency rename to subscription_frequency_old;

create type public.subscription_frequency as enum ('daily', 'alternate');

alter table public.order_items
  alter column subscription_frequency type public.subscription_frequency
  using subscription_frequency::text::public.subscription_frequency;

drop type public.subscription_frequency_old;

-- 3. Give every subscription-enabled product the uniform 15/30/60/90 ladder,
--    replacing the uneven per-product options (5/7/10/...) seeded earlier.
delete from public.subscription_durations
where duration_days not in (15, 30, 60, 90);

insert into public.subscription_durations (product_id, duration_days, label, discount_percent)
select c.product_id, d.duration_days, d.label, d.discount_percent
from public.subscription_configs c
cross join (values
  (15, '15 Deliveries', 5.00),
  (30, '30 Deliveries', 10.00),
  (60, '60 Deliveries', 15.00),
  (90, '90 Deliveries', 20.00)
) as d (duration_days, label, discount_percent)
on conflict (product_id, duration_days)
do update set label = excluded.label,
              discount_percent = excluded.discount_percent;
