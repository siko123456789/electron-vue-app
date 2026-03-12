import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { pinia } from '@/stores'

const SETTINGS_API_BASE_KEY = 'apiBase'

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

function toQuery(params?: Record<string, any>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value)) value.forEach((v) => search.append(key, String(v)))
    else search.append(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

function normalizeResponseData(data: any) {
  if (data && typeof data === 'object' && 'code' in data) {
    const code = (data as any).code
    if (code === 200 || code === 0) return data

    const message = (data as any).message || (data as any).msg
    console.error('响应错误:', message)
    throw new Error(message || '请求失败')
  }

  return data
}

function handleUnauthorized() {
  try {
    const authStore = useAuthStore(pinia)
    authStore.clearAuth()
  } catch {
    // ignore
  }
  if (location.hash !== '#/login') location.hash = '#/login'
}

async function requestViaIpc(method: string, url: string, params?: any, data?: any) {
  const ipc = (globalThis as any)?.ipcRenderer
  if (!ipc?.invoke) {
    throw new Error('当前环境无法通过主进程代理请求（浏览器环境会被 CORS 拦截，请在 Electron 中运行）')
  }

  const base = getRuntimeBaseURL()
  const fullUrl = joinUrl(base, url) + (method === 'GET' || method === 'DELETE' ? toQuery(params) : '')

  const token = localStorage.getItem('token')
  const headers: Record<string, string> = {
    'Content-Type': 'application/json;charset=utf-8',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const body = method === 'GET' || method === 'DELETE' ? null : (data !== undefined ? JSON.stringify(data) : null)

  const res = await ipc.invoke('http-request', { method, url: fullUrl, headers, body })
  const status = Number(res?.status || 0)

  let parsed: any = res?.data
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed)
    } catch {
      // keep text
    }
  }

  if (status === 401) {
    handleUnauthorized()
    throw new Error('未授权，请重新登录')
  }
  if (status >= 400) {
    throw new Error(`请求失败: ${status}`)
  }

  return normalizeResponseData(parsed)
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
    // 从本地存储中获取 token
    const token = localStorage.getItem('token')
    // 如果有 token，添加到请求头
    if (token) {
      ;(config.headers as any).Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse) => {
    return normalizeResponseData(response.data)
  },
  (error) => {
    console.error('响应错误:', error)
    // 处理网络错误、超时等情况
    if (error.response) {
      // 服务器返回错误状态码
      switch (error.response.status) {
        case 401:
          // 未授权，可能需要重新登录
          console.error('未授权，请重新登录')
          handleUnauthorized()
          break
        case 403:
          console.error('拒绝访问')
          break
        case 404:
          console.error('请求地址不存在')
          break
        case 500:
          console.error('服务器内部错误')
          break
        default:
          console.error(`请求失败: ${error.response.status}`)
      }
    } else if (error.request) {
      // 请求已发出，但没有收到响应
      console.error('网络错误，未收到响应')
    } else {
      // 请求配置出错
      console.error('请求配置错误:', error.message)
    }
    return Promise.reject(error)
  }
)

// 导出常用的请求方法
export default {
  get: (url: string, params?: any) => {
    const base = getRuntimeBaseURL()
    if (isAbsoluteUrl(base)) return requestViaIpc('GET', url, params)
    return service.get(url, { params })
  },
  post: (url: string, data?: any) => {
    const base = getRuntimeBaseURL()
    if (isAbsoluteUrl(base)) return requestViaIpc('POST', url, undefined, data)
    return service.post(url, data)
  },
  put: (url: string, data?: any) => {
    const base = getRuntimeBaseURL()
    if (isAbsoluteUrl(base)) return requestViaIpc('PUT', url, undefined, data)
    return service.put(url, data)
  },
  delete: (url: string, params?: any) => {
    const base = getRuntimeBaseURL()
    if (isAbsoluteUrl(base)) return requestViaIpc('DELETE', url, params)
    return service.delete(url, { params })
  }
}
