/** 漏洞情报接口 */
import request from '@/utils/request'

/** GET /api/A508/v1/vulns：获取漏洞情报详情 */
export function getHotVulnListAPI(params?: Record<string, unknown>) { return request.get('/A508/v1/vulns', params) }

/** POST /api/A508/v1/vulns/rules/push-ndr：下发威胁检测规则 */
export function insertThreatRuleDownAPI(data: Record<string, unknown>) { return request.post('/A508/v1/vulns/rules/push-ndr', data) }

/** POST /api/vuln/detectRule/getByPluginId：根据 POC 查询检测规则 */
export function getDetectRuleByPluginIdAPI(data: Record<string, unknown>) {
  return request.post('/vuln/detectRule/getByPluginId', data)
}

/** POST /api/threatdetection/rule/insert_raw_rule：下发原始检测规则 */
export function insertRawRuleAPI(data: unknown[]) {
  return request.post('/threatdetection/rule/insert_raw_rule', data)
}
