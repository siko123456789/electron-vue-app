import type { IpcMain, Session } from 'electron'
import { net } from 'electron'

/**
 * HTTP 代理（渲染进程 -> 主进程 -> net.request）
 *
 * 为什么需要它：
 * - Electron 渲染进程直接请求跨域容易被 CORS 拦截
 * - 主进程使用 net.request 不受 CORS 影响
 *
 * 输入：{ method, url, headers, body }
 * 输出：{ status, headers, data }
 */

export function registerHttpRequestIpc(ipcMain: IpcMain, session: Session) {
  ipcMain.handle('http-request', async (_event, options) => {
    const method = String(options?.method || 'GET').toUpperCase()
    const url = String(options?.url || '')
    const headers = (options?.headers && typeof options.headers === 'object') ? options.headers : {}
    const body = options?.body ?? null

    if (!url) throw new Error('Missing url')

    return await new Promise((resolve, reject) => {
      const request = net.request({ method, url, session })

      for (const [key, value] of Object.entries(headers)) {
        if (value === undefined || value === null) continue
        request.setHeader(key, String(value))
      }

      request.on('response', (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          resolve({
            status: response.statusCode,
            headers: response.headers,
            data: text,
          })
        })
      })

      request.on('error', (error) => reject(error))

      if (body !== null && body !== undefined) request.write(String(body))
      request.end()
    })
  })
}

