import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Serves `/api/*` during `vite dev`, which otherwise knows nothing about the
 * Vercel functions in `/api`.
 *
 * Chosen over `vercel dev` so `npm run dev` keeps working with untouched HMR and
 * nobody needs a Vercel login to contribute. `vercel dev` is still the right
 * pre-deploy smoke check — this is a dev-loop convenience, not a fidelity claim.
 *
 * Handlers are resolved by *path string* through `ssrLoadModule`, never by a static
 * import. A static import would pull `/api/*.ts` into this file's tsconfig project
 * (tsconfig.node.json) and collide with tsconfig.api.json, which owns them. That is
 * also why the req/res shapes below are declared locally instead of imported from
 * `@vercel/node`.
 */

type DevReq = IncomingMessage & { body?: unknown; query: Record<string, string> }

type DevRes = ServerResponse & {
  status: (code: number) => DevRes
  json: (body: unknown) => void
  send: (body: string) => void
}

type DevHandler = (req: DevReq, res: DevRes) => unknown | Promise<unknown>

/** Vercel's res helpers, shimmed onto the bare Node ServerResponse. */
function decorate(res: ServerResponse): DevRes {
  const out = res as DevRes
  out.status = (code) => {
    out.statusCode = code
    return out
  }
  out.json = (body) => {
    out.setHeader('Content-Type', 'application/json')
    out.end(JSON.stringify(body))
  }
  out.send = (body) => out.end(body)
  return out
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

export function devApi(): Plugin {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        if (!url.pathname.startsWith('/api/')) return next()

        const name = url.pathname.slice('/api/'.length)
        // Keep path traversal out of ssrLoadModule.
        if (!/^[a-z0-9-]+$/i.test(name)) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        let handler: DevHandler
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          handler = (mod as { default: DevHandler }).default
          if (typeof handler !== 'function') throw new Error('no default export')
        } catch {
          // Explicit 404 rather than next(): falling through would serve index.html
          // and hand HTML to a fetch() that is expecting JSON, which is a genuinely
          // confusing way to discover a typo'd route.
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ status: 'error', message: `No API route /api/${name}` }))
          return
        }

        const decorated = decorate(res)
        const request = req as DevReq
        request.query = Object.fromEntries(url.searchParams)

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const raw = await readBody(req)
          try {
            request.body = raw ? JSON.parse(raw) : undefined
          } catch {
            // Leave body undefined and let the handler's own validation report it.
            request.body = undefined
          }
        }

        try {
          await handler(request, decorated)
        } catch (err) {
          server.config.logger.error(`[dev-api] /api/${name} threw:\n${String(err)}`)
          if (!res.writableEnded) {
            decorated.status(500).json({
              status: 'error',
              message: err instanceof Error ? err.stack ?? err.message : String(err),
            })
          }
        }
      })
    },
  }
}
