/** Agent 与服务收敛治理接口 */
import request from '@/utils/request'

export function agentIsInstalled(data: Record<string, unknown>) { return request.post('/abutment/agent/agentIsInstalled', data) }
export function agentInstallAPI(data: Record<string, unknown>) { return request.post('/abutment/agent/agentInstall', data) }
export function agentNameIsAvailableAPI(params: Record<string, unknown>) { return request.get('/abutment/agent/queryAgentNameIsAvailable', params) }
export function groupList(params?: Record<string, unknown>) { return request.get('/abutment/agent/queryAgentGroup', params) }
export function createGroup(data: Record<string, unknown>) { return request.post('/abutment/agent/createAgentGroup', data) }
export function queryAgentRule(params?: Record<string, unknown>) { return request.get('/abutment/agent/queryAgentRule', params) }
export function batchAgentRule(data: Record<string, unknown>) { return request.post('/abutment/agent/batchAddRuleById', data) }
