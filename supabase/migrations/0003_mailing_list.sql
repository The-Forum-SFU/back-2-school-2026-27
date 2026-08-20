-- Rewind / Back 2 School 2026 — the public landing page's mailing list.
--
-- Apply via the Supabase SQL editor (or `supabase db push`). Re-runnable: the insert is
-- guarded by `on conflict do nothing`, and nothing here drops a table, a column or a row.
--
-- WHY THIS FILE EXISTS
--
-- `/` had no form until tickets were announced. It now collects addresses before the drop
-- so that moment can be mailed out, and that needs a list of its own. It could not reuse
-- an existing one:
--
--   presale-guestlist  capacity 75 and a $5 door rate. A public page feeding it would
--                      hand discounted door spots to anyone who found the site, which is
--                      exactly what putting that list on an unlisted route prevents.
--   early-access       capacity 50, and a window that closes the day after the drop.
--                      Uncapping it and moving its dates would leave the name lying about
--                      what it is.
--
-- So: a new row, and the reason every column below is what it is.
--
--   capacity   NULL, deliberately. claim_signup reports 'full' only when capacity is not
--              null, so this list can never fill and never has to publish a count. That
--              also keeps it clear of the inventory rule 0002 exists to enforce.
--   closes_at  the ticket drop, to the minute: 2026-08-24 12:00 Pacific. The server stops
--              accepting at the same instant the page swaps this form for the TicketWeb
--              block. Mirrors EVENT.ticketDropAt in src/config/event.ts, which is the
--              client's copy of the same moment. Move one and move the other.
--   door_date  2026-09-20, matching every other row. claim_signup computes age against
--              it, and the 19+ gate has to be the same gate on every list.
--   is_active  true. This is live the moment it is applied.
--
-- Every timestamp carries an explicit -07:00 (America/Vancouver, PDT) offset, for the
-- reason spelled out at the top of 0001: a bare '2026-08-24T12:00:00' is parsed as LOCAL
-- time by JS `new Date()`, so a visitor in Toronto would see the list close three hours
-- early and disagree with the server about it.

insert into public.ticket_lists
  (ticket_type, label, capacity, opens_at, closes_at, door_date, price_cents, is_active)
values
  ('mailing-list', 'Mailing List', null,
   '2026-08-10T00:00:00-07:00', '2026-08-24T12:00:00-07:00', '2026-09-20', 0, true)
on conflict (ticket_type) do nothing;

-- ---------------------------------------------------------------------------
-- Reload PostgREST's schema cache.
--
-- Not strictly needed here, since this adds no function and changes no signature. It is
-- kept because every migration in this directory ends with it and a habit that is only
-- sometimes followed is the one that gets skipped on the migration where it matters.
-- ---------------------------------------------------------------------------
notify pgrst, 'reload schema';
