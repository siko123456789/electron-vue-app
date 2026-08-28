import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { App } from 'electron'

/** 日志级别：DEBUG 仅开发环境写入，INFO/WARN/ERROR 始终写入 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVEL_ORDER: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
}

export type LoggerOptions = {
  logDir: string
  /** 低于此级别的日志将被忽略 */
  minLevel?: LogLevel
  /** 是否同时输出到控制台 */
  enableConsole?: boolean
}

export type Logger = {
  debug: (message: string, meta?: Record<string, unknown>) => void
  info: (message: string, meta?: Record<string, unknown>) => void
  warn: (message: string, meta?: Record<string, unknown>) => void
  error: (message: string, meta?: Record<string, unknown>) => void
  log: (level: LogLevel, message: string, meta?: Record<string, unknown>) => void
  getLogDir: () => string
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatTimestamp(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function dailyLogFileName(): string {
  const now = new Date()
  return `app-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.log`
}

export function createLogger(options: LoggerOptions): Logger {
  const { logDir, minLevel = 'DEBUG', enableConsole = true } = options
  let writeChain: Promise<void> = Promise.resolve()
  let dirReady = false

  async function ensureDir(): Promise<void> {
    if (dirReady) return
    await fs.mkdir(logDir, { recursive: true })
    dirReady = true
  }

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel]
  }

  function formatLine(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : ''
    return `[${formatTimestamp()}] [${level}] ${message}${metaStr}\n`
  }

  function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(level)) return

    const line = formatLine(level, message, meta)

    if (enableConsole) {
      const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
      fn(line.trim())
    }

    const filePath = path.join(logDir, dailyLogFileName())
    writeChain = writeChain.then(async () => {
      try {
        await ensureDir()
        await fs.appendFile(filePath, line, 'utf8')
      } catch {
        // 写入失败不影响应用运行
      }
    })
  }

  return {
    debug: (message, meta) => log('DEBUG', message, meta),
    info: (message, meta) => log('INFO', message, meta),
    warn: (message, meta) => log('WARN', message, meta),
    error: (message, meta) => log('ERROR', message, meta),
    log,
    getLogDir: () => logDir,
  }
}

/** 创建应用日志实例，日志目录：{userData}/logs/ */
export function createAppLogger(app: App): Logger {
  const logDir = path.join(app.getPath('userData'), 'logs')
  // 生产环境不写入 DEBUG，开发环境保留完整调试信息
  const minLevel: LogLevel = app.isPackaged ? 'INFO' : 'DEBUG'
  return createLogger({ logDir, minLevel })
}
