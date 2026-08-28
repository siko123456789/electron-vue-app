import request from '../utils/request'

export type RiskPriority = 0 | 1 | 2
export type RiskStatus = 0 | 1

export type NotifyDetail = {
  action?: string
  attack_type?: string
  count?: number
  dest_ip?: string
  dest_port?: number | string
  dst_port?: number | string
  es_id?: string
  es_index?: string
  event_type?: string
  first_seen?: string
  last_seen?: string
  signature?: string
  src_ip?: string
  timestamp?: string
  [key: string]: unknown
}

export type RiskMonitorItem = {
  id: number
  /** 原始漏洞情报 JSON，验证任务的 vuln_ids 从这里取原始情报 id */
  detail_json?: unknown
  es_id?: string
  es_index?: string
  src_ip?: string
  src_ips?: string[]
  dest_ip?: string
  dst_port?: number | string
  event_type: string
  event_type_name: string
  priority: RiskPriority | number
  status: RiskStatus | number
  title: string
  summary: string
  occurred_at: string
  source: string
  detail?: NotifyDetail | NotifyDetail[]
}

/**
 * POST /api/notify/list 请求体
 */
export type NotifyListParams = {
  /** nil=全部；0未处理 1已处理 */
  status?: number | null
  /** nil=全部；0/1/2 */
  priority?: number | null
  event_types?: string[]
  start_time?: string
  end_time?: string
  current_page: number
  page_size: number
}

/**
 * POST /api/notify/summary 请求体（与筛选栏时间联动）
 */
export type NotifySummaryParams = {
  start_time: string
  end_time: string
}

/**
 * POST /api/notify/summary 返回
 * all→全部，p0/p1/p2→等级卡，handled→已处理
 */
export type NotifySummaryData = {
  all: number
  p0: number
  p1: number
  p2: number
  pending?: number
  handled: number
  total?: number
}

export type NotifyListData = {
  list: RiskMonitorItem[]
  total: number
  current_page?: number
  page?: number
  page_size?: number
  size?: number
}

export type ApiResult<T> = {
  code: number
  msg?: string
  data: T
}

export type NotifyStatusUpdateParams = {
  ids: number[]
  status: RiskStatus
}

export type AttackEventDisposeStatus = 'ignored' | 'blocked' | 'isolated'

export type AttackEventDisposeParams = {
  es_id: string
  es_index: string
  process_status: AttackEventDisposeStatus
  sync_rule?: {
    msg: string
    rule_type: 'custom-ban-srcip' | 'custom-ban-dstip'
    ip: string
  }
}

export type FlowProcessStatusParams = {
  dest_ip: string
  dest_port: number
  src_ips: string[]
}

/** POST /api/abutment/agent/batchAddRuleById 请求体 */
export type BatchAddRuleByIdParams = {
  batchAddRuleRequest: {
    /** agent_id 字符串，数字 ID 会在组件中补齐为三位 */
    agentId: string
    rules: Array<{
      ip: string
      port: number
      protocol: 'tcp' | 'udp'
      rule_type: 'Whitelist'
      direction: 'incomming'
    }>
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** 格式化成后端 occurred_at 同风格：YYYY-MM-DD HH:mm:ss */
export function formatNotifyDateTime(date: Date) {
  return [
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`,
  ].join(' ')
}

/**
 * 把前端时间筛选转成 start_time / end_time
 * today 示例：00:00:00 ~ 23:59:59
 */
export function resolveNotifyTimeRange(range: string): { start_time: string; end_time: string } {
  const now = new Date()
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  if (range === 'all') {
    return { start_time: '', end_time: '' }
  }

  const start = new Date(now)
  if (range === '7d') {
    start.setDate(start.getDate() - 7)
    start.setHours(0, 0, 0, 0)
  } else if (range === '30d') {
    start.setDate(start.getDate() - 30)
    start.setHours(0, 0, 0, 0)
  } else {
    // today
    start.setHours(0, 0, 0, 0)
  }

  return {
    start_time: formatNotifyDateTime(start),
    end_time: formatNotifyDateTime(endOfToday),
  }
}

export function buildNotifySummaryBody(timeRange = 'today'): NotifySummaryParams {
  const time = resolveNotifyTimeRange(timeRange)
  return {
    start_time: time.start_time,
    end_time: time.end_time,
  }
}

/**
 * 组装 list 请求体
 * 卡片规则：
 * - 全部：仅分页（+时间）
 * - P0/P1/P2：priority + status:0
 * - 已处理：status:1
 */
export function buildNotifyListBody(input: {
  current_page: number
  page_size: number
  status?: number | '' | null
  priority?: number | '' | null
  event_type?: string
  event_types?: string[]
  time_range?: string
  start_time?: string
  end_time?: string
}): NotifyListParams {
  const time =
    input.start_time !== undefined || input.end_time !== undefined
      ? { start_time: input.start_time || '', end_time: input.end_time || '' }
      : resolveNotifyTimeRange(input.time_range || 'today')

  const body: NotifyListParams = {
    current_page: input.current_page,
    page_size: input.page_size,
  }

  if (input.status !== '' && input.status !== null && input.status !== undefined) {
    body.status = Number(input.status)
  }
  if (input.priority !== '' && input.priority !== null && input.priority !== undefined) {
    body.priority = Number(input.priority)
  }

  const eventTypes =
    input.event_types?.filter(Boolean) ||
    (input.event_type ? [input.event_type] : [])
  if (eventTypes.length) {
    body.event_types = eventTypes
  }

  if (time.start_time) body.start_time = time.start_time
  if (time.end_time) body.end_time = time.end_time

  return body
}

/**
 * POST /api/notify/event-types 请求体
 * 全部：{}（不传 priority）
 * P0/P1/P2：{ priority: 0|1|2 }
 */
export type NotifyEventTypesParams = {
  priority?: number
}

export type NotifyEventTypeItem = {
  event_type: string
  event_type_name: string
  priority: number
}

export type NotifyEventTypesData = {
  list: NotifyEventTypeItem[]
}

/**
 * 事件类型下拉
 * POST /api/notify/event-types
 */
export function fetchNotifyEventTypes(data: NotifyEventTypesParams = {}) {
  const body: NotifyEventTypesParams = {}
  if (data.priority !== undefined && data.priority !== null) {
    body.priority = Number(data.priority)
  }
  return request.post('/notify/event-types', body) as Promise<ApiResult<NotifyEventTypesData>>
}

/**
 * 风险监测总览
 * POST /api/notify/summary
 */
export function fetchNotifySummary(data: NotifySummaryParams) {
  return request.post('/notify/summary', data) as Promise<ApiResult<NotifySummaryData>>
}

/**
 * 风险监测列表
 * POST /api/notify/list
 */
export function fetchNotifyList(data: NotifyListParams) {
  return request.post('/notify/list', data) as Promise<ApiResult<NotifyListData>>
}

export type NotifyDetailParams = {
  id: number
  event_type: string
}

/**
 * POST /api/notify/detail
 * 获取通知详情，详情页统一以接口返回的 detail 为准
 */
export function fetchNotifyDetail(data: NotifyDetailParams) {
  return request.post('/notify/detail', data) as Promise<ApiResult<RiskMonitorItem>>
}

/** POST /api/notify/status/update */
export function updateNotifyStatus(data: NotifyStatusUpdateParams) {
  return request.post('/notify/status/update', data) as Promise<ApiResult<unknown>>
}

/**
 * POST /api/threatdetection/traffic/alarms/apply_attack_event_dispose
 * 执行忽略、封禁源 IP、隔离受害主机等告警处置动作。
 */
export function applyAttackEventDispose(data: AttackEventDisposeParams) {
  return request.post('/threatdetection/traffic/alarms/apply_attack_event_dispose', data) as Promise<
    ApiResult<unknown>
  >
}

/**
 * POST /api/threatdetection/traffic/alarms/update_attack_event_process_status
 * 更新攻击事件的处理状态。
 */
export function updateAttackEventProcessStatus(
  data: Pick<AttackEventDisposeParams, 'es_id' | 'es_index' | 'process_status'>,
) {
  return request.post('/threatdetection/traffic/alarms/update_attack_event_process_status', data) as Promise<
    ApiResult<unknown>
  >
}

/**
 * POST /api/threatdetection/traffic/update_flow_process_status
 * 确认新资产、新端口或访问关系对应的正常访问关系。
 */
export function updateFlowProcessStatus(data: FlowProcessStatusParams) {
  return request.post('/threatdetection/traffic/update_flow_process_status', data) as Promise<
    ApiResult<unknown>
  >
}

/**
 * 更新告警列表项的原始 detail 日志，保留原字段并写入最新处理状态。
 */
/**
 * POST /api/abutment/agent/batchAddRuleById
 * 将指定规则批量加入白名单。
 */
export function batchAddRuleById(data: BatchAddRuleByIdParams) {
  return request.post('/abutment/agent/batchAddRuleById', data) as Promise<ApiResult<unknown>>
}

/** @deprecated 使用 fetchNotifyList */
export const fetchRiskMonitorList = fetchNotifyList
