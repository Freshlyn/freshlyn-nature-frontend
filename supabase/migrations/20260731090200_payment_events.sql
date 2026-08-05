-- Deduplication only. Answers exactly one question: "have I already processed
-- this specific event, from this specific source?"
--
-- `source` is part of the unique key on purpose. An earlier design had the
-- client and webhook claim a single shared key on razorpay_payment_id, which
-- made whichever arrived FIRST win -- locking out the webhook when the client
-- got there first. Authority is not first-come-first-served, so it cannot be
-- expressed by a unique constraint; it lives in orders.payment_authority
-- instead. Here, each source deduplicates only against itself.
--
-- `event_type` is in the key because one payment legitimately produces several
-- distinct webhook events (payment.authorized, then payment.captured). Only an
-- exact repeat of the same event from the same source is a duplicate.
create table public.payment_events (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references public.orders (id) on delete cascade,
  razorpay_payment_id text not null,
  source              text not null check (source in ('client', 'webhook')),
  event_type          text not null,
  processed_at        timestamptz not null default now(),
  unique (razorpay_payment_id, source, event_type)
);

create index payment_events_order_id_idx on public.payment_events (order_id);

-- RLS on with deliberately NO policies: service_role bypasses RLS so edge
-- functions have full access, while no client can ever read payment events.
alter table public.payment_events enable row level security;
