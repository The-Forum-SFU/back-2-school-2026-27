import { requireEnv } from './env.js'

/**
 * Minimal PostgREST client.
 *
 * Deliberately not @supabase/supabase-js: we make exactly two RPC calls and one
 * best-effort UPDATE, and never touch auth, realtime, storage, or the query builder.
 * That's ~30 lines here against a ~200KB dependency and its cold-start cost on every
 * invocation.
 */

function headers(): Record<string, string> {
  const key = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}

/**
 * Normalises SUPABASE_URL down to a bare origin.
 *
 * Two paste mistakes this absorbs, both of which produce baffling errors otherwise:
 *   - the dashboard's REST URL, which already ends in /rest/v1 — appending our own
 *     path yields `/rest/v1//rest/v1/rpc/...` and a PGRST125 "invalid path"
 *   - stray quote characters, which dotenv leaves behind when a value is quoted
 *     unevenly — those end up *inside* the URL and fail far from the cause
 */
function baseUrl(): string {
  return requireEnv('SUPABASE_URL')
    .trim()
    .replace(/["'`]/g, '')
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
}

/** Calls a Postgres function. Named args map straight onto the JSON body. */
export async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const url = `${baseUrl()}/rest/v1/rpc/${fn}`
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(8000),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Supabase RPC ${fn} failed: ${res.status} ${text}`)
  }
  return JSON.parse(text) as T
}

/**
 * Best-effort column write, used to record downstream sync state after the row is
 * already committed. Never throws — a failure here means `brevo_synced` stays false,
 * which is exactly the backfill queue we want, not a reason to fail the response.
 */
export async function patchSubmission(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  try {
    const url = `${baseUrl()}/rest/v1/submissions?id=eq.${encodeURIComponent(id)}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { ...headers(), Prefer: 'return=minimal' },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[supabase] sync-state patch failed: HTTP ${res.status} ${text}`)
    }
  } catch (err) {
    console.error('[supabase] sync-state patch failed (non-fatal):', String(err))
  }
}
