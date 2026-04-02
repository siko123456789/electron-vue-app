import request from '@/utils/request'

type ApiData = Record<string, any> | any[] | undefined

function getNdrAuthorKey(): string {
  try {
    return String(localStorage.getItem('ndrAuthorKey') || '').trim()
  } catch {
    return ''
  }
}

function withNdrAuthor() {
  return {
    'ndr-author': getNdrAuthorKey()
  }
}

export function querySrcIpsByDestIpPortAPI(data?: ApiData) {
  return request({
    url: '/threatdetection/traffic/query_src_ips_by_dest_ip_port',
    method: 'post',
    data,
    headers: withNdrAuthor()
  })
}

export function queryPolicyList(data?: ApiData) {
  return request({
    url: '/ndr/rule/query_custom_rule',
    method: 'post',
    data
  })
}
