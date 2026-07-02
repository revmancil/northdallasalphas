-- Run this in the Supabase SQL editor AFTER SUPABASE_CONTENT_SCHEMA.sql has
-- already been applied at least once (it depends on public.chapter_admins
-- and public.current_user_is_chapter_admin()).
--
-- Adds role-based access control for the admin dashboard: full admins keep
-- today's unrestricted access, while a restricted admin (e.g. a chapter
-- secretary) can be limited to only the panels they need
-- (Meetings, Events, Announcement Bar, etc.) without being able to touch
-- website page content or manage other admins.
--
-- Safe to re-run. Existing chapter_admins rows default to is_full_admin =
-- true, so nobody currently in the roster loses access when this runs.

-- =============================================================================
-- 1) Permission columns on chapter_admins
-- =============================================================================

alter table public.chapter_admins
  add column if not exists is_full_admin boolean not null default true,
  add column if not exists sections text[] not null default '{}';

-- =============================================================================
-- 2) Helper functions (SECURITY DEFINER so policies can check chapter_admins
--    without recursive RLS -- same pattern as current_user_is_chapter_admin).
-- =============================================================================

create or replace function public.current_user_is_full_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_full_admin from public.chapter_admins
     where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))),
    false
  );
$$;

create or replace function public.current_user_can_manage(section text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chapter_admins
    where lower(trim(email)) = lower(trim(auth.jwt() ->> 'email'))
      and (is_full_admin or section = any(sections))
  );
$$;

grant execute on function public.current_user_is_full_admin() to authenticated;
grant execute on function public.current_user_can_manage(text) to authenticated;

-- site_content is a shared key/value table (officers, past presidents, news
-- articles, event gallery, brother directory all live here under different
-- content_key values), so map each key to the admin section that owns it.
create or replace function public.site_content_section_key(key text)
returns text
language sql
immutable
as $$
  select case key
    when 'officers'          then 'officers'
    when 'president'         then 'officers'
    when 'past_presidents'   then 'presidents'
    when 'news_articles'     then 'news-manager'
    when 'event_gallery'     then 'gallery'
    when 'brothers_directory' then 'members'
    else 'settings' -- unrecognized/new keys require full admin until mapped
  end;
$$;

-- =============================================================================
-- 3) Section-aware admin write policies.
--    Public/member read policies (anon, authenticated select) are untouched --
--    the public site and member portal still need to read this content.
-- =============================================================================

drop policy if exists "site_content_write_auth" on public.site_content;
create policy "site_content_write_auth"
on public.site_content for all
to authenticated
using ( public.current_user_can_manage(public.site_content_section_key(content_key)) )
with check ( public.current_user_can_manage(public.site_content_section_key(content_key)) );

drop policy if exists "page_sections_write_auth" on public.page_sections;
create policy "page_sections_write_auth"
on public.page_sections for all
to authenticated
using ( public.current_user_can_manage('pages') )
with check ( public.current_user_can_manage('pages') );

drop policy if exists "events_write_auth" on public.events;
create policy "events_write_auth"
on public.events for all
to authenticated
using ( public.current_user_can_manage('events') )
with check ( public.current_user_can_manage('events') );

drop policy if exists "announcements_write_auth" on public.announcements;
create policy "announcements_write_auth"
on public.announcements for all
to authenticated
using ( public.current_user_can_manage('announcements') )
with check ( public.current_user_can_manage('announcements') );

drop policy if exists "newsletter_templates_write_auth" on public.newsletter_templates;
create policy "newsletter_templates_write_auth"
on public.newsletter_templates for all
to authenticated
using ( public.current_user_can_manage('newsletter') )
with check ( public.current_user_can_manage('newsletter') );

-- Visiting-brother request review/approval is part of Member Requests.
-- The public submission form's anon insert policy is untouched.
drop policy if exists "visiting_requests_write_auth" on public.visiting_brothers_requests;
create policy "visiting_requests_write_auth"
on public.visiting_brothers_requests for all
to authenticated
using ( public.current_user_can_manage('members') )
with check ( public.current_user_can_manage('members') );

-- Event Registrations panel (grouped under Events) deletes registrations.
drop policy if exists "event_registrations_delete_auth" on public.event_registrations;
create policy "event_registrations_delete_auth"
on public.event_registrations for delete
to authenticated
using ( public.current_user_can_manage('events') );

-- =============================================================================
-- 4) chapter_admins itself: only full admins manage the admin roster/
--    permissions. Inserts/updates still only happen via the
--    grant-chapter-admin Edge Function (service role), which now enforces
--    the same full-admin requirement in application code.
-- =============================================================================

-- Every chapter admin (including limited ones) must be able to read their
-- own row -- the dashboard uses it to decide which sections to show. Only
-- full admins can see the rest of the roster. Postgres OR's multiple
-- permissive SELECT policies together, so both apply.
drop policy if exists "chapter_admins_select" on public.chapter_admins;
drop policy if exists "chapter_admins_select_self" on public.chapter_admins;
drop policy if exists "chapter_admins_select_all_for_full_admins" on public.chapter_admins;

create policy "chapter_admins_select_self"
on public.chapter_admins for select
to authenticated
using ( lower(trim(email)) = lower(trim(auth.jwt() ->> 'email')) );

create policy "chapter_admins_select_all_for_full_admins"
on public.chapter_admins for select
to authenticated
using ( public.current_user_is_full_admin() );

drop policy if exists "chapter_admins_delete" on public.chapter_admins;
create policy "chapter_admins_delete"
on public.chapter_admins for delete
to authenticated
using (
  public.current_user_is_full_admin()
  and public.chapter_admin_record_count() > 1
  and lower(trim(email)) <> lower(trim(auth.jwt() ->> 'email'))
);

-- =============================================================================
-- NOT covered by this migration (left as-is on purpose):
-- meetings, meeting_rsvps, meeting_attendance, event_attendance, documents,
-- chapter_news, store_items, store_orders, member_announcements, members.
-- These tables aren't defined in SUPABASE_CONTENT_SCHEMA.sql (they were
-- created directly in the Supabase dashboard) and several of them are
-- written to directly by member-portal.html / the anon check-in kiosks
-- (event-checkin.html, meeting-checkin.html), not just admin-dashboard.html.
-- Locking them down to "current_user_can_manage('meetings')" etc. without
-- first seeing their live policies risks breaking member RSVPs, self
-- check-in, document uploads, and store orders. The admin dashboard UI
-- still hides/blocks these panels for restricted admins (see
-- admin-dashboard.html), but true database-level enforcement for them needs
-- a follow-up once their current policies can be inspected.
-- =============================================================================
