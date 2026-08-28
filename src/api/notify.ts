import request from '@/utils/request'

export type NotifyApiResult<T> = {
  code: number
  msg?: string
  message?: string
  data: T
}

export type OemRecord = {
  duration?: number
  title?: string
  captcha?: boolean
  [key: string]: unknown
}

export type NotifyHeartbeatSummary = {
  all?: number
  p0?: number
  p1?: number
  p2?: number
  pending?: number
  handled?: number
  total?: number
  [key: string]: unknown
}

/** 获取 Redis Token 的无操作过期时间（分钟）。 */
export function fetchOemRecord() {
  return request.get('/settings/oem/GetSysOemRecord') as Promise<NotifyApiResult<OemRecord>>
}

/** 轻量登录态续期请求；空 body 表示使用后端默认时间范围。 */
export function refreshNotifySession() {
  return request.post('/notify/summary', {}) as Promise<NotifyApiResult<NotifyHeartbeatSummary>>
}
