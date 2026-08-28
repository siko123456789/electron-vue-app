import { execSync } from 'node:child_process'

/**
 * Windows 控制台默认 GBK，Node/Electron 输出 UTF-8 中文会乱码。
 * 启动时将控制台代码页切换为 UTF-8（65001）。
 */
export function ensureWinConsoleUtf8(): void {
  if (process.platform !== 'win32') return
  try {
    execSync('chcp 65001', { stdio: 'ignore', windowsHide: true })
  } catch {
    // ignore
  }
}
