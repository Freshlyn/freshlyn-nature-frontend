-- The Orders UI subscribes to order rows so a late payment reversal appears
-- without a refresh. Postgres emits change events only for tables in the
-- publication -- `realtime` being enabled in config.toml is NOT sufficient.
-- Without this line the subscription connects, reports no error, and silently
-- receives nothing forever.
--
-- Realtime respects RLS, so orders_select_own continues to scope delivery: a
-- subscriber is only ever pushed their own rows.
alter publication supabase_realtime add table public.orders;
