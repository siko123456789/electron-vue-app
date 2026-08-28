/** 检测结果接口 */
import request from '@/utils/request'

/** GET /api/A508/v1/scan-results/{id}：获取资产扫描结果 */
export function getAssetScanResultsAPI(id: string | number) { return request.get(`/A508/v1/scan-results/${id}`) }
