/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: import('electron').IpcRenderer
  logger: {
    debug: (message: string, meta?: Record<string, unknown>) => Promise<void>
    info: (message: string, meta?: Record<string, unknown>) => Promise<void>
    warn: (message: string, meta?: Record<string, unknown>) => Promise<void>
    error: (message: string, meta?: Record<string, unknown>) => Promise<void>
  }
}
