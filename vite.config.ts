import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { devApi } from './vite-api-plugin'

/**
 * Names that must never carry a VITE_ prefix. Anything VITE_-prefixed is inlined
 * verbatim into the client bundle, so a single typo here would publish the Supabase
 * service-role key to every visitor. Cheap to check, catastrophic to miss.
 */
const SECRETISH = /SERVICE_ROLE|SECRET|ACCESS_TOKEN|API_KEY|_SALT/

export default defineConfig(({ command, mode }) => {
  // Empty prefix = read every var, not just VITE_ ones.
  const env = loadEnv(mode, process.cwd(), '')

  for (const key of Object.keys(env)) {
    if (key.startsWith('VITE_') && SECRETISH.test(key)) {
      throw new Error(
        `Refusing to continue: ${key} is VITE_-prefixed and would be inlined into ` +
          `client JS. Drop the VITE_ prefix and read it from process.env in /api instead.`,
      )
    }
  }

  if (command === 'serve') {
    // Vite never populates process.env, so the dev API harness would see nothing.
    // This runs only in dev; on Vercel the real environment is already populated.
    // Note this goes nowhere near `define`, so it cannot reach the client bundle.
    Object.assign(process.env, env)
  }

  return {
    plugins: [react(), tailwindcss(), devApi()],
  }
})
