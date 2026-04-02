import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined
type ApiParams = Record<string, any> | undefined

export function securityOverviewTextAPI() {
  return request({
    url: '/analy/securityOverviewText',
    method: 'get'
  })
}

export function resolveTaskAPI(data?: ApiData) {
  return request({
    url: '/attackGovern/task/status',
    method: 'post',
    data
  })
}

export function taskListNewAPI(data?: ApiData) {
  return request({
    url: '/attackGovern/task/todo/list',
    method: 'post',
    data
  })
}

export function taskSummaryNewAPI(data?: ApiData) {
  return request({
    url: '/attackGovern/task/todo/summary',
    method: 'post',
    data
  })
}

export function generateReportAPI(params?: ApiParams) {
  return request({
    url: '/attackGovern/report/html',
    method: 'get',
    params
  })
}

export function sendEmailAPI(data?: ApiData) {
  return request({
    url: '/attackGovern/notify/email/send',
    method: 'post',
    data
  })
}

export function exportTaskTodoHTMLAPI() {
  return request({
    url: '/attackGovern/task/todo/export/html',
    method: 'get'
  })
}

export function verifyBruteCredentialAPI(data?: ApiData) {
  return request({
    url: '/newscan/verifyBruteCredential',
    method: 'post',
    data: {
      data
    }
  })
}
