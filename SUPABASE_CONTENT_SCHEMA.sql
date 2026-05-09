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

create table if not exists public.newsletter_templates (
  id bigserial primary key,
  template_name text not null,
  subject text not null default '',
  preheader text not null default '',
  sections_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visiting_brothers_requests (
  id bigserial primary key,
  status text not null default 'pending',
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  phone text not null default '',
  city text not null default '',
  state text not null default '',
  member_since text not null default '',
  alpha_id text not null default '',
  initiation_date text not null default '',
  initiation_chapter text not null default '',
  college text not null default '',
  life_member text not null default '',
  life_member_number text not null default '',
  imdp_certified text not null default '',
  risk_mgmt_certified text not null default '',
  renewal_date text not null default '',
  linkedin text not null default '',
  photo text not null default '',
  bio text not null default '',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Ensure expected columns exist on existing tables.
alter table if exists public.events
  add column if not exists sort_order integer,
  add column if not exists description text,
  add column if not exists reg_url text,
  add column if not exists flyer text,
  add column if not exists featured boolean default false,
  add column if not exists created_at timestamptz default now(),
  add column if not exists event_date date,
  add column if not exists updated_at timestamptz default now();

alter table if exists public.announcements
  add column if not exists link_text text,
  add column if not exists link_url text,
  add column if not exists active boolean default true,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

alter table if exists public.page_sections
  add column if not exists created_at timestamptz default now();

-- Legacy compatibility:
-- Some older page_sections tables include an `id` primary key that is NOT NULL
-- without a default. Current app writes by (page_id, section_key) and may
-- insert rows without id, so ensure id can auto-generate if omitted.
do $$
declare
  id_udt text;
  id_default text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'page_sections'
      and column_name = 'id'
      and is_nullable = 'NO'
  ) then
    select c.udt_name, c.column_default
    into id_udt, id_default
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'page_sections'
      and c.column_name = 'id';

    if id_default is null then
      if id_udt = 'uuid' then
        execute 'alter table public.page_sections alter column id set default gen_random_uuid()';
      elsif id_udt in ('int4', 'int8') then
        execute 'create sequence if not exists public.page_sections_id_seq';
        execute 'alter table public.page_sections alter column id set default nextval(''public.page_sections_id_seq'')';
      elsif id_udt in ('text', 'varchar') then
        execute 'alter table public.page_sections alter column id set default replace(gen_random_uuid()::text, ''-'', '''')';
      end if;
    end if;
  end if;
end $$;

alter table if exists public.members
  add column if not exists chapter_active_date date,
  add column if not exists imdp_certified text,
  add column if not exists risk_mgmt_certified text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- RLS setup
alter table public.site_content enable row level security;
alter table public.page_sections enable row level security;
alter table public.events enable row level security;
alter table public.announcements enable row level security;
alter table public.newsletter_templates enable row level security;
alter table public.visiting_brothers_requests enable row level security;

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

drop policy if exists "newsletter_templates_read_auth" on public.newsletter_templates;
create policy "newsletter_templates_read_auth"
on public.newsletter_templates for select
to authenticated
using (true);

drop policy if exists "visiting_requests_insert_anon" on public.visiting_brothers_requests;
create policy "visiting_requests_insert_anon"
on public.visiting_brothers_requests for insert
to anon, authenticated
with check (true);

drop policy if exists "visiting_requests_read_auth" on public.visiting_brothers_requests;
create policy "visiting_requests_read_auth"
on public.visiting_brothers_requests for select
to authenticated
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

drop policy if exists "newsletter_templates_write_auth" on public.newsletter_templates;
create policy "newsletter_templates_write_auth"
on public.newsletter_templates for all
to authenticated
using (true)
with check (true);

drop policy if exists "visiting_requests_write_auth" on public.visiting_brothers_requests;
create policy "visiting_requests_write_auth"
on public.visiting_brothers_requests for all
to authenticated
using (true)
with check (true);

-- =============================================================================
-- Storage: dedicated bucket for Events Manager flyers (NOT the event gallery)
-- Gallery + site listing use bucket "chapter-media". Event flyer uploads from
-- admin-dashboard use bucket "event-flyer-uploads" only. Run this block in the
-- SQL editor if uploads return 400/404 for flyers.
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('event-flyer-uploads', 'event-flyer-uploads', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "event_flyer_uploads_select_anon" on storage.objects;
create policy "event_flyer_uploads_select_anon"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'event-flyer-uploads');

drop policy if exists "event_flyer_uploads_insert_auth" on storage.objects;
create policy "event_flyer_uploads_insert_auth"
on storage.objects for insert
to authenticated
with check (bucket_id = 'event-flyer-uploads');

drop policy if exists "event_flyer_uploads_update_auth" on storage.objects;
create policy "event_flyer_uploads_update_auth"
on storage.objects for update
to authenticated
using (bucket_id = 'event-flyer-uploads')
with check (bucket_id = 'event-flyer-uploads');

drop policy if exists "event_flyer_uploads_delete_auth" on storage.objects;
create policy "event_flyer_uploads_delete_auth"
on storage.objects for delete
to authenticated
using (bucket_id = 'event-flyer-uploads');

-- =============================================================================
-- Chapter event registration (free via site, paid via Stripe Checkout) + dues
-- =============================================================================

alter table if exists public.events
  add column if not exists chapter_registration_enabled boolean not null default false,
  add column if not exists registration_fee_cents integer not null default 0;

create table if not exists public.event_registrations (
  id bigserial primary key,
  event_id bigint references public.events(id) on delete set null,
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  payment_status text not null default 'free',
  amount_cents integer not null default 0,
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists event_registrations_stripe_session_uidx
  on public.event_registrations (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create table if not exists public.dues_payments (
  id bigserial primary key,
  member_id bigint,
  full_name text not null default '',
  phone text not null default '',
  email text not null default '',
  amount_cents integer not null default 0,
  payment_status text not null default 'paid',
  stripe_checkout_session_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists dues_payments_stripe_session_uidx
  on public.dues_payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.event_registrations enable row level security;
alter table public.dues_payments enable row level security;

drop policy if exists "event_registrations_insert_free_anon" on public.event_registrations;
create policy "event_registrations_insert_free_anon"
on public.event_registrations for insert
to anon, authenticated
with check (
  payment_status = 'free'
  and coalesce(amount_cents, 0) = 0
  and event_id is not null
  and coalesce(nullif(trim(stripe_checkout_session_id), ''), null) is null
);

drop policy if exists "event_registrations_read_auth" on public.event_registrations;
create policy "event_registrations_read_auth"
on public.event_registrations for select
to authenticated
using (true);

drop policy if exists "event_registrations_write_auth" on public.event_registrations;

drop policy if exists "dues_payments_read_auth" on public.dues_payments;
create policy "dues_payments_read_auth"
on public.dues_payments for select
to authenticated
using (true);

drop policy if exists "dues_payments_write_auth" on public.dues_payments;

insert into public.site_content (content_key, content_json)
values ('payments', '{"dues_amount_cents": 15000}'::jsonb)
on conflict (content_key) do nothing;
