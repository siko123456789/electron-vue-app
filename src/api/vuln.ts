import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

export function GetVulnInfo(data?: ApiData) {
  return request({
    url: '/vlun/GetVulnInfo',
    method: 'post',
    data
  })
}

export function pocVerifyAPI(data?: ApiData) {
  return request({
    url: '/vlun/vas/poc',
    method: 'post',
    data
  })
}
