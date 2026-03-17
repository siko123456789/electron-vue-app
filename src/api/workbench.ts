import request from '../utils/request'
// 工作台左侧安全等级评估数据
export function securityOverviewTextAPI(params?: Record<string, any>) {
  return request.get('/analy/securityOverviewText', params)
}
