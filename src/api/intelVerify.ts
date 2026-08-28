/**
 * 风险监测 - 漏洞情报验证相关接口
 * 统一维护验证弹窗中的资产、网段和端口组请求。
 */
import request from '@/utils/request'

export type PrivateNetworkItem = {
  subnet_name?: string
  subnet_address?: string
  [key: string]: unknown
}

export type AssetListParams = Record<string, unknown>

export type AssetListItem = {
  asset_ip?: string
  [key: string]: unknown
}

export type FilterFieldParams = {
  fields: string
}

export type PortGroupItem = {
  id: string | number
  name?: string
  label?: string
  [key: string]: unknown
}

/** 查询私有网段：GET /api/objs/privateNetwork */
export function privateNetwork() {
  return request.get('/objs/privateNetwork')
}

/** 资产列表：POST /api/assets/manage/assetList */
export function assetList(data: AssetListParams) {
  return request.post('/assets/manage/assetList', data)
}

/** 资产过滤字段下拉：POST /api/assets/manage/filter_field */
export function filterFieldAPI(data: FilterFieldParams) {
  return request.post('/assets/manage/filter_field', data)
}

/** 资产扫描端口组：GET /api/A508/v1/port-ranges */
export function getPortGroupAPI() {
  return request.get('/A508/v1/port-ranges')
}
