import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined
type ApiParams = Record<string, any> | undefined

function getNdrAuthorKey(): string {
  try {
    return String(localStorage.getItem('ndrAuthorKey') || '').trim()
  } catch {
    return ''
  }
}

function withNdrAuthor() {
  return {
    'ndr-author': getNdrAuthorKey()
  }
}

/** 实时风险监测 WebSocket URL */
export function getRealtimeAlarmWsUrl(): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const path = '/threatdetection/traffic/alarms/ws_query_attack_alarm_log'
  const params = new URLSearchParams({
    'ndr-author': getNdrAuthorKey()
  })
  return `${protocol}//${location.host}${path}?${params.toString()}`
}

// 聚合漏洞利用行为监测列表
export function queryAttackVulnEventsByAggSignatureAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_vuln_events_by_agg_signature',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 非聚合漏洞利用行为原始监测列表
export function queryAttackScanExpListAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_scan_exp_list',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 查询攻击者列表（活跃攻击者）
export function queryAttackScanAttackerListAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_scan_attacker_list',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 查询被攻击者列表（受害目标）
export function queryAttackScanVictimListAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_scan_victim_list',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 更新告警事件处理状态
export function updateAttackEventProcessStatusAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/update_attack_event_process_status',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 查询漏洞利用告警详情
export function queryAttackVulnEventsBySignatureAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_vuln_events_by_signature',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 依据告警名称和时间查询列表
export function queryAttackEventTimelineAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_attack_event_timeline',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 配置阻断功能
export function natRestapi(data?: ApiData) {
  return request({
    url: '/threatdetection/engine/nta/query_config',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 更新引擎配置
export function updateEngineConfigAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/engine/nta/set_config',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 内部漏洞利用行为列表中封禁
export function insertCustomRulesAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/rule/insert_custom_rules',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 查询 IP 防护策略
export function queryCustomRules(data?: ApiData) {
  return request({
    url: '/threatdetection/rule/query_custom_rules',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 异常事件列表
export function queryBaselineAnomalyEventsAPI(data?: ApiData) {
  console.log(withNdrAuthor(),123456);
  
  return request({
    url: '/threatdetection/traffic/query_baseline_anomaly_events',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 被拦截的访问行为列表
export function queryCustomBanBaselineOffsetAggAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/alarms/query_custom_ban_baseline_offset_agg',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 更新流量处理状态
export function updateFlowProcessStatusAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/update_flow_process_status',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 获取网卡列表
export function queryNetcardListAPI(params?: ApiParams) {
  return request({
    url: '/threatdetection/engine/nta/pci_addresses',
    method: 'get',
    params,
    headers: withNdrAuthor()
  })
}

// 旁路策略加白名单
export function delCustomRuleSrcIpAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/rule/del_custom_rule_src_ip',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// agent 策略加白名单
export function batchAgentRuleAPI(data?: ApiData) {
  return request({
    url: '/abutment/agent/batchAgentRule',
    method: 'post',
    data
  })
}

// 根据 dest_ip 和 dest_port 查源 IP
export function querySrcIpsByDestIpPortAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/query_src_ips_by_dest_ip_port',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 根据源 IP 查它访问的目的 IP 和目的端口
export function queryDestBySrcIpAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/analyze/query_dest_by_src_ip',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 查询规则列表
export function queryPolicyList(data?: ApiData) {
  return request({
    url: '/ndr/rule/query_custom_rule',
    method: 'post',
    data
  })
}

// agent 阻断记录列表
export function blockList(data?: ApiData) {
  return request({
    url: '/abutment/agent/queryAgentBlockLog',
    method: 'post',
    data
  })
}

// 编辑威胁规则
export function updateThreatRuleAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/rule/edit_custom_rule',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 删除规则
export function deleteThreatRuleAPI(params?: ApiParams) {
  return request({
    url: '/threatdetection/rule/del_custom_rule',
    method: 'get',
    params,
    headers: withNdrAuthor()
  })
}

// 查看当前学习期配置
export function queryLearningPeriodAPI(params?: ApiParams) {
  return request({
    url: '/threatdetection/traffic/query_learning_period',
    method: 'get',
    params,
    headers: withNdrAuthor()
  })
}

// 配置学习期参数
export function setLearningPeriodAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/set_learning_period',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

// 手动结束学习期
export function endLearningPeriodAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/end_learning_period',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}