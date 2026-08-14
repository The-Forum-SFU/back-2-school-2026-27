/**
 * Env access for the serverless handlers.
 *
 * Files under `_` are not routed by Vercel, so everything in `api/_lib` stays private.
 *
 * Two tiers on purpose:
 *   requireEnv  — the signup path cannot work without it; fail loudly, naming the var.
 *   optionalEnv — an integration that must degrade to a no-op rather than take the
 *                 user's submission down with it.
 *
 * Vercel dashboard vars are separate from .env; a missing Supabase var in production
 * is a 500 on every submit, which is exactly why requireEnv names the variable.
 */

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Set it in .env for local dev and in the Vercel dashboard for deploys.`,
    )
  }
  return value
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value && value.length > 0 ? value : undefined
}
