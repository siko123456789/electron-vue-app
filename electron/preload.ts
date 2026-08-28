import { ipcRenderer, contextBridge } from 'electron'

type LogMeta = Record<string, unknown>

function writeLog(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, meta?: LogMeta) {
  return ipcRenderer.invoke('app/log', { level, message, meta })
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('logger', {
  debug: (message: string, meta?: LogMeta) => writeLog('DEBUG', message, meta),
  info: (message: string, meta?: LogMeta) => writeLog('INFO', message, meta),
  warn: (message: string, meta?: LogMeta) => writeLog('WARN', message, meta),
  error: (message: string, meta?: LogMeta) => writeLog('ERROR', message, meta),
})

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
  
})