type LogMeta = Record<string, unknown>

function fallback(level: string, message: string, meta?: LogMeta): void {
  const fn = level === 'ERROR' ? console.error : level === 'WARN' ? console.warn : console.log
  fn(`[${level}]`, message, meta ?? '')
}

/**
 * 渲染进程日志封装
 * 通过 IPC 转发到主进程写入本地文件，非 Electron 环境回退到 console
 */
export const logger = {
  debug(message: string, meta?: LogMeta): void {
    if (window.logger) void window.logger.debug(message, meta)
    else fallback('DEBUG', message, meta)
  },
  info(message: string, meta?: LogMeta): void {
    if (window.logger) void window.logger.info(message, meta)
    else fallback('INFO', message, meta)
  },
  warn(message: string, meta?: LogMeta): void {
    if (window.logger) void window.logger.warn(message, meta)
    else fallback('WARN', message, meta)
  },
  error(message: string, meta?: LogMeta): void {
    if (window.logger) void window.logger.error(message, meta)
    else fallback('ERROR', message, meta)
  },
}
