/** 资产治理相关接口 */
import request from '@/utils/request'

/** POST /api/assets/manage/portStatus：更新端口状态 */
export function portStatusAPI(data: Record<string, unknown>) {
  return request.post('/assets/manage/portStatus', data)
}

/** POST /api/objs/personList：负责人列表 */
export function personList(data: Record<string, unknown>) {
  return request.post('/objs/personList', data)
}
