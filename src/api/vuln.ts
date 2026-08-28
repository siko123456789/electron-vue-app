/** 漏洞状态接口 */
import request from '@/utils/request'

/** POST /api/vuln/UpdataVulnStatus：更新漏洞状态 */
export function updataVulnStatusAPI(data: Record<string, unknown>) { return request.post('/vuln/UpdataVulnStatus', data) }

/** POST /api/hawk/vulnVerify：直接验证关键漏洞/弱口令 */
export function hawkVulnVerifyAPI(data: Record<string, unknown>) {
  return request.post('/hawk/vulnVerify', data)
}
