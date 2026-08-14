/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Same numeric id as the server's META_PIXEL_ID. Absent = pixel no-ops. */
  readonly VITE_META_PIXEL_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  fbq?: (...args: unknown[]) => void
  _fbq?: unknown
}
