/** 操作审计接口 */
import request from '@/utils/request'

/** POST /api/opt/handRecord：写入人工操作记录 */
export function addHandRecordAPI(data: Record<string, unknown>) { return request.post('/opt/handRecord', data) }

/** POST /api/attackGovern/workorder/create：创建治理工单事件 */
export function createWorkOrderAPI(data: Record<string, unknown>) { return request.post('/attackGovern/workorder/create', data) }
