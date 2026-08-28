/** 设置相关接口 */
import request from '@/utils/request'

export type ApiResult<T> = {
  code: number
  msg?: string
  data: T
}

/** 事件类型 → 告警等级：0=P0 紧急，1=P1 重要，2=P2 普通 */
export type NotifyPriorityMap = Record<string, number>

/**
 * GET /api/notify/setting 完整配置
 * 等级配置只用其中的 priority_map；其余字段后续通知/自启/应用锁等页共用
 */
export type NotifySettingData = {
  username?: string
  /** 事件等级映射（等级配置页） */
  priority_map: NotifyPriorityMap
  /** P0 通知 */
  p0_sound_enabled?: number
  p0_do_not_disturb_start?: string
  p0_do_not_disturb_end?: string
  p0_taskbar_flash_enabled?: number
  /** P1 通知 */
  p1_popup_enabled?: number
  p1_auto_dismiss_seconds?: number
  p1_popup_when_locked?: number
  /** P2 */
  p2_workbench_enabled?: number
  /** 开机/托盘 */
  start_to_tray_enabled?: number
  /** 应用锁 */
  app_lock_enabled?: number
  auto_lock_minutes?: number
  /** 数据与存储 */
  auto_cleanup_enabled?: number
  cleanup_interval_days?: number
  data_retention_days?: number
  /** 登录与账号 */
  remember_login?: number
  server_address?: string
  updated_at?: string
}

/** 邮件通知配置 */
export function emailInfo() {
  return request.get('/settings/email/emailInfo')
}

export function saveEmailInfo(data: Record<string, unknown>) {
  return request.post('/settings/email/saveEmailInfo', data)
}

export function sendEmailAPI(data: Record<string, unknown>) {
  return request.post('/attackGovern/notify/email/send', data)
}

/**
 * 读取完整桌面通知/设置配置
 * GET /api/notify/setting
 */
export function fetchNotifySetting() {
  return request.get('/notify/setting') as Promise<ApiResult<NotifySettingData>>
}

/**
 * 更新配置（可只传需要改的字段，如等级配置只传 priority_map）
 * PUT /api/notify/setting
 */
export function updateNotifySetting(data: Partial<NotifySettingData>) {
  return request.put('/notify/setting', data) as Promise<ApiResult<NotifySettingData>>
}

/**
 * 恢复默认告警等级（仅重置 priority_map，其它开关不变）
 * POST /api/notify/setting/reset
 */
export function resetNotifySetting() {
  return request.post('/notify/setting/reset') as Promise<ApiResult<NotifySettingData>>
}
