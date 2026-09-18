-- Newsletter send log: one row per recipient per send
create table if not exists newsletter_send_log (
  id                 uuid        default gen_random_uuid() primary key,
  batch_id           uuid        not null,
  newsletter_id      uuid,
  subject            text,
  sent_by            text,
  recipient_email    text        not null,
  resend_id          text,
  status             text        not null default 'pending',
  -- pending | sent | delivered | bounced | failed | complained
  status_updated_at  timestamptz,
  sent_at            timestamptz not null default now()
);

create index if not exists idx_nl_send_log_batch    on newsletter_send_log (batch_id);
create index if not exists idx_nl_send_log_resend   on newsletter_send_log (resend_id);
create index if not exists idx_nl_send_log_email    on newsletter_send_log (recipient_email);

-- Opt-out flag on members
alter table members add column if not exists email_opt_out boolean not null default false;

-- RLS: admins can read send log; anon cannot
alter table newsletter_send_log enable row level security;

create policy "Admins can read send log"
  on newsletter_send_log for select
  using (
    exists (
      select 1 from chapter_admins where email = auth.jwt() ->> 'email'
    )
  );

create policy "Service role full access to send log"
  on newsletter_send_log for all
  using (auth.role() = 'service_role');
