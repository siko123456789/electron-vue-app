/**
 * HTTP 请求工具模块
 * 封装了基于 axios 的 HTTP 请求功能，支持离线缓存和离线操作队列
 */
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'
import { logger } from '@/utils/logger'

// 存储 API 基础 URL 的 localStorage 键名
const SETTINGS_API_BASE_KEY = 'apiBase'
// API 缓存键前缀
const API_CACHE_PREFIX = 'api_cache_v1:'
// 存储所有缓存键的 localStorage 键名
const API_CACHE_KEYS = 'api_cache_v1:__keys'
// 最大缓存键数量
const API_CACHE_MAX_KEYS = 100

// 离线操作队列的 localStorage 键名
const OFFLINE_QUEUE_KEY = 'offline_ops_v1'

// Electron IPC mode: persist cookies from Set-Cookie and send them via Cookie header
// because renderer devtools can't inspect net.request headers/cookies easily.
const IPC_COOKIE_KEY = 'ipc_cookie_v1'
let authExpiredEventSent = false

/** 新一轮登录成功后允许再次广播登录失效事件。 */
export function resetAuthExpiredEvent() {
  authExpiredEventSent = false
}

/**
 * 离线操作类型定义
 * 用于在网络不可用时暂存操作，待网络恢复后执行
 */
type OfflineOp = {
  id: string      // 操作唯一标识
  ts: number      // 时间戳
  method: 'POST' | 'PUT' | 'DELETE' // HTTP 方法
  url: string     // 请求 URL
  params?: any    // URL 参数
  data?: any      // 请求体数据
}

function getRuntimeBaseURL(): string {
  const saved = (localStorage.getItem(SETTINGS_API_BASE_KEY) || '').trim()
  if (!saved) return '/api'
  return saved.replace(/\/+$/, '')
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function joinUrl(base: string, path: string): string {
  const b = (base || '').replace(/\/+$/, '')
  const p = (path || '').startsWith('/') ? path : `/${path || ''}`
  return `${b}${p}`
}

function sanitizeForLog(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(sanitizeForLog)
  // Vue 的 reactive/ref 嵌套数组是 Proxy，不能直接通过 Electron IPC structured clone。
  // 这里递归展开所有层级，确保日志元数据只包含普通对象、数组和基础类型。
  const copy: Record<string, unknown> = {}
  Object.entries(data as Record<string, unknown>).forEach(([key, value]) => {
    copy[key] = sanitizeForLog(value)
  })
  for (const key of ['password', 'pwd', 'token', 'authorization', 'Authorization']) {
    if (key in copy) copy[key] = '***'
  }
  return copy
}

function logResolvedRequest(info: {
  source: string
  method: string
  url: string
  baseURL?: string
  params?: any
  data?: any
  config?: any
}) {
  logger.debug('HTTP 请求', {
    source: info.source,
    method: info.method,
    url: info.url,
    baseURL: info.baseURL || undefined,
    params: info.params !== undefined ? sanitizeForLog(info.params) : undefined,
    data: info.data !== undefined ? sanitizeForLog(info.data) : undefined,
  })
}

function applyAuthHeaders(headers: Record<string, any>, token: string | null) {
  const raw = String(token || '').trim()
  if (!raw) return
  const bare = raw.replace(/^Bearer\s+/i, '').trim()
  headers.Authorization = /^Bearer\s+/i.test(raw) ? raw : `Bearer ${raw}`
  headers.token = bare
  headers['X-Token'] = bare
}

function extractTokenFromHeaders(headers: any): string {
  if (!headers || typeof headers !== 'object') return ''

  const pick = (key: string) => {
    const v = (headers as any)[key]
    if (Array.isArray(v)) return String(v[0] || '').trim()
    return String(v || '').trim()
  }

  const directCandidates = [
    pick('authorization'),
    pick('Authorization'),
    pick('token'),
    pick('Token'),
    pick('x-token'),
    pick('X-Token'),
    pick('x-auth-token'),
    pick('X-Auth-Token'),
    pick('access-token'),
    pick('Access-Token'),
    pick('x-access-token'),
    pick('X-Access-Token'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)

  const direct = (directCandidates[0] || '').replace(/^Bearer\s+/i, '').trim()
  if (direct) return direct

  // Try to parse token from Set-Cookie (best-effort; works when backend stores token in a readable cookie).
  const rawSetCookie = (headers as any)['set-cookie'] ?? (headers as any)['Set-Cookie']
  const cookies: string[] = Array.isArray(rawSetCookie)
    ? rawSetCookie.map((c: any) => String(c || ''))
    : String(rawSetCookie || '')
        .split(/,(?=[^;]+=[^;]+)/g)
        .map((c) => c.trim())
        .filter(Boolean)

  const names = ['token', 'access_token', 'accessToken', 'auth_token', 'authorization', 'jwt']
  for (const cookie of cookies) {
    const first = String(cookie || '').split(';')[0] || ''
    const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (!value) continue
    if (names.some((n) => n.toLowerCase() === name.toLowerCase())) return value
  }

  return ''
}

function extractCookieHeaderFromHeaders(headers: any): string {
  if (!headers || typeof headers !== 'object') return ''
  const raw = (headers as any)['set-cookie'] ?? (headers as any)['Set-Cookie']
  const setCookies: string[] = Array.isArray(raw)
    ? raw.map((c: any) => String(c || ''))
    : String(raw || '')
        .split(/,(?=[^;]+=[^;]+)/g)
        .map((c) => c.trim())
        .filter(Boolean)

  if (!setCookies.length) return ''

  // Keep the latest value per cookie name.
  const jar = new Map<string, string>()
  for (const cookie of setCookies) {
    const first = String(cookie || '').split(';')[0] || ''
    const eq = first.indexOf('=')
    if (eq <= 0) continue
    const name = first.slice(0, eq).trim()
    const value = first.slice(eq + 1).trim()
    if (!name || !value) continue
    jar.set(name, value)
  }

  const parts: string[] = []
  for (const [name, value] of jar.entries()) parts.push(`${name}=${value}`)
  return parts.join('; ')
}

function getStoredIpcCookie(): string {
  try {
    return (localStorage.getItem(IPC_COOKIE_KEY) || '').trim()
  } catch {
    return ''
  }
}

function storeIpcCookie(nextCookieHeader: string) {
  const next = String(nextCookieHeader || '').trim()
  if (!next) return
  try {
    localStorage.setItem(IPC_COOKIE_KEY, next)
  } catch {
    // ignore
  }
}

function toQuery(params?: Record<string, any>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  const entries = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  for (const [key, value] of entries) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

/**
 * 生成缓存键
 * @param method HTTP 方法
 * @param fullUrl 完整 URL
 */
function getCacheKey(method: string, fullUrl: string) {
  return `${API_CACHE_PREFIX}${method.toUpperCase()}:${fullUrl}`
}

/**
 * 加载缓存键列表
 */
function loadCacheKeys(): string[] {
  try {
    const raw = localStorage.getItem(API_CACHE_KEYS)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : []
  } catch {
    return []
  }
}

/**
 * 保存缓存键列表
 * @param keys 缓存键数组
 */
function saveCacheKeys(keys: string[]) {
  try {
    localStorage.setItem(API_CACHE_KEYS, JSON.stringify(keys))
  } catch {
    // ignore
  }
}

/**
 * 设置缓存
 * @param method HTTP 方法
 * @param fullUrl 完整 URL
 * @param data 缓存数据
 */
function cacheSet(method: string, fullUrl: string, data: any) {
  const key = getCacheKey(method, fullUrl)
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }))
    const keys = loadCacheKeys()
    const next = [key, ...keys.filter((k) => k !== key)]
    // 限制缓存数量，超出则删除旧的缓存
    if (next.length > API_CACHE_MAX_KEYS) {
      const toDrop = next.slice(API_CACHE_MAX_KEYS)
      toDrop.forEach((k) => localStorage.removeItem(k))
      saveCacheKeys(next.slice(0, API_CACHE_MAX_KEYS))
    } else {
      saveCacheKeys(next)
    }
  } catch {
    // ignore quota/errors
  }
}

/**
 * 获取缓存
 * @param method HTTP 方法
 * @param fullUrl 完整 URL
 * @returns 缓存数据，不存在则返回 null
 */
function cacheGet(method: string, fullUrl: string) {
  const key = getCacheKey(method, fullUrl)
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return (parsed as any).data ?? null
  } catch {
    return null
  }
}

/**
 * 加载离线操作队列
 */
function loadOfflineQueue(): OfflineOp[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * 保存离线操作队列
 * @param items 离线操作数组
 */
function saveOfflineQueue(items: OfflineOp[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items))
  } catch {
    // ignore
  }
}

/**
 * 将操作加入离线队列
 * @param op 操作对象（不包含 id 和 ts）
 */
function enqueueOfflineOp(op: Omit<OfflineOp, 'id' | 'ts'>) {
  const items = loadOfflineQueue()
  items.unshift({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    ts: Date.now(),
    ...op,
  })
  saveOfflineQueue(items.slice(0, 200))
}

/**
 * 刷新离线操作队列
 * 当网络恢复时，将队列中的操作重新发送
 */
export async function flushOfflineQueue() {
  if (!navigator.onLine) return { flushed: 0, remaining: loadOfflineQueue().length }
  const items = loadOfflineQueue()
  if (!items.length) return { flushed: 0, remaining: 0 }

  const base = getRuntimeBaseURL()
  const useIpc = isAbsoluteUrl(base) && !!(globalThis as any)?.ipcRenderer?.invoke

  let flushed = 0
  const remaining: OfflineOp[] = []
  for (const op of items.reverse()) {
    try {
      if (useIpc) {
        if (op.method === 'POST') await requestViaIpc('POST', op.url, undefined, op.data)
        else if (op.method === 'PUT') await requestViaIpc('PUT', op.url, undefined, op.data)
        else if (op.method === 'DELETE') await requestViaIpc('DELETE', op.url, op.params, undefined)
      } else {
        if (op.method === 'POST') await service.post(op.url, op.data)
        else if (op.method === 'PUT') await service.put(op.url, op.data)
        else if (op.method === 'DELETE') await service.delete(op.url, { params: op.params })
      }
      flushed++
    } catch {
      remaining.unshift(op)
    }
  }

  saveOfflineQueue(remaining)
  return { flushed, remaining: remaining.length }
}

export function clearOfflineQueue() {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY)
  } catch {
    // ignore
  }
}

export function clearApiCache() {
  try {
    const keys = loadCacheKeys()
    keys.forEach((k) => localStorage.removeItem(k))
    localStorage.removeItem(API_CACHE_KEYS)
  } catch {
    // ignore
  }
}

/** 当前本地 API 缓存条目数 */
export function getApiCacheCount() {
  try {
    return loadCacheKeys().length
  } catch {
    return 0
  }
}

/**
 * 按保留天数清理过期 API 缓存（条目带 ts）
 * @returns 删除条数
 */
export function purgeExpiredApiCache(retentionDays: number) {
  const days = Number(retentionDays)
  if (!Number.isFinite(days) || days <= 0) return 0
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
  let removed = 0
  try {
    const keys = loadCacheKeys()
    const keep: string[] = []
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) {
          removed += 1
          continue
        }
        const parsed = JSON.parse(raw) as { ts?: number }
        const ts = Number(parsed?.ts)
        if (!Number.isFinite(ts) || ts < cutoff) {
          localStorage.removeItem(key)
          removed += 1
        } else {
          keep.push(key)
        }
      } catch {
        localStorage.removeItem(key)
        removed += 1
      }
    }
    saveCacheKeys(keep)
  } catch {
    // ignore
  }
  return removed
}

/**
 * 规范化响应数据
 * 根据后端返回的 code 字段判断请求是否成功
 * @param data 响应数据
 * @returns 处理后的数据
 */
function normalizeResponseData(data: any, options: { throwOnError?: boolean } = {}) {
  if (data && typeof data === 'object' && 'code' in data) {
    const code = (data as any).code
    // 如果 code 为 200 或 0，认为请求成功
    if (code === 200 || code === 0) return data

    const message = (data as any).message || (data as any).msg
    // 后端可能返回 HTTP 200，但用业务码 1004 表示登录态已失效。
    // 登录接口自身的失败响应不触发跳转，避免在登录页形成无意义的处理。
    if (Number(code) === 1004 && options.throwOnError !== false) {
      logger.warn('登录态已失效，需要重新登录', { code, message })
      handleUnauthorized()
    }
    logger.error('接口响应错误', { code, message })
    if (options.throwOnError === false) return data
    // Preserve the complete backend response. Login failures may include
    // fail_count, max_fail_count and remain_to_lock in data.
    const error = new Error(message || '请求失败') as Error & {
      code?: unknown
      responseData?: any
    }
    error.code = code
    error.responseData = data
    logger.error('接口响应错误详情', { code, message, data: sanitizeForLog(data) })
    throw error
  }

  return data
}

/**
 * 处理未授权情况
 * 清除认证信息并跳转到登录页面
 */
function handleUnauthorized() {
  try {
    const authStore = useAuthStore(pinia)
    authStore.clearAuth()
  } catch {
    // ignore
  }

  // IPC 请求会显式携带这个 Cookie；Token 失效时必须一起清掉，
  // 否则重新打开登录页后仍可能继续使用旧 session。
  try {
    localStorage.removeItem(IPC_COOKIE_KEY)
  } catch {
    // ignore
  }

  if (!authExpiredEventSent) {
    authExpiredEventSent = true
    try {
      window.dispatchEvent(new Event('app-auth-expired'))
    } catch {
      // ignore
    }
  }

  // Avoid redirect loop when we're already on the login page (hash router).
  const hash = String(location.hash || '')
  const isLoginPage = hash.includes('/login')
  if (!isLoginPage) location.hash = '#/login'
}

/**
 * 通过 IPC 通道发起 HTTP 请求
 * 在 Electron 环境下绕过 CORS 限制
 * @param method HTTP 方法
 * @param url 请求 URL
 * @param params URL 参数
 * @param data 请求体数据
 * @returns 响应数据
 */
async function requestViaIpc(
  method: string,
  url: string,
  params?: any,
  data?: any,
  extraHeaders?: Record<string, any>,
  requestOptions?: { signal?: AbortSignal }
) {
  const ipc = (globalThis as any)?.ipcRenderer
  if (!ipc?.invoke) {
    throw new Error('当前环境无法通过主进程代理请求（浏览器环境会被 CORS 拦截，请在 Electron 中运行）')
  }

  const base = getRuntimeBaseURL()
  const fullUrl = joinUrl(base, url) + (method === 'GET' || method === 'DELETE' ? toQuery(params) : '')
  logResolvedRequest({
    source: 'requestViaIpc',
    method,
    url: fullUrl,
    baseURL: base,
    params,
    data,
    config: { url, base, mode: 'ipc' }
  })

  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=utf-8',
  }
  if (extraHeaders && typeof extraHeaders === 'object') {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      headers[key] = String(value)
    })
  }
  applyAuthHeaders(headers, token)
  const storedCookie = getStoredIpcCookie()
  if (storedCookie) headers.Cookie = storedCookie

  const body = method === 'GET' || method === 'DELETE' ? null : (data !== undefined ? JSON.stringify(data) : null)
  try {
    const invokePromise = ipc.invoke('http-request', { method, url: fullUrl, headers, body })
    const signal = requestOptions?.signal
    if (signal?.aborted) throw new DOMException('The operation was aborted', 'AbortError')
    const res = signal
      ? await Promise.race([
          invokePromise,
          new Promise<never>((_, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new DOMException('The operation was aborted', 'AbortError')),
              { once: true },
            )
          }),
        ])
      : await invokePromise
    const status = Number(res?.status || 0)
    const resHeaders = res?.headers

    let parsed: any = res?.data
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed)
      } catch {
        // 保持原始文本
      }
    }

    // Persist cookies from Set-Cookie so subsequent IPC requests can send Cookie header explicitly.
    const cookieHeader = extractCookieHeaderFromHeaders(resHeaders)
    if (cookieHeader) storeIpcCookie(cookieHeader)

    // Many backends do not include token in response body; they send it in headers/cookies.
    if (String(url || '').includes('/user/login')) {
      const headerToken = extractTokenFromHeaders(resHeaders)
      if (headerToken) {
        try { localStorage.setItem('token', headerToken) } catch {}
        if (parsed && typeof parsed === 'object') {
          if (parsed.data && typeof parsed.data === 'object' && !(parsed.data as any).token) (parsed.data as any).token = headerToken
          else if (!(parsed as any).token) (parsed as any).token = headerToken
        }
      }
      logger.debug('登录接口响应', { status, code: parsed?.code, hasToken: Boolean(headerToken || parsed?.data?.token) })
    }

    if (status === 401) {
      logger.warn('未授权，需要重新登录', { url: fullUrl, status })
      handleUnauthorized()
      throw new Error('未授权，请重新登录')
    }
    if (status >= 400) {
      logger.error('HTTP 请求失败', { method, url: fullUrl, status })
      throw new Error(`请求失败: ${status}`)
    }

    const normalized = normalizeResponseData(parsed, {
      throwOnError: !String(url || '').includes('/user/login')
    })
    logger.debug('HTTP 响应', { method, url: fullUrl, status, data: sanitizeForLog(normalized) })
    if (method === 'GET') cacheSet('GET', fullUrl, normalized)
    return normalized
  } catch (err: any) {
    const msg = String(err?.message || '')
    const isAuthError = msg.includes('未授权') || msg.includes('登录') || msg.includes('token')
    if (method === 'GET' && !isAuthError) {
      const cached = cacheGet('GET', fullUrl)
      if (cached !== null) {
        logger.warn('离线/网络异常，已返回缓存数据', { url: fullUrl })
        return cached
      }
    }
    if (!isAuthError) {
      logger.error('HTTP 请求异常', { method, url: fullUrl, error: msg })
    }
    throw err
  }
}

// 创建 axios 实例
const service: AxiosInstance = axios.create({
  baseURL: '/api', // 默认走 Vite proxy；运行时可被拦截器覆盖
  timeout: 60000, // 请求超时时间
  headers: {
    'Content-Type': 'application/json;charset=utf-8'
  }
})

// 请求拦截器
service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    config.baseURL = getRuntimeBaseURL()
    const resolvedUrl = joinUrl(String(config.baseURL || ''), String(config.url || '')) + toQuery((config as any)?.params)
    logResolvedRequest({
      source: 'axios-interceptor',
      method: String(config.method || 'GET').toUpperCase(),
      url: resolvedUrl,
      baseURL: String(config.baseURL || ''),
      params: (config as any)?.params,
      data: (config as any)?.data,
      config
    })
    // 从本地存储中获取 token
    const token = localStorage.getItem('token')
    // 如果有 token，添加到请求头
    applyAuthHeaders(config.headers as any, token)

    // IPC cookie is only meaningful for the Electron net.request path; harmless for same-origin,
    // but browsers will typically ignore/override Cookie anyway.
    const storedCookie = getStoredIpcCookie()
    if (storedCookie) (config.headers as any).Cookie = storedCookie
    return config
  },
  (error) => {
    logger.error('请求拦截器错误', { error: String(error?.message || error) })
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    // Many backends do not include token in response body; they send it in headers/cookies.
    try {
      const url = String(response.config?.url || '')
      if (url.includes('/user/login')) {
        const headerToken = extractTokenFromHeaders(response.headers)
        if (headerToken) {
          try { localStorage.setItem('token', headerToken) } catch {}
          if (response.data && typeof response.data === 'object') {
            if ((response.data as any).data && typeof (response.data as any).data === 'object' && !(response.data as any).data.token) {
              ;(response.data as any).data.token = headerToken
            } else if (!(response.data as any).token) {
              ;(response.data as any).token = headerToken
            }
          }
        }
      }
    } catch {
      // ignore
    }

    const normalized = normalizeResponseData(response.data, {
      throwOnError: !String(response.config?.url || '').includes('/user/login')
    })
    const method = String(response.config?.method || 'GET').toUpperCase()
    const base = String(response.config?.baseURL || getRuntimeBaseURL())
    const url = String(response.config?.url || '')
    const fullUrl = joinUrl(base, url) + toQuery((response.config as any)?.params)
    logger.debug('HTTP 响应', { method, url: fullUrl, status: response.status, data: sanitizeForLog(normalized) })
    if (method === 'GET') {
      cacheSet('GET', fullUrl, normalized)
    }
    return normalized
  },
  (error) => {
    const method = String(error.config?.method || 'GET').toUpperCase()
    const base = String(error.config?.baseURL || getRuntimeBaseURL())
    const url = String(error.config?.url || '')
    const fullUrl = joinUrl(base, url) + toQuery((error.config as any)?.params)

    if (error.response) {
      const status = error.response.status
      switch (status) {
        case 401:
          logger.warn('未授权，需要重新登录', { url: fullUrl, status })
          handleUnauthorized()
          break
        case 403:
          logger.error('拒绝访问', { url: fullUrl, status })
          break
        case 404:
          logger.error('请求地址不存在', { url: fullUrl, status })
          break
        case 500:
          logger.error('服务器内部错误', { url: fullUrl, status })
          break
        default:
          logger.error('HTTP 请求失败', { method, url: fullUrl, status })
      }
    } else if (error.request) {
      logger.error('网络错误，未收到响应', { method, url: fullUrl })
      if (method === 'GET') {
        const cached = cacheGet('GET', fullUrl)
        if (cached !== null) {
          logger.warn('离线/网络异常，已返回缓存数据', { url: fullUrl })
          return Promise.resolve(cached)
        }
      }
    } else {
      logger.error('请求配置错误', { error: String(error.message || error) })
    }
    return Promise.reject(error)
  }
)

/**
 * 导出常用的请求方法
 * 根据运行环境选择不同的请求方式，并支持离线操作
 */
type RequestConfigLike = {
  url: string
  method?: string
  params?: any
  data?: any
  headers?: Record<string, any>
  responseType?: any
  signal?: AbortSignal
}

type RequestOptions = {
  signal?: AbortSignal
}

const request = {
  /**
   * GET 请求
   * @param url 请求 URL
   * @param params URL 参数
   */
  get: (url: string, params?: any, headers?: Record<string, any>, options?: RequestOptions) => {
    const base = getRuntimeBaseURL()
    // 如果是绝对 URL，则使用 IPC 通道请求
    if (isAbsoluteUrl(base)) return requestViaIpc('GET', url, params, undefined, headers, options)
    return service.get(url, { params, headers, signal: options?.signal })
  },
  /**
   * POST 请求
   * @param url 请求 URL
   * @param data 请求体数据
   */
  post: (url: string, data?: any, headers?: Record<string, any>, options?: RequestOptions) => {
    const base = getRuntimeBaseURL()
    // 检查网络状态，如果离线则将操作加入队列
    if (!navigator.onLine) {
      enqueueOfflineOp({ method: 'POST', url, data })
      return Promise.reject(new Error('当前离线：操作已缓存，联网后将尝试自动同步'))
    }
    // 如果是绝对 URL，则使用 IPC 通道请求
    if (isAbsoluteUrl(base)) return requestViaIpc('POST', url, undefined, data, headers, options)
    return service.post(url, data, { headers, signal: options?.signal })
  },
  /**
   * PUT 请求
   * @param url 请求 URL
   * @param data 请求体数据
   */
  put: (url: string, data?: any, headers?: Record<string, any>) => {
    const base = getRuntimeBaseURL()
    // 检查网络状态，如果离线则将操作加入队列
    if (!navigator.onLine) {
      enqueueOfflineOp({ method: 'PUT', url, data })
      return Promise.reject(new Error('当前离线：操作已缓存，联网后将尝试自动同步'))
    }
    // 如果是绝对 URL，则使用 IPC 通道请求
    if (isAbsoluteUrl(base)) return requestViaIpc('PUT', url, undefined, data, headers)
    return service.put(url, data, { headers })
  },
  /**
   * DELETE 请求
   * @param url 请求 URL
   * @param params URL 参数
   */
  delete: (url: string, params?: any, headers?: Record<string, any>) => {
    const base = getRuntimeBaseURL()
    // 检查网络状态，如果离线则将操作加入队列
    if (!navigator.onLine) {
      enqueueOfflineOp({ method: 'DELETE', url, params })
      return Promise.reject(new Error('当前离线：操作已缓存，联网后将尝试自动同步'))
    }
    // 如果是绝对 URL，则使用 IPC 通道请求
    if (isAbsoluteUrl(base)) return requestViaIpc('DELETE', url, params, undefined, headers)
    return service.delete(url, { params, headers })
  }
}

const requestCompat = Object.assign(
  (config: RequestConfigLike) => {
    const safeConfig = config || ({} as RequestConfigLike)
    const method = String(safeConfig.method || 'get').toLowerCase()
    const base = getRuntimeBaseURL()
    if (isAbsoluteUrl(base)) {
      if (method === 'get') return request.get(safeConfig.url, safeConfig.params, safeConfig.headers, safeConfig)
      if (method === 'post') return request.post(safeConfig.url, safeConfig.data, safeConfig.headers, safeConfig)
      if (method === 'put') return request.put(safeConfig.url, safeConfig.data, safeConfig.headers)
      if (method === 'delete') return request.delete(safeConfig.url, safeConfig.params, safeConfig.headers)
      return Promise.reject(new Error(`暂不支持的请求方法: ${method}`))
    }
    return service.request({
      url: safeConfig.url,
      method,
      params: safeConfig.params,
      data: safeConfig.data,
      headers: safeConfig.headers,
      responseType: safeConfig.responseType
    })
  },
  request
)

export default requestCompat
