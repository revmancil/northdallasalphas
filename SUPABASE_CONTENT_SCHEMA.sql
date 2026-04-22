-- Run this in Supabase SQL editor.
-- It adds the content tables required by the website runtime.

create table if not exists public.site_content (
  content_key text primary key,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.page_sections (
  page_id text not null,
  section_key text not null,
  content_html text not null default '',
  updated_at timestamptz not null default now(),
  primary key (page_id, section_key)
);

-- Ensure expected columns exist on existing tables.
alter table if exists public.events
  add column if not exists sort_order integer,
  add column if not exists description text,
  add column if not exists reg_url text,
  add column if not exists flyer text,
  add column if not exists featured boolean default false;

alter table if exists public.announcements
  add column if not exists link_text text,
  add column if not exists link_url text,
  add column if not exists active boolean default true,
  add column if not exists updated_at timestamptz default now();

-- RLS setup
alter table public.site_content enable row level security;
alter table public.page_sections enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;

-- Public read policies (site pages use anon key)
drop policy if exists "site_content_read_all" on public.site_content;
create policy "site_content_read_all"
on public.site_content for select
to anon, authenticated
using (true);

drop policy if exists "page_sections_read_all" on public.page_sections;
create policy "page_sections_read_all"
on public.page_sections for select
to anon, authenticated
using (true);

drop policy if exists "events_read_all" on public.events;
create policy "events_read_all"
on public.events for select
to anon, authenticated
using (true);

drop policy if exists "announcements_read_all" on public.announcements;
create policy "announcements_read_all"
on public.announcements for select
to anon, authenticated
using (true);

-- Admin write policies (admin signs in with Supabase Auth user token)
drop policy if exists "site_content_write_auth" on public.site_content;
create policy "site_content_write_auth"
on public.site_content for all
to authenticated
using (true)
with check (true);

drop policy if exists "page_sections_write_auth" on public.page_sections;
create policy "page_sections_write_auth"
on public.page_sections for all
to authenticated
using (true)
with check (true);

drop policy if exists "events_write_auth" on public.events;
create policy "events_write_auth"
on public.events for all
to authenticated
using (true)
with check (true);

drop policy if exists "announcements_write_auth" on public.announcements;
create policy "announcements_write_auth"
on public.announcements for all
to authenticated
using (true)
with check (true);
