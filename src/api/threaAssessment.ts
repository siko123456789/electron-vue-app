/** 威胁评估接口 */
import request from '@/utils/request'

/** POST /api/threatdetection/traffic/query_src_ips_by_dest_ip_port */
export function querySrcIpsByDestIpPortAPI(data: Record<string, unknown>) {
  return request.post('/threatdetection/traffic/query_src_ips_by_dest_ip_port', data)
}
