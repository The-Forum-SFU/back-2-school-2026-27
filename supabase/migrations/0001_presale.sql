-- Rewind / Back 2 School 2026 — signup capture.
--
-- NOTE: both functions at the bottom of this file are SUPERSEDED by
-- 0002_reconcile_and_harden.sql, which drops and recreates them so that neither
-- claim_signup nor list_status returns a countable inventory figure. Run 0002 after
-- this one; on a database that already has an older shape, 0002 alone is enough.
--
-- Apply via the Supabase SQL editor (or `supabase db push`) against the standalone
-- project for this event. The client never talks to these tables: /api reaches them
-- with the service-role key, and RLS is on with no policies so anon is denied.
--
-- NAMING: the paid table option is "Table Service" everywhere — never "bottle
-- service". Deliberate legal-liability decision; do not let a variant into copy,
-- form values, column values, Brevo tags, alt text, or metadata.

-- ---------------------------------------------------------------------------
-- Per-list configuration.
--
-- This is the authority for capacity and signup windows. It deliberately does NOT
-- live in src/config — /api never imports from the frontend, and a client-supplied
-- capacity or closing time would be wide open to anyone hitting the endpoint
-- directly. src/config/event.ts mirrors these values for first-frame rendering
-- only; on any disagreement the server wins.
--
-- Locking the row for a ticket_type is also what makes the capacity check atomic
-- (see claim_signup below), so this table earns its keep twice.
-- ---------------------------------------------------------------------------
create table if not exists public.ticket_lists (
  ticket_type  text        primary key,
  label        text        not null,
  capacity     integer,                          -- null = uncapped
  opens_at     timestamptz not null,
  closes_at    timestamptz not null,
  door_date    date        not null,             -- age is computed against THIS, not now()
  min_age      smallint    not null default 19,
  price_cents  integer     not null default 0,
  is_active    boolean     not null default true
);

-- All four types seeded now, so bringing a later page online is an UPDATE rather
-- than a migration.
--
-- Every timestamp carries an explicit -07:00 (America/Vancouver, PDT) offset. A bare
-- '2026-08-10T00:00:00' is parsed as *local* time by JS `new Date()`, so a visitor in
-- Toronto would see the list open three hours early and the server would disagree
-- with both of them.
insert into public.ticket_lists
  (ticket_type, label, capacity, opens_at, closes_at, door_date, price_cents, is_active)
values
  -- Cap is 75, not the 50 in the original brief — raised for this event.
  ('presale-guestlist', 'Discounted Guestlist', 75,
   '2026-08-10T00:00:00-07:00', '2026-08-25T23:59:59-07:00', '2026-09-20', 500, true),
  ('early-access',      'Early Access List',    50,
   '2026-08-20T00:00:00-07:00', '2026-08-24T23:59:59-07:00', '2026-09-20',   0, true),
  ('general-onsale',    'General On-Sale',    null,
   '2026-08-24T00:00:00-07:00', '2026-09-20T23:59:59-07:00', '2026-09-20',   0, true),
  -- Window is still TBD, so it ships inactive rather than guessing dates.
  ('table-service',     'Table Service',      null,
   '2026-08-10T00:00:00-07:00', '2026-09-25T23:59:59-07:00', '2026-09-20',   0, false)
on conflict (ticket_type) do nothing;

-- ---------------------------------------------------------------------------
-- Signups.
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),

  first_name   text not null,
  last_name    text not null,
  email        text not null,
  -- Backs the dedup index. Generated so it can never drift from `email`.
  email_norm   text generated always as (lower(btrim(email))) stored,
  phone        text not null,
  dob          date not null,

  -- Legal attestations. `age_confirmed` is a record of what the user ticked; it is
  -- NEVER the gate. `age_at_event` below is the computed truth.
  age_confirmed    boolean not null,
  consent_opt_in   boolean not null,
  privacy_accepted boolean not null,

  -- The exact strings rendered at submission time, stored verbatim for CASL/PIPEDA.
  -- Wording changes are not retroactive, which is the point.
  consent_text        text,
  consent_at          timestamptz,
  privacy_text        text,
  privacy_accepted_at timestamptz,

  ticket_type  text not null references public.ticket_lists(ticket_type),
  -- Age at the door date, computed server-side. See claim_signup.
  age_at_event smallint not null,
  -- "You're #37 of 75". Named slot_number, not `position` — that's a Postgres function.
  slot_number  integer not null,

  fbclid       text,
  fbp          text,
  utm_source   text,
  utm_medium   text,
  utm_campaign text,

  -- sha256(ip + IP_HASH_SALT). Raw IPs are never stored.
  ip_hash      text,
  user_agent   text,
  -- The Meta dedup id used for this row's Lead event.
  event_id     text,

  -- Downstream sync state. `where not brevo_synced` is the backfill queue when
  -- Brevo or Meta is down — the signup itself is never failed over these.
  brevo_synced     boolean not null default false,
  brevo_contact_id text,
  meta_sent        boolean not null default false
);

-- Alignment for a project where an EARLIER version of this table already exists.
-- The original spec shipped 17 columns; the block below adds everything this build
-- needs, so the migration is safe to run against both a fresh database and one that
-- already has the old shape. `if not exists` makes each statement a no-op the second
-- time, which is what keeps the whole file re-runnable.
alter table public.submissions add column if not exists email_norm text
  generated always as (lower(btrim(email))) stored;
alter table public.submissions add column if not exists privacy_accepted boolean;
alter table public.submissions add column if not exists consent_text text;
alter table public.submissions add column if not exists consent_at timestamptz;
alter table public.submissions add column if not exists privacy_text text;
alter table public.submissions add column if not exists privacy_accepted_at timestamptz;
alter table public.submissions add column if not exists age_at_event smallint;
alter table public.submissions add column if not exists slot_number integer;
alter table public.submissions add column if not exists ip_hash text;
alter table public.submissions add column if not exists user_agent text;
alter table public.submissions add column if not exists event_id text;
alter table public.submissions add column if not exists meta_sent boolean not null default false;

-- The three columns above that are logically NOT NULL are added nullable first,
-- because ADD COLUMN ... NOT NULL fails outright on a table that already has rows.
-- Tightening them separately works on an empty table and is a clear, loud failure
-- on a populated one — which is the right time to stop and backfill deliberately.
do $$
begin
  if not exists (select 1 from public.submissions) then
    alter table public.submissions alter column privacy_accepted set not null;
    alter table public.submissions alter column age_at_event   set not null;
    alter table public.submissions alter column slot_number    set not null;
  else
    raise notice 'submissions has rows; leaving privacy_accepted/age_at_event/slot_number nullable. Backfill, then set NOT NULL by hand.';
  end if;
end $$;

-- ticket_type must reference the config table, or a typo'd list silently accepts rows.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'submissions_ticket_type_fkey'
  ) then
    alter table public.submissions
      add constraint submissions_ticket_type_fkey
      foreign key (ticket_type) references public.ticket_lists(ticket_type);
  end if;
end $$;

-- One signup per email per list. Someone can be on the guestlist AND early access.
create unique index if not exists submissions_type_email_uniq
  on public.submissions (ticket_type, email_norm);
create index if not exists submissions_type_created_idx
  on public.submissions (ticket_type, created_at);
create index if not exists submissions_iphash_created_idx
  on public.submissions (ip_hash, created_at);

-- RLS on with zero policies: anon and authenticated are denied outright.
-- service_role bypasses RLS, which is how /api reaches these.
alter table public.submissions  enable row level security;
alter table public.ticket_lists enable row level security;

-- ---------------------------------------------------------------------------
-- claim_signup — the only write path.
--
-- Concurrency: the `for update` on the ticket_lists row is the entire story. Two
-- submissions for the same list serialize on it; a different list doesn't block.
-- Under READ COMMITTED the blocked transaction resumes after the first commits, and
-- its subsequent count(*) takes a fresh statement snapshot — so it sees the row that
-- was just inserted and cannot overshoot the cap.
--
-- Do NOT add network calls (Brevo, Meta) inside this function. It holds a row lock;
-- the Node handler makes those calls after this returns, keeping the transaction
-- at roughly 2ms.
-- ---------------------------------------------------------------------------
create or replace function public.claim_signup(
  p_ticket_type      text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_dob              date,
  p_age_confirmed    boolean,
  p_consent_opt_in   boolean,
  p_privacy_accepted boolean,
  p_consent_text     text    default null,
  p_privacy_text     text    default null,
  p_attribution      jsonb   default '{}'::jsonb,
  p_ip_hash          text    default null,
  p_user_agent       text    default null,
  p_event_id         text    default null
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_list     public.ticket_lists%rowtype;
  v_email    text := lower(btrim(p_email));
  v_existing public.submissions%rowtype;
  v_taken    integer;
  v_age      integer;
  v_recent   integer;
  v_row      public.submissions%rowtype;
begin
  select * into v_list
    from public.ticket_lists
   where ticket_type = p_ticket_type
     for update;

  if not found or not v_list.is_active then
    return jsonb_build_object('status', 'unknown_list');
  end if;

  -- Duplicate check FIRST, deliberately. An existing signup already owns its slot, so
  -- a double-click, a retry after a lost response, or a curious re-submit must succeed
  -- even if the list has since filled or closed. Telling someone who is already on the
  -- list that it's full is the worst available failure mode.
  select * into v_existing
    from public.submissions
   where ticket_type = p_ticket_type and email_norm = v_email;

  if found then
    return jsonb_build_object(
      'status', 'already_registered',
      'id',     v_existing.id,
      'slot',   v_existing.slot_number
    );
  end if;

  if now() < v_list.opens_at then
    return jsonb_build_object(
      'status',   'not_open',
      'opensAt',  v_list.opens_at,
      'closesAt', v_list.closes_at
    );
  end if;

  if now() > v_list.closes_at then
    return jsonb_build_object(
      'status',   'closed',
      'opensAt',  v_list.opens_at,
      'closesAt', v_list.closes_at
    );
  end if;

  -- Age at the DOOR, not age today. Someone born 2007-10-01 is 18 in August and 19 on
  -- Sept 26; gating on now() would wrongly reject every late-2007 birthday for six
  -- weeks. BC's 19+ rule is about the entry date anyway.
  v_age := extract(year from age(v_list.door_date, p_dob))::int;
  if v_age < v_list.min_age then
    return jsonb_build_object('status', 'underage', 'minAge', v_list.min_age);
  end if;

  -- Rate limiting lives here, inside the lock, because serverless functions share no
  -- memory between invocations — an in-process limiter would be decorative.
  if p_ip_hash is not null then
    select count(*) into v_recent
      from public.submissions
     where ip_hash = p_ip_hash
       and created_at > now() - interval '1 hour';
    if v_recent >= 5 then
      return jsonb_build_object('status', 'rate_limited');
    end if;
  end if;

  select count(*) into v_taken
    from public.submissions
   where ticket_type = p_ticket_type;

  if v_list.capacity is not null and v_taken >= v_list.capacity then
    return jsonb_build_object('status', 'full', 'capacity', v_list.capacity);
  end if;

  insert into public.submissions (
    first_name, last_name, email, phone, dob,
    age_confirmed, consent_opt_in, privacy_accepted,
    consent_text, consent_at, privacy_text, privacy_accepted_at,
    ticket_type, age_at_event, slot_number,
    fbclid, fbp, utm_source, utm_medium, utm_campaign,
    ip_hash, user_agent, event_id
  ) values (
    btrim(p_first_name), btrim(p_last_name), v_email, p_phone, p_dob,
    p_age_confirmed, coalesce(p_consent_opt_in, false), p_privacy_accepted,
    case when p_consent_opt_in then p_consent_text else null end,
    case when p_consent_opt_in then now() else null end,
    p_privacy_text,
    case when p_privacy_accepted then now() else null end,
    p_ticket_type, v_age, v_taken + 1,
    nullif(p_attribution ->> 'fbclid', ''),
    nullif(p_attribution ->> 'fbp', ''),
    nullif(p_attribution ->> 'utmSource', ''),
    nullif(p_attribution ->> 'utmMedium', ''),
    nullif(p_attribution ->> 'utmCampaign', ''),
    p_ip_hash, p_user_agent, p_event_id
  ) returning * into v_row;

  return jsonb_build_object(
    'status',    'created',
    'id',        v_row.id,
    'slot',      v_row.slot_number,
    'remaining', case when v_list.capacity is null
                      then null
                      else v_list.capacity - v_row.slot_number end
  );

exception
  when unique_violation then
    -- Unreachable while the row lock holds. Kept so that a future refactor which
    -- drops the lock degrades to "idempotent success" instead of a 500.
    select * into v_existing
      from public.submissions
     where ticket_type = p_ticket_type and email_norm = v_email;
    return jsonb_build_object(
      'status', 'already_registered',
      'id',     v_existing.id,
      'slot',   v_existing.slot_number
    );
end;
$$;

revoke all on function public.claim_signup(
  text, text, text, text, text, date, boolean, boolean, boolean,
  text, text, jsonb, text, text, text
) from public, anon, authenticated;

grant execute on function public.claim_signup(
  text, text, text, text, text, date, boolean, boolean, boolean,
  text, text, jsonb, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- list_status — read-only, for the page's initial render.
-- Only the server knows `remaining`, so the client cannot determine "full" alone.
-- ---------------------------------------------------------------------------
create or replace function public.list_status(p_ticket_type text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'ticketType', l.ticket_type,
    'opensAt',    l.opens_at,
    'closesAt',   l.closes_at,
    'capacity',   l.capacity,
    'remaining',  case when l.capacity is null then null
                  else greatest(l.capacity - (
                    select count(*) from public.submissions s
                     where s.ticket_type = l.ticket_type), 0) end,
    'phase', case
      when not l.is_active     then 'closed'
      when now() < l.opens_at  then 'before'
      when now() > l.closes_at then 'closed'
      when l.capacity is not null
       and (select count(*) from public.submissions s
             where s.ticket_type = l.ticket_type) >= l.capacity then 'full'
      else 'open'
    end
  )
  from public.ticket_lists l
  where l.ticket_type = p_ticket_type;
$$;

revoke all on function public.list_status(text) from public, anon, authenticated;
grant execute on function public.list_status(text) to service_role;
