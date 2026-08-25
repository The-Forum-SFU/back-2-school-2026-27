-- Rewind / Back 2 School 2026 — the friends & family discounted guestlist.
--
-- Apply via the Supabase SQL editor (or `supabase db push`). Re-runnable: the insert is
-- guarded by `on conflict do nothing`, and nothing here drops a table, a column or a row.
--
-- WHY THIS FILE EXISTS
--
-- A second discounted guestlist, handed out by hand rather than through promoters. Same
-- page, same $5 door rate, same terms. The one thing it must NOT share is the count.
--
-- THE POOL IS THE TICKET TYPE. claim_signup takes its capacity check from
--
--     select count(*) into v_taken
--       from public.submissions
--      where ticket_type = p_ticket_type;
--
-- so a list's remaining spots are its own submissions and nothing else. Pointing the new
-- route at 'presale-guestlist' would have been one row and no migration, and it would have
-- meant these 75 and the promoter list's 75 drawing down a single count of 75 — whichever
-- link went out first would have taken the lot. A new `ticket_type` is what makes the two
-- counts independent, and it costs nothing else: the same row lock, the same duplicate
-- check, the same rate limiter, all already keyed by ticket_type.
--
-- Note that the duplicate check is per-type too (`ticket_type = p_ticket_type and
-- email_norm = v_email`). One person can therefore hold a spot on BOTH lists with the same
-- address. That is the correct behaviour for two separate allocations, and it is not a way
-- to get in twice: the door checks a name, and the name is on the list either way.
--
-- EVERY COLUMN, AND WHY
--
--   capacity     75, matching the promoter list's cap because the ask was the same size.
--                Its own row, so its own count. Mirrored in LISTS['friends-family'] in
--                src/config/event.ts for first-frame rendering only; the DB is
--                authoritative and /api/list-status wins on any disagreement.
--   opens_at     2026-08-10, the same date the promoter list opened. In the past, so this
--                list is open the moment the migration lands.
--   closes_at    2026-09-19 23:59:59 Pacific, the night before doors, and the one window
--                value that deliberately does NOT match the promoter list's 2026-08-25.
--                That list was built around the ticket drop; this link is handed out in
--                person over weeks, so it stays open until there is no night left to
--                attend. Mirrors LISTS['friends-family'].closesAt. Move one, move the other.
--   door_date    2026-09-20, matching every other row. claim_signup computes age against
--                it, and the 19+ gate has to be the same gate on every list.
--   price_cents  500, the same $5 early door rate. Mirrors EVENT.pricing.doorEarlyCents,
--                and it is what makes /confirmed show this list the door panel and the
--                price comparison (both keyed on priceCents > 0).
--   is_active    true. This is live the moment it is applied.
--
-- Every timestamp carries an explicit -07:00 (America/Vancouver, PDT) offset, for the
-- reason spelled out at the top of 0001: a bare '2026-09-19T23:59:59' is parsed as LOCAL
-- time by JS `new Date()`, so a visitor in Toronto would see the list close three hours
-- early and disagree with the server about it.

insert into public.ticket_lists
  (ticket_type, label, capacity, opens_at, closes_at, door_date, price_cents, is_active)
values
  ('friends-family', 'Friends & Fam Discounted Guestlist', 75,
   '2026-08-10T00:00:00-07:00', '2026-09-19T23:59:59-07:00', '2026-09-20', 500, true)
on conflict (ticket_type) do nothing;

-- ---------------------------------------------------------------------------
-- Reload PostgREST's schema cache.
--
-- Not strictly needed here, since this adds no function and changes no signature. It is
-- kept because every migration in this directory ends with it and a habit that is only
-- sometimes followed is the one that gets skipped on the migration where it matters.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
