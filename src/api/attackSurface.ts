import request from '@/utils/request'

type ApiParams = Record<string, any> | undefined

export function queryRepairSuggestionByVulnId(params?: ApiParams) {
  return request({
    url: '/attackGovern/vuln/repairSuggestion',
    method: 'get',
    params
  })
}

export function getEmailInfoAPI() {
  return request({
    url: '/settings/email/emailInfo',
    method: 'get'
  })
}
