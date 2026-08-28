import { ElMessage } from 'element-plus'
import { createWorkOrderAPI } from '@/api/operation'

/** 统一创建治理工单，兼容原 Vue2 组件传入的 vm 参数。 */
export async function createWorkOrderEvent(vm: any, payload: Record<string, any> = {}, options: Record<string, any> = {}) {
  const { requireIp = true, missingIpMessage = '缺少资产 IP，无法生成事件', errorMessage = '生成事件失败' } = options
  const requestPayload = { task_type: '风险处置', ...payload }
  if (requireIp && !String(requestPayload.ip || '').trim()) {
    ElMessage.warning(missingIpMessage)
    return null
  }
  try {
    const result: any = await createWorkOrderAPI(requestPayload)
    if (Number(result?.code) === 0) ElMessage.success('事件生成成功')
    else ElMessage.error(result?.msg || errorMessage)
    return result
  } catch (error: any) {
    ElMessage.error(error?.msg || error?.message || errorMessage)
    return null
  }
}

export default createWorkOrderEvent
