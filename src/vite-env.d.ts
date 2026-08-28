/// <reference types="vite/client" />

declare module 'vue-router'

interface Window {
  logger?: {
    debug: (message: string, meta?: Record<string, unknown>) => Promise<void>
    info: (message: string, meta?: Record<string, unknown>) => Promise<void>
    warn: (message: string, meta?: Record<string, unknown>) => Promise<void>
    error: (message: string, meta?: Record<string, unknown>) => Promise<void>
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
