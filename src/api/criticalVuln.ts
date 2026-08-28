/** 关键漏洞验证接口 */
import request from '@/utils/request'

/** POST /api/A508/v1/tasks：创建扫描/验证任务 */
export function portscanLogsAPI(data: Record<string, unknown>) { return request.post('/A508/v1/tasks', data) }

/** GET /api/A508/v1/tasks/{id}/progress：查询验证任务进度 */
export function getVulnScanProgressAPI(id: string | number) { return request.get(`/A508/v1/tasks/${id}/progress`) }

/** 构建高危端口复测 WebSocket 地址：/api/websocket/sysVulnRetest */
export function buildSysVulnRetestWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/websocket/sysVulnRetest`
}
