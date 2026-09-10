-- finance_payments: records all dues payments
create table if not exists public.finance_payments (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid references public.members(id) on delete set null,
  member_name         text,
  category            text not null default 'renewing',
  category_label      text,
  fiscal_year         text,
  amount_cents        integer not null default 0,
  method              text not null default 'stripe' check (method in ('stripe','check','zelle','cash','waived','other')),
  status              text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  late_fee            boolean default false,
  building_fund       boolean default false,
  stripe_session_id   text unique,
  xero_sync_status    text default 'pending' check (xero_sync_status in ('pending','synced','failed','na')),
  notes               text,
  created_at          timestamptz default now()
);
alter table public.finance_payments enable row level security;
create policy "Admin full access finance_payments"
  on public.finance_payments for all using (public.current_user_is_chapter_admin());
create policy "Members read own payments"
  on public.finance_payments for select
  using (auth.uid() = (select auth_user_id from public.members where id = member_id));

-- finance_merch_orders: records chapter store orders
create table if not exists public.finance_merch_orders (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid references public.members(id) on delete set null,
  member_name       text,
  email             text,
  items             jsonb,
  total_cents       integer not null default 0,
  status            text not null default 'awaiting_payment'
                    check (status in ('awaiting_payment','paid','fulfilled','cancelled')),
  stripe_session_id text unique,
  notes             text,
  created_at        timestamptz default now()
);
alter table public.finance_merch_orders enable row level security;
create policy "Admin full access finance_merch_orders"
  on public.finance_merch_orders for all using (public.current_user_is_chapter_admin());
create policy "Members read own orders"
  on public.finance_merch_orders for select
  using (auth.uid() = (select auth_user_id from public.members where id = member_id));
create policy "Members insert own orders"
  on public.finance_merch_orders for insert
  with check (auth.uid() = (select auth_user_id from public.members where id = member_id));

-- Add dues_paid_year column to members if not already present
alter table public.members add column if not exists dues_paid_year text;
