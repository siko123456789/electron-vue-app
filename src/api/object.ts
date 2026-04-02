import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

export function personList(data?: ApiData) {
  return request({
    url: '/objs/personList',
    method: 'post',
    data
  })
}
