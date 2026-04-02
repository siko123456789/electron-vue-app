import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

export function insertThreatRuleAPI(data?: ApiData) {
  return request({
    url: '/vulnerability_management_platform/insert_rule_by_priority',
    method: 'post',
    data
  })
}
