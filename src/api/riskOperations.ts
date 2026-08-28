/** 治理第一步相关接口 */
import request from '@/utils/request'

export type TaskListParams = {
  category: string
  task_type: string
  status?: number
}

/** POST /api/attackGovern/task/todo/list：治理待办任务列表 */
export function taskListNewAPI(data: TaskListParams) {
  return request.post('/attackGovern/task/todo/list', data)
}

/** GET /api/attackGovern/vuln/repairSuggestion：查询漏洞修复建议 */
export function queryRepairSuggestionByVulnId(data: { id: string | number }) {
  return request.get('/attackGovern/vuln/repairSuggestion', data)
}

/** GET /api/attackGovern/report/html：生成 HTML 报告 */
export function generateReportAPI(params: Record<string, unknown>) {
  return request.get('/attackGovern/report/html', params)
}
