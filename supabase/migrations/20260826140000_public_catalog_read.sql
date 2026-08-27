-- The catalogue becomes world-readable.
--
-- Browsing before login is the point: a visitor lands on Home, sees products,
-- prices and stock, and is only asked to sign in when they try to ADD one --
-- the same shape as every other storefront. Until now these four tables were
-- `to authenticated`, so a signed-out Home rendered an empty grid no matter
-- what the client did; this is the server half of that change.
--
-- Nothing here leaks: these rows are the shop window. Order, profile and
-- address policies are untouched and stay scoped to auth.uid(), and every
-- write still goes through service_role or the checkout edge function, which
-- re-reads price and stock server-side rather than trusting anything a client
-- has seen.
--
-- Recreated rather than altered because a policy's role list cannot be changed
-- in place; each is otherwise identical to its 20260713130143 original.

drop policy if exists products_select_authenticated on public.products;
create policy products_select_all on public.products
  for select to anon, authenticated using (true);

drop policy if exists product_variants_select_authenticated on public.product_variants;
create policy product_variants_select_all on public.product_variants
  for select to anon, authenticated using (true);

-- Subscription plans are part of the shop window too: the product detail modal
-- renders its plan picker before login, and a guest who cannot read these sees
-- a one-time-only product that silently grows options after signing in.
drop policy if exists subscription_configs_select_authenticated on public.subscription_configs;
create policy subscription_configs_select_all on public.subscription_configs
  for select to anon, authenticated using (true);

drop policy if exists subscription_durations_select_authenticated on public.subscription_durations;
create policy subscription_durations_select_all on public.subscription_durations
  for select to anon, authenticated using (true);
