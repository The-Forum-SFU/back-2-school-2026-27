import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Static guards over the SQL.
 *
 * These can't run the migrations — that needs a live Postgres — so they check the
 * things that are true by reading, and that would otherwise only be caught in
 * production: a function handing back a count it should not, a signature that has
 * drifted from what the handler calls, or a `security definer` function without a
 * pinned search_path.
 */

const DIR = join(process.cwd(), 'supabase/migrations')
const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
const sqlByFile = new Map(files.map((f) => [f, readFileSync(join(DIR, f), 'utf8')]))

/** The file that defines the functions actually in use. */
const CURRENT = '0002_reconcile_and_harden.sql'
const current = sqlByFile.get(CURRENT)!

/** Drops `--` comments so a guard reads the SQL and not the prose explaining it. */
function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '')
}

describe('migration files', () => {
  it('are numbered and ordered', () => {
    expect(files.length).toBeGreaterThan(0)
    for (const name of files) expect(name).toMatch(/^\d{4}_[a-z0-9_]+\.sql$/)
  })

  it('includes the reconciliation migration', () => {
    expect(current).toBeTruthy()
  })
})

describe('inventory is never returned by the database', () => {
  it('builds no response object carrying a count', () => {
    // The build plan: "Never publish guestlist inventory. No page shows how many spots
    // exist, are taken or remain." A page can only avoid showing what it is never sent.
    //
    // Matches the key position in a jsonb_build_object pair — `'remaining',` — rather
    // than trying to bracket-match the calls, which nest.
    const sql = stripComments(current)
    expect(sql).toMatch(/jsonb_build_object/)
    expect(sql).not.toMatch(/'(remaining|capacity|slot|slot_number)'\s*,/)
  })

  it('still selects capacity internally, because the cap has to be enforced somewhere', () => {
    expect(current).toMatch(/v_list\.capacity is not null/)
  })
})

describe('claim_signup', () => {
  it('takes exactly the arguments api/signup.ts passes', () => {
    const handler = readFileSync(join(process.cwd(), 'api/signup.ts'), 'utf8')
    const called = [...handler.matchAll(/^\s+(p_[a-z_]+):/gm)].map((m) => m[1]).sort()

    const signature = current.slice(
      current.indexOf('create or replace function public.claim_signup('),
    )
    const declared = [...signature.slice(0, signature.indexOf(')')).matchAll(/(p_[a-z_]+)\s+\w/g)]
      .map((m) => m[1])
      .sort()

    // The exact drift that broke every submission: the deployed function had p_source
    // and no attestations, while the handler sent the other list.
    expect(declared).toEqual(called)
  })

  it('drops the stale overloads, so PostgREST cannot resolve to the wrong one', () => {
    const drops = current.match(/drop function if exists public\.claim_signup\(/g) ?? []
    expect(drops.length).toBeGreaterThanOrEqual(2)
  })

  it('checks for a duplicate before the window, the cap and the rate limit', () => {
    // Someone already on the list must succeed even after it fills or closes. Telling
    // them it is full is the worst available failure mode.
    const body = current.slice(current.indexOf('create or replace function public.claim_signup('))
    expect(body.indexOf('already_registered')).toBeLessThan(body.indexOf("'not_open'"))
    expect(body.indexOf('already_registered')).toBeLessThan(body.indexOf("'full'"))
    expect(body.indexOf('already_registered')).toBeLessThan(body.indexOf("'rate_limited'"))
  })

  it('locks the list row, which is what makes the capacity check atomic', () => {
    expect(current).toMatch(/from public\.ticket_lists[\s\S]{0,80}for update/)
  })

  it('computes age against the list door_date and not now()', () => {
    expect(current).toMatch(/age\(v_list\.door_date, p_dob\)/)
  })

  it('rate-limits on ip_hash inside the lock', () => {
    expect(current).toMatch(/where ip_hash = p_ip_hash/)
    expect(current).toMatch(/v_recent >= 5/)
  })
})

describe('privilege and isolation', () => {
  it('pins search_path on every security definer function', () => {
    // Without this, anything that can create a schema on the search path can shadow a
    // table name and have it run with the definer's rights.
    const definers = current.match(/security definer[\s\S]{0,120}/g) ?? []
    expect(definers.length).toBeGreaterThan(0)
    for (const block of definers) expect(block).toMatch(/set search_path = public, pg_temp/)
  })

  it('revokes execute from anon and authenticated, granting only service_role', () => {
    for (const fn of ['claim_signup', 'list_status']) {
      const revoke = new RegExp(`revoke all on function public\\.${fn}[\\s\\S]*?from public, anon, authenticated`)
      const grant = new RegExp(`grant execute on function public\\.${fn}[\\s\\S]*?to service_role`)
      expect(current).toMatch(revoke)
      expect(current).toMatch(grant)
    }
  })

  it('leaves row level security on for both tables', () => {
    expect(current).toMatch(/alter table public\.submissions\s+enable row level security/)
    expect(current).toMatch(/alter table public\.ticket_lists enable row level security/)
  })

  it('reloads the PostgREST schema cache, or the new function still 404s', () => {
    expect(current).toMatch(/notify pgrst, 'reload schema'/)
  })

  it('drops no table, column or row', () => {
    for (const [name, raw] of sqlByFile) {
      const sql = stripComments(raw)
      expect(sql, name).not.toMatch(/drop\s+table/i)
      expect(sql, name).not.toMatch(/drop\s+column/i)
      expect(sql, name).not.toMatch(/\bdelete\s+from\b/i)
      expect(sql, name).not.toMatch(/\btruncate\b/i)
    }
  })
})

describe('seeded lists', () => {
  it('uses one door date, matching the one the client config mirrors', () => {
    const seed = sqlByFile.get('0001_presale.sql')!
    const doorDates = new Set(
      [...seed.matchAll(/'(\d{4}-\d{2}-\d{2})',\s+\d+, (?:true|false)\)/g)].map((m) => m[1]),
    )
    expect([...doorDates]).toEqual(['2026-09-20'])
  })

  it('writes every timestamp with an explicit offset', () => {
    // A bare '2026-08-10T00:00:00' is parsed as LOCAL time by JS, so a visitor in
    // Toronto would see the list open three hours early and disagree with the server.
    //
    // Comments are stripped first: 0001 quotes exactly that bad example while
    // explaining why not to write it, and a guard that fires on its own documentation
    // is a guard people delete.
    const seed = stripComments(sqlByFile.get('0001_presale.sql')!)
    const timestamps = seed.match(/'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^']*'/g) ?? []
    expect(timestamps.length).toBeGreaterThan(0)
    for (const ts of timestamps) expect(ts).toMatch(/[+-]\d{2}:\d{2}'$/)
  })
})
