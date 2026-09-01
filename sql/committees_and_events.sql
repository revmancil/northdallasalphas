-- committees
create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  chair_id uuid references public.members(id) on delete set null,
  cochair_id uuid references public.members(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.committees enable row level security;
create policy "Admin full access committees" on public.committees for all using (public.current_user_is_chapter_admin());
create policy "Members read committees" on public.committees for select using (auth.role() = 'authenticated');

-- committee_members
create table if not exists public.committee_members (
  id uuid primary key default gen_random_uuid(),
  committee_id uuid not null references public.committees(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  added_by uuid references public.members(id) on delete set null,
  created_at timestamptz default now(),
  unique(committee_id, member_id)
);
alter table public.committee_members enable row level security;
create policy "Admin full access committee_members" on public.committee_members for all using (public.current_user_is_chapter_admin());
create policy "Members read committee_members" on public.committee_members for select using (auth.role() = 'authenticated');
create policy "Members manage own membership" on public.committee_members for all using (auth.uid() = (select auth_user_id from public.members where id = member_id));

-- event_plans
create table if not exists public.event_plans (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade,
  created_by uuid references public.members(id) on delete set null,
  created_at timestamptz default now()
);
alter table public.event_plans enable row level security;
create policy "Admin full access event_plans" on public.event_plans for all using (public.current_user_is_chapter_admin());
create policy "Members read event_plans" on public.event_plans for select using (auth.role() = 'authenticated');

-- event_tasks
create table if not exists public.event_tasks (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.event_plans(id) on delete cascade,
  name text not null,
  description text,
  assigned_to uuid references public.members(id) on delete set null,
  start_date date,
  end_date date,
  status text not null default 'pending' check (status in ('pending','in_progress','complete')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.event_tasks enable row level security;
create policy "Admin full access event_tasks" on public.event_tasks for all using (public.current_user_is_chapter_admin());
create policy "Members read event_tasks" on public.event_tasks for select using (auth.role() = 'authenticated');

-- event_budget_items
create table if not exists public.event_budget_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.event_plans(id) on delete cascade,
  label text not null,
  projected_amount numeric(10,2) default 0,
  actual_amount numeric(10,2) default 0,
  created_at timestamptz default now()
);
alter table public.event_budget_items enable row level security;
create policy "Admin full access event_budget_items" on public.event_budget_items for all using (public.current_user_is_chapter_admin());
create policy "Members read event_budget_items" on public.event_budget_items for select using (auth.role() = 'authenticated');

-- unique constraint for seed
alter table public.committees add constraint committees_name_unique unique (name);

-- seed 20 committees
insert into public.committees (name) values
  ('Alpha Legacy Celebration'),('Alpha Legacy Group'),('Awards & Recognition'),
  ('Big Brothers Big Sisters'),('Brother''s Keeper'),('Community Service'),
  ('Constitution'),('Go-to-High School Go-to-College'),('Chapter Website'),
  ('Housing'),('IMDP'),('March for Babies'),('NPHC'),
  ('Professional Development'),('Project Alpha'),('Protocol & Etiquette'),
  ('Social Action'),('Social Reclamation'),('Undergraduate Relations'),
  ('Voteless People is a Hopeless People')
on conflict (name) do nothing;
