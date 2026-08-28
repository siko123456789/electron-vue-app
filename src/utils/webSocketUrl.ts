/**
 * 统一生成 WebSocket 地址。
 *
 * 开发环境 apiBase 为空时使用 Vite 当前页面地址；Electron 打包后页面
 * 是 file://，此时必须使用登录页保存的绝对 API 地址。
 */
const SETTINGS_API_BASE_KEY = 'apiBase'

function getApiBase() {
  return (localStorage.getItem(SETTINGS_API_BASE_KEY) || '').trim().replace(/\/+$/, '')
}

function getToken() {
  return (localStorage.getItem('token') || '').trim().replace(/^Bearer\s+/i, '')
}

export function buildWebSocketUrl(path: string, includeToken = true) {
  const base = getApiBase()
  let url: URL

  if (/^https?:\/\//i.test(base)) {
    const apiBase = /\/api$/i.test(base) ? base : `${base}/api`
    url = new URL(`${apiBase}/${String(path || '').replace(/^\/+/, '')}`)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  } else {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host || 'localhost:5173'
    const prefix = base && base.startsWith('/') ? base : '/api'
    url = new URL(`${protocol}//${host}${prefix}/${String(path || '').replace(/^\/+/, '')}`)
  }

  if (includeToken) {
    const token = getToken()
    if (token) url.searchParams.set('token', token)
  }

  return url.toString()
}
