import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

export function createWorkOrderAPI(data?: ApiData) {
  return request({
    url: '/attackGovern/workorder/create',
    method: 'post',
    data
  })
}
