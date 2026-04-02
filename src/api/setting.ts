import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

export function saveEmailInfo(data?: ApiData) {
  return request({
    url: '/settings/email/saveEmailInfo',
    method: 'post',
    data
  })
}
