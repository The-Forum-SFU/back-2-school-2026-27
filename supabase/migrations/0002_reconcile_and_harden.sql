-- Rewind / Back 2 School 2026 — reconcile the deployed schema with this repo, and
-- stop the signup path from leaking guestlist inventory.
--
-- Apply via the Supabase SQL editor (or `supabase db push`). Re-runnable: every
-- statement is guarded, and nothing here drops a table, a column or a row.
--
-- WHY THIS FILE EXISTS
--
-- 0001 was never applied to the live project. What is deployed there is an earlier
-- design: `claim_signup` takes `p_source` and has no `p_age_confirmed` or
-- `p_privacy_accepted`, while api/signup.ts calls it with the 0001 argument list. The
-- names don't match, PostgREST can't resolve the overload, and EVERY submission fails
-- with PGRST202. That is the bug this fixes first.
--
-- The rest is the inventory rule from the build plan: "Never publish guestlist
-- inventory. No page shows how many spots exist, are taken or remain." The old
-- functions returned `remaining`, `capacity` and `slot` over a public endpoint, so the
-- count was one curl away regardless of what the page rendered. Both functions below
-- now return the phase and nothing countable.

-- ---------------------------------------------------------------------------
-- 1. Columns 0001 expects that the deployed table may be missing.
--
-- All additive and all `if not exists`, so this is a no-op on a database that has
-- already caught up.
-- ---------------------------------------------------------------------------
alter table public.submissions add column if not exists age_confirmed       boolean;
alter table public.submissions add column if not exists privacy_accepted    boolean;
alter table public.submissions add column if not exists consent_text        text;
alter table public.submissions add column if not exists consent_at          timestamptz;
alter table public.submissions add column if not exists privacy_text        text;
alter table public.submissions add column if not exists privacy_accepted_at timestamptz;
alter table public.submissions add column if not exists age_at_event        smallint;
alter table public.submissions add column if not exists slot_number         integer;
alter table public.submissions add column if not exists ip_hash             text;
alter table public.submissions add column if not exists user_agent          text;
alter table public.submissions add column if not exists event_id            text;
alter table public.submissions add column if not exists meta_sent           boolean not null default false;

-- age_confirmed and privacy_accepted are deliberately left NULLABLE.
--
-- 0001 wanted them NOT NULL. They can't be tightened here, because rows written by the
-- superseded function never recorded either one, and back-filling a legal attestation
-- with a guessed value is worse than leaving the truth ("we did not record this")
-- visible as NULL. Tighten by hand once those rows are gone.

-- ---------------------------------------------------------------------------
-- 2. Indexes the concurrency and dedup guarantees depend on.
-- ---------------------------------------------------------------------------
create unique index if not exists submissions_type_email_uniq
  on public.submissions (ticket_type, email_norm);
create index if not exists submissions_type_created_idx
  on public.submissions (ticket_type, created_at);
create index if not exists submissions_iphash_created_idx
  on public.submissions (ip_hash, created_at);

-- RLS on with zero policies: anon and authenticated are denied outright.
-- service_role bypasses RLS, which is how /api reaches these. Re-asserted because a
-- table restored from a snapshot comes back with RLS off.
alter table public.submissions  enable row level security;
alter table public.ticket_lists enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Drop every stale claim_signup overload.
--
-- By exact signature, not `drop function claim_signup` — Postgres refuses an ambiguous
-- drop, and more importantly leaving two overloads in place makes PostgREST pick by
-- argument names at call time, which is how a silent "it worked yesterday" regression
-- happens. Exactly one overload may exist when this file finishes.
-- ---------------------------------------------------------------------------

-- The deployed one: has p_source, no attestations.
drop function if exists public.claim_signup(
  text, text, text, text, text, date, boolean, text, text, text, jsonb, text, text, text
);

-- The one 0001 declares. Dropped so the create below is unambiguous even when 0001
-- has been applied.
drop function if exists public.claim_signup(
  text, text, text, text, text, date, boolean, boolean, boolean,
  text, text, jsonb, text, text, text
);

-- ---------------------------------------------------------------------------
-- 4. claim_signup — the only write path.
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
--
-- RETURN SHAPE: `id` is the only identifier that comes back, and it exists so the
-- handler can patch sync state onto the row it just created. No slot number, no
-- remaining count, no capacity — see the inventory rule at the top of this file.
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
    return jsonb_build_object('status', 'already_registered', 'id', v_existing.id);
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
  -- the door date; gating on now() would wrongly reject every late-2007 birthday for
  -- weeks. BC's 19+ rule is about the entry date anyway.
  --
  -- This is the ONLY age gate that counts. The form's own check runs against a date in
  -- src/config/event.ts, which is a mirror and can drift; door_date here is the truth.
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

  -- Note the response carries no capacity. Someone who submits into a full list learns
  -- that it is full, which they must, and nothing about how big it was.
  if v_list.capacity is not null and v_taken >= v_list.capacity then
    return jsonb_build_object('status', 'full');
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
    coalesce(p_age_confirmed, false), coalesce(p_consent_opt_in, false),
    coalesce(p_privacy_accepted, false),
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

  return jsonb_build_object('status', 'created', 'id', v_row.id);

exception
  when unique_violation then
    -- Unreachable while the row lock holds. Kept so that a future refactor which
    -- drops the lock degrades to "idempotent success" instead of a 500.
    select * into v_existing
      from public.submissions
     where ticket_type = p_ticket_type and email_norm = v_email;
    return jsonb_build_object('status', 'already_registered', 'id', v_existing.id);
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
-- 5. list_status — read-only, for the page's initial render.
--
-- Returns the PHASE and nothing else countable. `remaining` and `capacity` used to be
-- in this payload, which meant the exact number of guestlist spots left was readable
-- by anyone who called /api/list-status, no matter what the page chose to render.
-- Whether the form is open is all a browser needs to know.
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

-- ---------------------------------------------------------------------------
-- 6. Tell PostgREST to re-read the schema.
--
-- Without this the API keeps serving from a cached catalogue and every call to the
-- function created above still 404s with PGRST202 — the exact symptom this file was
-- written to fix, now with a correct database underneath it.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
